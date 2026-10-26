// Day-1 check of SAM 3.1 on a notebook photo: does it find handwriting, and where?
//
//   node --env-file=.dev.vars scripts/test-sam.ts test-photos/notebook-1.jpg "number"
//
// Prints the HTTP status, timing and every box SAM returns (in source pixels).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";

import { samBoxes } from "../shared/sam-client.ts";

const apiKey = process.env.MODEL_API_KEY?.trim();
if (!apiKey) {
  console.error("MODEL_API_KEY is empty.");
  process.exit(1);
}
const [photo, prompt = "handwritten text"] = process.argv.slice(2);
if (!photo) {
  console.error("Usage: scripts/test-sam.ts <photo> [noun phrase]");
  process.exit(1);
}
const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[extname(photo).toLowerCase()];
const imageDataUrl = `data:${mime};base64,${(await readFile(photo)).toString("base64")}`;

const { boxes, status, seconds } = await samBoxes({ apiKey, imageDataUrl, prompt, timeoutMs: 120_000 });
console.log(`sam-3.1 | prompt "${prompt}" | HTTP ${status} in ${seconds.toFixed(1)}s`);
console.log(`boxes: ${boxes.length}`);
boxes.forEach((b, i) => console.log(`  ${i}: x ${b.x1}-${b.x2}, y ${b.y1}-${b.y2}`));

await mkdir("test-results", { recursive: true });
const out = `test-results/sam-${prompt.replace(/\W+/g, "-")}-${Date.now()}.json`;
await writeFile(out, JSON.stringify({ prompt, status, boxes }, null, 2));
console.log(`Saved: ${out}`);
