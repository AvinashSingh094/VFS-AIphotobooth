const dotenv = require("dotenv");
const OpenAI = require("openai");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY.trim(),
});

const REF_PATH = path.join(__dirname, "..", "public", "images", "male", "hero_male1.jpeg");
const OUT_DIR = path.join(__dirname, "..", "public", "images", "male");

const JOBS = [
  {
    name: "hero_male3.jpeg",
    suitPrompt:
      "wearing sculpted matte-obsidian and metallic cobalt-blue superhero armor with a glowing electric-cyan triangular chest energy core, glowing neon-cyan energy seam lines along the chest, abs, thighs, and calves, metallic cobalt-blue gauntlets, V-belt, and armored boots, with a majestic long flowing sapphire-blue cape draped over his shoulders",
  },
  {
    name: "hero_male4.jpeg",
    suitPrompt:
      "wearing sculpted matte-obsidian and burnished metallic-gold superhero armor with a glowing warm golden geometric chest energy core, glowing radiant gold energy seam lines along the chest, abs, thighs, and calves, metallic gold gauntlets, V-belt, and armored boots, with a majestic long flowing deep golden-amber cape draped over his shoulders",
  },
];

async function generateAvatar(job) {
  console.log(`[Generating] ${job.name}...`);

  const refPngBuffer = await sharp(REF_PATH)
    .resize({ width: 1024, height: 1536, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 8 })
    .toBuffer();

  const refFile = await OpenAI.toFile(refPngBuffer, "reference_hero.png", { type: "image/png" });

  const prompt = `
Create a hyper-realistic live-action studio superhero portrait (vertical 2:3 ratio, 1024x1536) in the EXACT identical photographic art style, framing, lighting, and composition as Image 1:

1. EXACT SAME ART STYLE, FRAMING & COMPOSITION AS IMAGE 1:
- Full-body portrait of a handsome hero standing centered head-to-toe facing forward, feet planted shoulder-width apart on the dark reflective studio floor, fists at his sides, head clearly visible with generous headroom above the hair.
- Dark neutral smoky grey studio backdrop with cinematic rim lighting and subtle floor reflection, exact same studio photography aesthetic as Image 1.
- No helmet, no mask, handsome athletic hero with natural dark wavy hair and light beard, clearly lit with soft flattering front studio key light.

2. NEW CHARACTER COSTUME & COLORS:
- ${job.suitPrompt}.

3. CLEAN TEXT-FREE STUDIO ART:
- No text, logos, watermarks, symbols, comic panels, or borders anywhere on the image.
  `.trim();

  const response = await openai.images.edit({
    model: process.env.IMAGE_MODEL || "gpt-image-2.5-flare",
    image: refFile,
    prompt: prompt,
    size: "1024x1536",
    quality: "high",
  });

  let imgBuf;
  if (response.data?.[0]?.b64_json) {
    imgBuf = Buffer.from(response.data[0].b64_json, "base64");
  } else if (response.data?.[0]?.url) {
    const r = await fetch(response.data[0].url);
    imgBuf = Buffer.from(await r.arrayBuffer());
  } else {
    throw new Error(`No image returned for ${job.name}`);
  }

  const outBuf = await sharp(imgBuf)
    .resize(1024, 1536, { fit: "cover", position: "center" })
    .jpeg({ quality: 95, mozjpeg: true })
    .toBuffer();

  const outPath = path.join(OUT_DIR, job.name);
  fs.writeFileSync(outPath, outBuf);
  console.log(`[Done] Saved ${job.name} (${outBuf.length} bytes) to ${outPath}`);
}

async function main() {
  for (const job of JOBS) {
    try {
      await generateAvatar(job);
    } catch (err) {
      console.error(`[Error] Failed to generate ${job.name}:`, err.message);
    }
  }
}

main();

