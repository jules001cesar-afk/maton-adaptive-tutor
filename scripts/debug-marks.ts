// Records everything the marks are built from, so refine.ts can be tuned on real photos:
// the model's step boxes, SAM's number and "=" boxes, and the final marks.
//
//   node --env-file=.dev.vars scripts/debug-marks.ts <photo.jpg> <width> <height>
//
// Writes test-results/marks-<photo name>.json (boxes only, no photo, no key).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import { diagnoseWork } from "../shared/diagnose.ts";
import { gridToPixels, mergeBoxes, refineSteps } from "../shared/refine.ts";
import { samBoxes } from "../shared/sam-client.ts";

const apiKey = process.env.MODEL_API_KEY?.trim();
if (!apiKey) {
  console.error("MODEL_API_KEY is empty.");
  process.exit(1);
}
const [photo, w, h] = process.argv.slice(2);
const width = Number(w);
const height = Number(h);
if (!photo || !width || !height) {
  console.error("Usage: scripts/debug-marks.ts <photo> <width> <height>");
  process.exit(1);
}
const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[extname(photo).toLowerCase()] ?? "image/jpeg";
const base64 = (await readFile(photo)).toString("base64");
const imageDataUrl = `data:${mime};base64,${base64}`;
const sam = (prompt: string) => samBoxes({ apiKey, imageDataUrl, prompt }).then((r) => r.boxes);

const [run, printed, handwritten, equals, blocks] = await Promise.all([
  diagnoseWork({ photo: { mime, base64 } }, { apiKey }),
  sam("number"),
  sam("handwritten number"),
  sam("equals sign"),
  sam("mathematical expression"),
]);
const block = blocks[0] ?? null;
const numbers = mergeBoxes(printed, handwritten);
const steps = run.diagnosis.steps.map((s, i) => ({
  text: s.text,
  correct: run.verification?.steps[i]?.matches ?? s.is_correct,
  coarse: gridToPixels(s.box, width, height),
}));
const marks = refineSteps(steps.map((s) => s.coarse), numbers, equals, block, steps.map((s) => s.text));

const result = { photo: basename(photo), width, height, transcription: run.diagnosis.transcription, steps, numbers, equals, block, marks };
await mkdir("test-results", { recursive: true });
const out = `test-results/marks-${basename(photo, extname(photo))}.json`;
await writeFile(out, JSON.stringify(result, null, 1));
console.log(run.diagnosis.transcription);
steps.forEach((s, i) => console.log(`  ${s.correct ? "ok " : "BAD"} ${s.text.padEnd(16)} model y ${Math.round(s.coarse.y1)}-${Math.round(s.coarse.y2)} x ${Math.round(s.coarse.x1)}-${Math.round(s.coarse.x2)} -> mark y ${Math.round(marks[i].box.y1)}-${Math.round(marks[i].box.y2)} x ${Math.round(marks[i].box.x1)}-${Math.round(marks[i].box.x2)}`));
console.log(`SAM: ${numbers.length} numbers (${printed.length} + ${handwritten.length} before merge), ${equals.length} "=" | ${out}`);
