const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");
const QRCode = require("qrcode");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const os = require("os");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

// In-memory store for fallback local QR downloads
const imageStore = new Map();

function getOpenAIClient() {
  dotenv.config({ override: true });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_openai_api_key_here") {
    return null;
  }
  return new OpenAI({ apiKey: apiKey.trim() });
}

// ── VFS Rendezvous 2026: The Cosmic Sphere Templates (public/VFS) ──
const VFS_DIR = path.join(__dirname, "public", "VFS");
const BANNER_OVERLAY_PATH = path.join(VFS_DIR, "vfs_banner.png");

const TEMPLATE_META = {
  "01.jpg": {
    id: "01.jpg",
    gender: "female",
    hasHelmet: false,
    title: "Lunar Cyber Huntress",
    subtitle: "Neon-Blue Tactical Trench • Full Blue Moon",
    badge: "CHARACTER 01",
    cropHeight: 520,
  },
  "02.jpg": {
    id: "02.jpg",
    gender: "female",
    hasHelmet: false,
    title: "Emerald Horizon Vanguard",
    subtitle: "White-Titanium Chest Armor • Aurora Moonscape",
    badge: "CHARACTER 02",
    cropHeight: 520,
  },
  "03.jpg": {
    id: "03.jpg",
    gender: "female",
    hasHelmet: true,
    title: "Nebula Galaxy Pioneer",
    subtitle: "Violet-Purple Spacesuit • Spiral Cosmic Galaxy",
    badge: "CHARACTER 03",
    cropHeight: 520,
  },
  "04.jpg": {
    id: "04.jpg",
    gender: "female",
    hasHelmet: false,
    title: "Galactic Cloaked Ranger",
    subtitle: "Olive Cloak & Cosmic Armor • Violet Nebula",
    badge: "CHARACTER 04",
    cropHeight: 520,
  },
  "05.jpg": {
    id: "05.jpg",
    gender: "female",
    hasHelmet: true,
    title: "Aurora Cosmos Navigator",
    subtitle: "Emerald-Green Spacesuit • Aurora Moonscape",
    badge: "CHARACTER 05",
    cropHeight: 520,
  },
  "06.jpg": {
    id: "06.jpg",
    gender: "male",
    hasHelmet: false,
    title: "Galactic Cloaked Guardian",
    subtitle: "Olive Cloak & Tactical Armor • Violet Nebula",
    badge: "CHARACTER 01",
    cropHeight: 520,
  },
  "07.jpg": {
    id: "07.jpg",
    gender: "male",
    hasHelmet: true,
    title: "Solar Flare Explorer",
    subtitle: "Crimson-Orange Spacesuit • Ringed Red Giant",
    badge: "CHARACTER 02",
    cropHeight: 520,
  },
  "08.jpg": {
    id: "08.jpg",
    gender: "male",
    hasHelmet: false,
    title: "Lunar Cyber Sentinel",
    subtitle: "Neon-Blue Tactical Trench • Full Blue Moon",
    badge: "CHARACTER 03",
    cropHeight: 520,
  },
  "09.jpg": {
    id: "09.jpg",
    gender: "male",
    hasHelmet: true,
    title: "Deep Space Voyager",
    subtitle: "Cobalt-Blue Spacesuit • Sapphire Ringed Planet",
    badge: "CHARACTER 04",
    cropHeight: 520,
  },
  "10.jpg": {
    id: "10.jpg",
    gender: "male",
    hasHelmet: false,
    title: "Emerald Horizon Commander",
    subtitle: "White-Titanium Chest Armor • Aurora Moonscape",
    badge: "CHARACTER 05",
    cropHeight: 520,
  },
};

