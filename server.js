const express = require('express');
const multer = require('multer');
const cors = require('cors');
const Replicate = require('replicate');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer config (store file in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Initialize Replicate
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Endpoint
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const imageBuffer = req.file.buffer;
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;

    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const output = await replicate.run('black-forest-labs/flux-kontext-pro', {
      input: {
        prompt: 'Make this a GTAV style loading screen photo, keep all original details, match pose, match identity, match background as close as possible.',
        image: dataUrl,
        go_fast: true,
        guidance: 3.5,
        num_outputs: 1,
        aspect_ratio: '1:1',
        output_format: 'jpg', // ✅ FIXED from 'jpeg'
        output_quality: 80,
        prompt_strength: 0.3,
        num_inference_steps: 4,
      },
    });

    const imageUrl = output?.[0];
    if (!imageUrl) {
      return res.status(500).json({ error: 'Failed to generate image', details: output });
    }

    res.json({ success: true, imageUrl });
  } catch (error) {
    console.error('Server error response:', error);

    let details = '';
    try {
      details = JSON.stringify(error, null, 2);
    } catch (e) {}

    res.status(500).json({ error: 'Failed to process image', details });
  }
});

// Health check
app.get('/', (req, res) => {
  res.send('Vice Photos backend is running');
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
