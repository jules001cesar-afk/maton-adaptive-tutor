// Re-runs refine.ts on boxes saved by debug-marks.ts, without calling any API.
//   node scripts/replay-marks.ts test-results/marks-<name>.json
import { readFile } from "node:fs/promises";

import { refineSteps, type PixelBox } from "../shared/refine.ts";

for (const file of process.argv.slice(2)) {
  const d = JSON.parse(await readFile(file, "utf8")) as {
    photo: string;
    steps: { text: string; correct: boolean; coarse: PixelBox }[];
    numbers: PixelBox[];
    equals: PixelBox[];
  };
  const marks = refineSteps(d.steps.map((s) => s.coarse), d.numbers, d.equals);
  const r = (b: PixelBox) => `x ${Math.round(b.x1)}-${Math.round(b.x2)} y ${Math.round(b.y1)}-${Math.round(b.y2)}`;
  console.log(d.photo);
  d.steps.forEach((s, i) => console.log(`  ${s.text.padEnd(16)} ${r(marks[i].box)}${marks[i].refined ? "" : " (model box)"}`));
}
