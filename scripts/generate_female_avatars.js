const dotenv = require("dotenv");
const OpenAI = require("openai");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY.trim(),
});

const REF_PATH = path.join(__dirname, "..", "public", "images", "female", "hero_female2.jpeg");
const OUT_DIR = path.join(__dirname, "..", "public", "images", "female");

const JOBS = [
  {
    name: "hero_female3.jpeg",
    suitPrompt:
      "wearing sculpted matte-obsidian and metallic crimson-red superhero armor with glowing ruby-red chest core lines, glowing crimson energy seam lines along the corset, waist, thighs, and calves, metallic crimson gauntlets, V-waist armor, and armored boots, with a long flowing royal crimson-red cape and subtle glowing crimson energy wisps swirling softly around the waist and arms",
  },
  {
    name: "hero_female4.jpeg",
    suitPrompt:
      "wearing sculpted matte-obsidian and metallic cobalt-blue superhero armor with glowing electric-cyan chest core lines, glowing bright cyan energy seam lines along the corset, waist, thighs, and calves, metallic cobalt gauntlets, V-waist armor, and armored boots, with a long flowing sapphire-blue cape and subtle luminous cyan energy rings swirling softly around the waist and arms",
  },
];

async function generateAvatar(job) {
  console.log(`[Generating Female] ${job.name}...`);

  const refPngBuffer = await sharp(REF_PATH)
    .resize({ width: 1024, height: 1536, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 8 })
    .toBuffer();

  const refFile = await OpenAI.toFile(refPngBuffer, "reference_heroine.png", { type: "image/png" });

  const prompt = `
Create a hyper-realistic live-action studio superhero portrait (vertical 2:3 ratio, 1024x1536) in the EXACT identical photographic art style, framing, lighting, and composition as Image 1:

1. EXACT SAME ART STYLE, FRAMING & COMPOSITION AS IMAGE 1:
- Full-body portrait of a beautiful superheroine standing centered head-to-toe facing forward, feet planted shoulder-width apart on the dark reflective studio floor, fists at her sides, head clearly visible with generous headroom above the hair.
- Dark neutral smoky grey studio backdrop with cinematic rim lighting and subtle floor reflection, exact same studio photography aesthetic as Image 1.
- No helmet, no mask, beautiful athletic heroine with natural long wavy dark hair, clearly lit with soft flattering front studio beauty key light.

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

