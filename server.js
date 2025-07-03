import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import Replicate from "replicate";

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Scene-to-prompt map
const scenePrompts = {
  "Vice Club": "Make this look like official Grand Theft Auto V loading screen artwork. Use sharp, clean vector outlines, soft airbrushed textures, warm cinematic lighting, and a graphic novel illustration style. Place the subject inside a sleek, upscale Miami high-rise nightclub at night, with glowing neon lights and the downtown skyline visible through glass walls. Preserve the original face and outfit details but stylize them in the same polished 3D-art-meets-comic look Rockstar uses in official GTA V splash screens. Do not add any text, logos, or extra objects.",
  "Street Gang": "Make this look like official Grand Theft Auto V loading screen artwork. Use sharp, clean vector outlines, soft airbrushed textures, warm cinematic lighting, and a graphic novel illustration style. Place the subject in a gritty Miami alleyway covered in graffiti, with broken fences and police lights flashing in the background as they hide in the shadows. Preserve the original face and outfit details but stylize them in the same polished 3D-art-meets-comic look Rockstar uses in official GTA V splash screens. Do not add any text, logos, or extra objects.",
  "Heist Ready": "Make this look like official Grand Theft Auto V loading screen artwork. Use sharp, clean vector outlines, soft airbrushed textures, warm cinematic lighting, and a graphic novel illustration style. Place the subject inside a dimly lit bank vault surrounded by blueprints and heist equipment, with masks hanging on the wall behind them. Preserve the original face and outfit details but stylize them in the same polished 3D-art-meets-comic look Rockstar uses in official GTA V splash screens. Do not add any text, logos, or extra objects.",
  "Beach Vibes": "Make this look like official Grand Theft Auto V loading screen artwork. Use sharp, clean vector outlines, soft airbrushed textures, warm cinematic lighting, and a graphic novel illustration style. Place the subject on South Beach in Miami with palm trees, colorful lifeguard towers, and ocean waves in the background under a sunny sky. Preserve the original face and outfit details but stylize them in the same polished 3D-art-meets-comic look Rockstar uses in official GTA V splash screens. Do not add any text, logos, or extra objects.",
  "Downtown Chaos": "Make this look like official Grand Theft Auto V loading screen artwork. Use sharp, clean vector outlines, soft airbrushed textures, warm cinematic lighting, and a graphic novel illustration style. Place the subject in downtown Miami during a chaotic riot, with flaming cars, shattered glass, and smoke clouds filling the streets behind them. Preserve the original face and outfit details but stylize them in the same polished 3D-art-meets-comic look Rockstar uses in official GTA V splash screens. Do not add any text, logos, or extra objects.",
  "Luxury Life": "Make this look like official Grand Theft Auto V loading screen artwork. Use sharp, clean vector outlines, soft airbrushed textures, warm cinematic lighting, and a graphic novel illustration style. Place the subject inside a luxurious Miami high-rise penthouse, wearing a white robe with two glamorous women in fur coats standing nearby, with champagne and city lights in the background. Preserve the original face and outfit details but stylize them in the same polished 3D-art-meets-comic look Rockstar uses in official GTA V splash screens. Do not add any text, logos, or extra objects.",
};

const defaultPrompt = "Make this look like official Grand Theft Auto V loading screen artwork. Use sharp, clean vector outlines, soft airbrushed textures, warm cinematic lighting, and a graphic novel illustration style. Preserve the original face and outfit details but stylize them in the same polished 3D-art-meets-comic look Rockstar uses in official GTA V splash screens. Do not add any text, logos, or extra objects.";

app.get("/", (req, res) => {
  res.send("Vice Photos Backend is running 🚀");
});

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    const mimeType = req.file.mimetype;
    const base64Image = req.file.buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    const scene = req.body.scene;
    const prompt = scenePrompts[scene] || defaultPrompt;

    console.log("📸 Received file:", req.file.originalname);
    console.log("🎨 Scene:", scene || "Default");
    console.log("🧠 Sending to Replicate...");

    const output = await replicate.run("black-forest-labs/flux-kontext-pro", {
      input: {
        prompt,
        input_image: dataUrl,
        go_fast: true,
        output_format: "jpg",
        aspect_ratio: "match_input_image",
        safety_tolerance: 2,
      },
    });

    console.log("✅ Replicate response:", output);

    if (typeof output === "string") {
      return res.json({ success: true, imageUrl: output });
    }

    if (Array.isArray(output) && output.length > 0) {
      return res.json({ success: true, imageUrl: output[0] });
    }

    res.status(500).json({
      error: "Unexpected Replicate output",
      details: output,
    });
  } catch (error) {
    console.error("❌ Caught error in /upload");

    let detail = "Unknown error";
    if (error?.response?.data) {
      detail = error.response.data;
    } else if (error?.message) {
      detail = error.message;
    }

    console.error("Error details:", detail);
    res.status(500).json({
      error: "Failed to process image",
      details: detail,
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
