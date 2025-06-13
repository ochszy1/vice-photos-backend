const express = require('express');
const multer = require('multer');
const cors = require('cors');
const Replicate = require('replicate');

const app = express();
const PORT = process.env.PORT || 3000;

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.get('/', (req, res) => {
  res.send('Vice Photos Backend Server is running!');
});

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageBuffer = req.file.buffer;
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

    const output = await replicate.run('black-forest-labs/flux-kontext-pro', {
      input: {
        prompt: 'Make this a GTAV style loading screen photo, keep all original details, match pose, match identity, match background as close as possible.',
        image: dataUrl,
        go_fast: true,
        guidance: 3.5,
        num_outputs: 1,
        aspect_ratio: '1:1',
        output_format: 'jpeg',
        output_quality: 80,
        prompt_strength: 0.3,
        num_inference_steps: 4,
      },
    });

    console.log('Replicate output:', output);

    if (output && output.length > 0 && output[0].startsWith('https://')) {
      // Always send 200 OK if we got an image
      res.status(200).json({ success: true, imageUrl: output[0] });
    } else {
      // If Replicate failed
      res.status(500).json({
        error: 'Failed to generate image (empty output)',
        details: output,
      });
    }
  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(500).json({
      error: 'Failed to process image',
      details: error.message,
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
