const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const Replicate = require('replicate');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Replicate
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    cb(null, timestamp + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Basic route
app.get('/', (req, res) => {
  res.send('Vice Photos Backend Server is running!');
});

// Upload and process image
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    console.log('Upload request received');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log('File uploaded:', req.file.filename);

    // Read the uploaded file
    const imagePath = req.file.path;
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

    console.log('Starting Replicate prediction...');

    // Run the Flux model
    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: "A cool 90s vice magazine style photo",
          image: dataUrl,
          go_fast: true,
          guidance: 3.5,
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "webp",
          output_quality: 80,
          prompt_strength: 0.8,
          num_inference_steps: 4
        }
      }
    );

    console.log('Replicate output:', output);

    // Clean up uploaded file
    fs.unlinkSync(imagePath);

    if (output && output.length > 0) {
      res.json({ 
        success: true, 
        imageUrl: output[0]
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to generate image',
        details: 'No output from Replicate'
      });
    }

  } catch (error) {
    console.error('Error processing upload:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: 'Failed to process image',
      details: error.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
