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

    const output = await replicate.run('black-forest-labs/flux-schnell', {
      input: {
        prompt: 'A cool 90s vice magazine style photo',
        image: dataUrl,
        go_fast: true,
        guidance: 3.5,
        num_outputs: 1,
        aspect_ratio: '1:1',
        output_format: 'webp',
        output_quality: 80,
        prompt_strength: 0.8,
        num_inference_steps: 4,
      },
    });

    if (output && output.length > 0) {
      res.json({ success: true, imageUrl: output[0] });
    } else {
      res.status(500).json({ error: 'Failed to generate image' });
    }
  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(500).json({ error: 'Failed to process image', details: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
