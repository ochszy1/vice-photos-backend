const { OpenAI } = require('openai');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = '/tmp/uploads';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

const withTimeout = (promise, ms) => {
  let didTimeOut = false;
  const timeout = new Promise((_, reject) => {
    setTimeout(() => {
      didTimeOut = true;
      reject(new Error(`Request timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]).catch((error) => {
    if (didTimeOut) console.error('Timeout triggered:', error.message);
    throw error;
  });
};

async function uploadImageToReplicate(imagePath) {
  const form = new FormData();
  form.append('content', fs.createReadStream(imagePath));

  const response = await axios.post('https://api.replicate.com/v1/files', form, {
    headers: {
      'Authorization': `Token ${process.env.REPLICATE_API_KEY}`,
      ...form.getHeaders(),
    },
  });

  return response.data.urls.get;
}

module.exports = async (req, res) => {
  const multerMiddleware = upload.single('image');
  multerMiddleware(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err.message);
      return res.status(500).json({ error: 'File upload failed', details: err.message });
    }

    console.log('Received request to /api/generate-image');
    try {
      if (!req.file) {
        console.log('No image uploaded');
        return res.status(400).json({ error: 'No image uploaded' });
      }

      console.log('Image uploaded:', req.file.filename);
      const imagePath = path.join('/tmp/uploads', req.file.filename);

      // Step 1: Upload image to Replicate
      const imageUrl = await uploadImageToReplicate(imagePath);
      console.log('Image uploaded to Replicate:', imageUrl);

      // Step 2: Generate image with web interface parameters
      const payload = {
        version: 'black-forest-labs/flux-kontext-pro',
        input: {
          prompt: 'Do a GTAV Loading screen art style version of this image. Keep all original Features.\n',
          input_image: imageUrl,
          aspect_ratio: 'match_input_image',
          output_format: 'jpg',
          safety_tolerance: 2,
        },
      };

      console.log('Sending request to FLUX.1 Kontext [pro] via Replicate...');
      const startTime = Date.now();
      const response = await withTimeout(
        axios.post('https://api.replicate.com/v1/predictions', payload, {
          headers: {
            'Authorization': `Token ${process.env.REPLICATE_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }),
        180000
      );

      const predictionId = response.data.id;
      let result;
      let attempts = 0;
      const maxAttempts = 180; // 3 minutes
      
      while (!result && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        
        const statusResponse = await axios.get(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: {
            'Authorization': `Token ${process.env.REPLICATE_API_KEY}`,
          },
        });
        
        console.log(`Attempt ${attempts}: Status = ${statusResponse.data.status}`);
        
        if (statusResponse.data.status === 'succeeded') {
          result = statusResponse.data.output;
        } else if (statusResponse.data.status === 'failed') {
          throw new Error(`Prediction failed: ${JSON.stringify(statusResponse.data.error)}`);
        }
      }

      if (!result) {
        throw new Error('Prediction timed out after 3 minutes');
      }

      const endTime = Date.now();
      console.log('Generation request duration:', (endTime - startTime) / 1000, 'seconds');
      console.log('Raw FLUX.1 Kontext [pro] response:', JSON.stringify(result, null, 2));
      const generatedImageUrl = Array.isArray(result) ? result[0] : result;
      console.log('Generated image URL:', generatedImageUrl);

      fs.unlinkSync(imagePath);
      console.log('Deleted uploaded image:', req.file.filename);

      res.status(200).json({ imageUrl: generatedImageUrl });
    } catch (error) {
      console.error('Error in /api/generate-image endpoint:', error.message);
      if (error.response) {
        console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
        console.error('Error response status:', error.response.status);
      }
      if (error.code) console.error('Error code:', error.code);
      console.error('Stack trace:', error.stack);
      res.status(500).json({ error: 'Failed to generate image', details: error.message });
    }
  });
};