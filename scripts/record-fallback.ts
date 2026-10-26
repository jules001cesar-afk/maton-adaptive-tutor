// Records one real Meta run on the demo photo as the clearly labeled fallback the site
// shows when the Meta API is unreachable.
//
//   node --env-file=.dev.vars scripts/record-fallback.ts
import { readFile, writeFile } from "node:fs/promises";

import { publicAnalysis } from "../shared/api.ts";
import { analyzePhoto } from "../shared/photo-pipeline.ts";

const apiKey = process.env.MODEL_API_KEY?.trim();
if (!apiKey) {
  console.error("MODEL_API_KEY is empty.");
  process.exit(1);
}

const photo = "public/demo/notebook-1.jpg"; // 1200 x 1600, no EXIF
const base64 = (await readFile(photo)).toString("base64");
const analysis = await analyzePhoto({ apiKey, mime: "image/jpeg", base64, width: 1200, height: 1600 });
const recorded = {
  ...publicAnalysis(analysis, 1),
  source: "recorded",
  recordedAt: new Date().toISOString(),
  photo: "/demo/notebook-1.jpg",
  width: 1200,
  height: 1600,
};
await writeFile("src/fallback-data.json", JSON.stringify(recorded, null, 2) + "\n");
console.log(`Recorded in ${analysis.run.meta.seconds.toFixed(1)}s, marks from ${recorded.marksFrom}.`);
for (const s of recorded.steps) console.log(`  ${s.status.padEnd(7)} ${s.text}  (${s.checkedBy}, precise ${s.preciseMark})`);