function getVFSTemplates() {
  const imageExts = new Set([".jpg", ".jpeg", ".png", ".webp"]);
  const male = [];
  const female = [];

  if (!fs.existsSync(VFS_DIR)) {
    return { male, female, all: [] };
  }

  const buildItem = (filePath, fileName, explicitGender) => {
    const lower = fileName.toLowerCase();
    const known = TEMPLATE_META[fileName] || TEMPLATE_META[lower];
    let gender = explicitGender || known?.gender;
    if (!gender) {
      if (lower.startsWith("female") || lower.startsWith("f_") || lower.startsWith("f-")) {
        gender = "female";
      } else {
        gender = "male";
      }
    }

    const indexInGender = (gender === "female" ? female.length : male.length) + 1;
    let mtime = 0;
    try {
      mtime = Math.floor(fs.statSync(filePath).mtimeMs);
    } catch (_) { }

    const relFromVfs = path.relative(VFS_DIR, filePath).split(path.sep).map(encodeURIComponent).join("/");
    const item = {
      id: fileName,
      fileName,
      gender,
      hasHelmet: Boolean(known?.hasHelmet),
      url: `/VFS/${relFromVfs}${mtime ? `?v=${mtime}` : ""}`,
      title:
        known?.title ||
        `${gender === "female" ? "Female" : "Male"} Cosmic Explorer ${indexInGender}`,
      subtitle: known?.subtitle || "Rendezvous 2026 • The Cosmic Sphere",
      badge: known?.badge || `CHARACTER 0${indexInGender}`,
      filePath,
      cropHeight: known?.cropHeight || null,
    };

    if (gender === "female") {
      female.push(item);
    } else {
      male.push(item);
    }
  };

  // 1. Scan separated gender folders (public/VFS/male and public/VFS/female)
  for (const genderFolder of ["male", "female"]) {
    const subDir = path.join(VFS_DIR, genderFolder);
    if (fs.existsSync(subDir) && fs.statSync(subDir).isDirectory()) {
      const subFiles = fs
        .readdirSync(subDir)
        .filter((f) => {
          const full = path.join(subDir, f);
          return fs.statSync(full).isFile() && imageExts.has(path.extname(f).toLowerCase());
        })
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      subFiles.forEach((fileName) => {
        buildItem(path.join(subDir, fileName), fileName, genderFolder);
      });
    }
  }

  // 2. Also scan any top-level template files in public/VFS (excluding vfs_banner.png)
  const rootFiles = fs
    .readdirSync(VFS_DIR)
    .filter((f) => {
      if (f.toLowerCase() === "vfs_banner.png") return false;
      const full = path.join(VFS_DIR, f);
      return fs.statSync(full).isFile() && imageExts.has(path.extname(f).toLowerCase());
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  rootFiles.forEach((fileName) => {
    buildItem(path.join(VFS_DIR, fileName), fileName, null);
  });

  return { male, female, all: [...male, ...female] };
}

// Helper: Upload generated image to Cloudinary
async function uploadToCloudinary(base64DataUri) {
  dotenv.config({ override: true });
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || "dzz5belph").trim();
  const primaryPreset = (process.env.CLOUDINARY_UPLOAD_PRESET || "superhero_photobooth").trim();
  const folderName = (process.env.CLOUDINARY_FOLDER || "vfs_cosmic_photobooth").trim();

  const presetsToTry = Array.from(
    new Set([
      primaryPreset,
      "superhero_photobooth",
      "Garnier_photobooth",
      "garnier_photobooth",
      "golf_photobooth",
      "illumina_photobooth",
      "sbs_photobooth",
    ])
  );

  for (const preset of presetsToTry) {
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: base64DataUri,
          upload_preset: preset,
          folder: folderName,
        }),
      });

      const data = await res.json();
      if (data && data.secure_url) {
        console.log(`[Cloudinary] Upload success (preset="${preset}"):`, data.secure_url);
        return data.secure_url;
      }
    } catch (err) {
      console.warn(`[Cloudinary] Preset "${preset}" warning:`, err?.message || err);
    }
  }

  return null;
}

