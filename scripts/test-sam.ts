// Day-1 check of SAM 3.1 on a notebook photo: does it find handwriting, and where?
//
//   node --env-file=.dev.vars scripts/test-sam.ts test-photos/notebook-1.jpg "handwritten text"
//
// Prints the HTTP status, timing and every box SAM returns (in source pixels).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";

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
const dataUrl = `data:${mime};base64,${(await readFile(photo)).toString("base64")}`;

const started = Date.now();
const res = await fetch("https://api.meta.ai/v1/responses", {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "sam-3.1",
    stream: false,
    input: [
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: dataUrl },
        ],
      },
    ],
  }),
  signal: AbortSignal.timeout(120_000),
});
const raw = await res.text();
console.log(`sam-3.1 | prompt "${prompt}" | HTTP ${res.status} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
if (!res.ok) {
  console.error(raw.slice(0, 1500));
  process.exit(1);
}

const payload = JSON.parse(raw);
// Collect output text from either the convenience field or the output items.
const text: string =
  payload.output_text ??
  (payload.output ?? [])
    .flatMap((o: { content?: { text?: string }[] }) => o.content ?? [])
    .map((c: { text?: string }) => c.text ?? "")
    .join("");

const boxes = [...text.matchAll(/<\|box;([^|]*)\|>/g)].map((m) =>
  Object.fromEntries(m[1].split(";").map((kv) => kv.split("=")).map(([k, v]) => [k, Number(v)])),
);
const masks = [...text.matchAll(/<\|mask;/g)].length;
console.log(`boxes: ${boxes.length} | masks: ${masks} | output chars: ${text.length}`);
boxes.forEach((b, i) => console.log(`  ${i}: x ${b.x1}-${b.x2}, y ${b.y1}-${b.y2} (frame ${b.w}x${b.h})${b.c !== undefined ? ` conf ${b.c}` : ""}`));
if (!boxes.length) console.log(`raw output start: ${JSON.stringify(text.slice(0, 300))}`);

await mkdir("test-results", { recursive: true });
const out = `test-results/sam-${prompt.replace(/\W+/g, "-")}-${Date.now()}.json`;
await writeFile(out, JSON.stringify({ prompt, status: res.status, boxes, text, payload }, null, 2));
console.log(`Saved: ${out}`);
