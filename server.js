const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

dotenv.config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

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

// Helper function to upload image to Replicate
async function uploadImageToReplicate(imagePath) {
  try {
    console.log('Uploading image to Replicate...');
    
    const form = new FormData();
    form.append('content', fs.createReadStream(imagePath));
    
    const response = await axios.post('https://api.replicate.com/v1/files', form, {
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_KEY}`,
        ...form.getHeaders(),
      },
    });
    
    console.log('Image uploaded successfully:', response.data.urls.get);
    return response.data.urls.get;
  } catch (error) {
    console.error('Image upload failed:', error.message);
    if (error.response) {
      console.error('Upload error details:', error.response.data);
    }
    throw error;
  }
}

app.post('/generate-image', upload.single('image'), async (req, res) => {
  console.log('Received request to /generate-image');
  try {
    if (!req.file) {
      console.log('No image uploaded');
      return res.status(400).json({ error: 'No image uploaded' });
    }

    console.log('Image uploaded:', req.file.filename);
    const imagePath = path.join(__dirname, 'uploads', req.file.filename);
    
    // Step 1: Upload image to Replicate (like the web interface does)
    const imageUrl = await uploadImageToReplicate(imagePath);

    // Step 2: Use the exact parameters from the web interface
    const payload = {
      version: 'black-forest-labs/flux-kontext-pro',
      input: {
        prompt: 'Do a GTAV Loading screen art style version of this image. Keep all original Features.\n',
        input_image: imageUrl,  // Use the uploaded image URL
        aspect_ratio: 'match_input_image',
        output_format: 'jpg',
        safety_tolerance: 2
      }
    };

    console.log('Sending request to FLUX.1 Kontext [pro] via Replicate...');
    console.log('Using correct web interface parameters');
    
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
    console.log('Prediction created:', predictionId);
    
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
        console.error('Prediction failed:', JSON.stringify(statusResponse.data.error, null, 2));
        throw new Error(`Prediction failed: ${JSON.stringify(statusResponse.data.error)}`);
      }
    }

    if (!result) {
      throw new Error('Prediction timed out after 3 minutes');
    }

    const endTime = Date.now();
    console.log('Generation request duration:', (endTime - startTime) / 1000, 'seconds');
    console.log('Raw FLUX.1 Kontext [pro] response:', JSON.stringify(result, null, 2));
    
    // Clean up uploaded file
    fs.unlinkSync(imagePath);
    console.log('Deleted uploaded image:', req.file.filename);

    // Return proper JSON response
    res.json({ imageUrl: result });
  } catch (error) {
    console.error('Error in /generate-image endpoint:', error.message);
    if (error.response) {
      console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
      console.error('Error response status:', error.response.status);
    }
    if (error.code) console.error('Error code:', error.code);
    console.error('Stack trace:', error.stack);
    
    // Always return JSON, never plain text
    res.status(500).json({ 
      error: 'Failed to generate image', 
      details: error.message 
    });
  }
});

app.get('/test', (req, res) => {
  res.json({ message: 'Backend is running' });
});

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});