// Endpoint: Health / Config (lists VFS male and female character templates)
app.get("/api/config", (req, res) => {
  const pools = getVFSTemplates();
  const serialize = ({ filePath, cropHeight, hasHelmet, ...publicItem }) => publicItem;
  res.json({
    mode: "vfs-gender-and-character-selection",
    event: "VFS Global — Rendezvous 2026: The Cosmic Sphere",
    maleTemplateCount: pools.male.length,
    femaleTemplateCount: pools.female.length,
    templates: {
      male: pools.male.map(serialize),
      female: pools.female.map(serialize),
    },
  });
});

// Endpoint: Serve local fallback photo by ID for QR scanning if offline
app.get("/api/photo/:id", (req, res) => {
  const photo = imageStore.get(req.params.id);
  if (!photo) {
    return res.status(404).send("Photo not found or expired");
  }
  const imgBuffer = Buffer.from(photo, "base64");
  res.writeHead(200, {
    "Content-Type": "image/jpeg",
    "Content-Length": imgBuffer.length,
    "Content-Disposition": `inline; filename="vfs_cosmic_${req.params.id}.jpg"`,
  });
  res.end(imgBuffer);
});

// Endpoint: Generate VFS Cosmic Astronaut Portrait with Selected Gender & Character Template
app.post("/api/generate", async (req, res) => {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(500).json({
        error: "OpenAI API key is missing. Please set OPENAI_API_KEY in the .env file.",
      });
    }

    const { photo, gender, templateId } = req.body;
    if (!photo) {
      return res.status(400).json({ error: "Please capture or upload a photo first." });
    }

    const pools = getVFSTemplates();
    const requestedGender =
      typeof gender === "string" && gender.trim().toLowerCase() === "female" ? "female" : "male";

    // Match explicit templateId first, otherwise fall back to first template of selected gender
    let selectedTemplate = null;
    if (typeof templateId === "string" && templateId.trim() !== "") {
      const cleanId = path.basename(templateId.trim());
      selectedTemplate = pools.all.find(
        (t) => t.id.toLowerCase() === cleanId.toLowerCase()
      );
    }
    if (!selectedTemplate) {
      const genderPool = pools[requestedGender]?.length ? pools[requestedGender] : pools.all;
      selectedTemplate = genderPool[0] || null;
    }

    if (!selectedTemplate || !fs.existsSync(selectedTemplate.filePath)) {
      return res.status(500).json({
        error: `Selected VFS character template not found in public/VFS.`,
      });
    }

    const targetGender = selectedTemplate.gender;
    const imageModel = (process.env.IMAGE_MODEL || "gpt-image-2.5-flare").trim();
    const imageSize = (process.env.IMAGE_SIZE || "1024x1536").trim();
    const imageQuality = (process.env.IMAGE_QUALITY || "high").trim();

    const prompt = selectedTemplate.hasHelmet
      ? `
Edit Image 2 (the cosmic astronaut template) by seamlessly replacing ONLY the astronaut's face, head, and hair inside the open helmet with the real ${targetGender} from Image 1 (user selfie). Keep everything else in Image 2—the exact spacesuit, helmet shell, shoulders, torso, arms, hands, gloves (with all 5 natural fingers intact), pose, planets, nebulae, and cosmic background—100% preserved and unchanged.

NATURAL HEAD-TO-HELMET & BODY PROPORTIONS:
- Make the person's face and head slightly LARGER (~10–12% fuller) than the original face in Image 2 so it fills the open helmet opening generously and naturally—leave only a slim, realistic margin around the ears, cheeks, and top of the hair (no wide dark empty void inside the helmet and no small/receded face, while still keeping realistic human proportions to the shoulders and neck collar).
- Preserve 100% of the person's recognizable facial identity from Image 1: exact face shape, eyes, eyebrows, nose, lips, skin tone, jawline, natural hair, facial hair (beard/mustache or clean-shaven), and eyeglasses/bindi/earrings if worn.
- Keep the face completely clear and unobstructed inside the open helmet, with a natural, warm, confident expression.

SEAMLESS LIGHTING & ANATOMY INTEGRITY:
- Relight the face, neck, and hair to match Image 2's exact studio helmet key light, shadows, subtle colored cosmic rim light, skin texture, and cinematic color grading so it looks organically photographed in a single exposure.
- Keep both gloved hands anatomically accurate with all 5 fingers (thumb + 4 fingers) exactly as shown in Image 2—never alter, merge, or drop fingers.
- Keep the frame completely free of any text, banners, logos, or watermarks (the official event banner is composited separately).
      `.trim()
      : `
Edit Image 2 (the cosmic character template) by seamlessly replacing ONLY the character's face, head, and hairstyle with the real ${targetGender} from Image 1 (user selfie), blended naturally into Image 2's exact art style and lighting. Keep everything else in Image 2—the exact outfit, armor, cloak/coat, collar, shoulders, torso, arms, hands/gloves, pose, moon, planets, nebulae, and cosmic background—100% preserved and unchanged.

IDENTITY & PROPORTIONS:
- Preserve 100% of the person's recognizable facial identity from Image 1: exact face shape, eyes, eyebrows, nose, lips, skin tone, jawline, natural hair, facial hair (beard/mustache or clean-shaven), and eyeglasses/bindi/earrings if worn.
- Match the exact head size, neck alignment, and shoulder proportions of the character in Image 2 with a confident, natural expression.
- If Image 2 has any exposed skin on the neck or arms, match its tone harmoniously with the user's skin tone while preserving any cybernetic details, tattoos, or armor pieces from Image 2.

SEAMLESS STYLE, LIGHTING & ANATOMY INTEGRITY:
- Render and relight the face, neck, and hair to match Image 2's exact cosmic key light, rim light, shading, and visual rendering style so the head and body look created together in one unified artwork.
- Keep both hands anatomically accurate exactly as shown in Image 2—never alter, merge, or drop fingers.
- Keep the frame completely free of any text, banners, logos, or watermarks (the official event banner is composited separately).
      `.trim();

    // Prepare user selfie PNG
    const rawSelfieBase64 = photo.replace(/^data:image\/[a-zA-Z0-9.+]+;base64,/, "");
    const selfieBuffer = Buffer.from(rawSelfieBase64, "base64");

    const cleanSelfiePng = await sharp(selfieBuffer)
      .rotate()
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 8 })
      .toBuffer();

    const selfieFile = await OpenAI.toFile(cleanSelfiePng, "user_selfie.png", { type: "image/png" });

    // Prepare clean banner-free cosmic reference PNG from selected VFS template so AI renders pure cosmic art
    const templateMeta = await sharp(selectedTemplate.filePath).metadata();
    let templatePipeline = sharp(selectedTemplate.filePath);
    if (
      selectedTemplate.cropHeight &&
      templateMeta.width &&
      templateMeta.height &&
      selectedTemplate.cropHeight < templateMeta.height
    ) {
      templatePipeline = templatePipeline.extract({
        left: 0,
        top: 0,
        width: templateMeta.width,
        height: selectedTemplate.cropHeight,
      });
    }

    const cleanTemplatePng = await templatePipeline
      .resize(1024, 1536, { fit: "cover", position: "top" })
      .png({ compressionLevel: 8 })
      .toBuffer();

    const templateFile = await OpenAI.toFile(cleanTemplatePng, "vfs_template.png", {
      type: "image/png",
    });

    console.log(
      `[Generate] Model="${imageModel}", Quality="${imageQuality}", Gender="${targetGender}", Template="${selectedTemplate.fileName}"`
    );

    const supportsInputFidelity = imageModel.startsWith("gpt-image-1");
    let editResponse = null;
    try {
      editResponse = await openai.images.edit({
        model: imageModel,
        image: [selfieFile, templateFile],
        prompt: prompt,
        size: imageSize,
        quality: imageQuality,
        ...(supportsInputFidelity ? { input_fidelity: "high" } : {}),
      });
    } catch (fidelityErr) {
      if (!supportsInputFidelity) throw fidelityErr;
      console.warn(
        "[Generate] Retrying edit without input_fidelity:",
        fidelityErr?.message || fidelityErr
      );
      const retrySelfie = await OpenAI.toFile(cleanSelfiePng, "user_selfie.png", {
        type: "image/png",
      });
      const retryTemplate = await OpenAI.toFile(cleanTemplatePng, "vfs_template.png", {
        type: "image/png",
      });
      editResponse = await openai.images.edit({
        model: imageModel,
        image: [retrySelfie, retryTemplate],
        prompt: prompt,
        size: imageSize,
        quality: imageQuality,
      });
    }

    let generatedBuffer = null;
    if (editResponse?.data?.[0]?.b64_json) {
      generatedBuffer = Buffer.from(editResponse.data[0].b64_json, "base64");
    } else if (editResponse?.data?.[0]?.url) {
      const imgFetch = await fetch(editResponse.data[0].url);
      const arrBuf = await imgFetch.arrayBuffer();
      generatedBuffer = Buffer.from(arrBuf);
    } else {
      throw new Error("No image returned from AI model.");
    }

    // Resize to exact 1024x1536 (4x6 print ratio) and composite crisp official VFS Rendezvous 2026 white footer banner
    const BANNER_HEIGHT = 217;
    const ART_HEIGHT = 1536 - BANNER_HEIGHT;
    let finalPipeline = sharp(generatedBuffer).resize(1024, 1536, {
      fit: "cover",
      position: "top",
    });

    if (fs.existsSync(BANNER_OVERLAY_PATH)) {
      const bannerBuf = await sharp(BANNER_OVERLAY_PATH)
        .resize(1024, BANNER_HEIGHT, { fit: "fill" })
        .png()
        .toBuffer();
      finalPipeline = sharp(generatedBuffer)
        .resize(1024, ART_HEIGHT, { fit: "cover", position: "center" })
        .extend({
          top: 0,
          bottom: BANNER_HEIGHT,
          left: 0,
          right: 0,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .composite([
          {
            input: bannerBuf,
            top: ART_HEIGHT,
            left: 0,
          },
        ]);
    }

    const finalBuffer = await finalPipeline.jpeg({ quality: 94, mozjpeg: true }).toBuffer();

    const finalBase64 = finalBuffer.toString("base64");
    const finalDataUri = `data:image/jpeg;base64,${finalBase64}`;

    // Upload to Cloudinary for instant mobile QR download
    const cloudinaryUrl = await uploadToCloudinary(finalDataUri);

    // Save in memory fallback store
    const photoId = `cosmic_${Date.now()}`;
    imageStore.set(photoId, finalBase64);
    if (imageStore.size > 50) {
      const oldestKey = imageStore.keys().next().value;
      imageStore.delete(oldestKey);
    }

    const publicUrl = cloudinaryUrl || `${req.protocol}://${req.get("host")}/api/photo/${photoId}`;

    // Generate QR Code Data URL
    let qrCodeDataUrl = null;
    try {
      qrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
        width: 380,
        margin: 1,
        color: {
          dark: "#070b18",
          light: "#ffffff",
        },
      });
    } catch (qrErr) {
      console.warn("[QR] Generation error:", qrErr?.message);
    }

    return res.json({
      success: true,
      image: finalDataUri,
      publicUrl: publicUrl,
      cloudinaryUploaded: Boolean(cloudinaryUrl),
      qrCode: qrCodeDataUrl,
      selectedGender: targetGender,
      templateUsed: selectedTemplate.fileName,
    });
  } catch (err) {
    console.error("[Generate Error]:", err);
    return res.status(500).json({
      error: err?.message || "Failed to generate your cosmic portrait. Please try again.",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  const nets = os.networkInterfaces();
  let localIP = "localhost";
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        localIP = net.address;
        break;
      }
    }
  }
  console.log(`VFS Cosmic Photobooth running locally:  http://localhost:${PORT}`);
  console.log(`VFS Cosmic Photobooth on local network: http://${localIP}:${PORT}`);
});
