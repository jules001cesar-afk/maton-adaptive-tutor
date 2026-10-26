// Muse Spark says roughly where each step is (0-1000 grid); SAM 3.1 finds every
// written number precisely. Snapping a step to the SAM boxes inside it gives a tight
// mark to draw on the student's own page.

export type PixelBox = { x1: number; y1: number; x2: number; y2: number };
export type GridBox = { x_min: number; y_min: number; x_max: number; y_max: number };

export function gridToPixels(b: GridBox, width: number, height: number): PixelBox {
  const clamp = (v: number) => Math.min(1000, Math.max(0, v));
  return {
    x1: (clamp(b.x_min) * width) / 1000,
    y1: (clamp(b.y_min) * height) / 1000,
    x2: (clamp(b.x_max) * width) / 1000,
    y2: (clamp(b.y_max) * height) / 1000,
  };
}

/** Parse SAM 3.1 output tokens: <|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..|> */
export function parseSamBoxes(text: string): PixelBox[] {
  return [...text.matchAll(/<\|box;([^|]*)\|>/g)].map((m) => {
    const f = Object.fromEntries(m[1].split(";").map((kv) => kv.split("=")).map(([k, v]) => [k, Number(v)]));
    return { x1: f.x1, y1: f.y1, x2: f.x2, y2: f.y2 };
  });
}

/**
 * Tighten a step's box to the SAM boxes whose centre lies inside it (with a margin,
 * since the model's boxes are approximate). Falls back to the model's box when SAM
 * found nothing there.
 */
export function refineStepBox(step: PixelBox, sam: PixelBox[], marginRatio = 0.08): { box: PixelBox; refined: boolean } {
  const mx = (step.x2 - step.x1) * marginRatio;
  const my = (step.y2 - step.y1) * marginRatio;
  const inside = sam.filter((b) => {
    const cx = (b.x1 + b.x2) / 2;
    const cy = (b.y1 + b.y2) / 2;
    return cx >= step.x1 - mx && cx <= step.x2 + mx && cy >= step.y1 - my && cy <= step.y2 + my;
  });
  if (!inside.length) return { box: step, refined: false };
  return { box: union(inside), refined: true };
}

const centerX = (b: PixelBox) => (b.x1 + b.x2) / 2;
const centerY = (b: PixelBox) => (b.y1 + b.y2) / 2;
const union = (boxes: PixelBox[]): PixelBox => ({
  x1: Math.min(...boxes.map((b) => b.x1)),
  y1: Math.min(...boxes.map((b) => b.y1)),
  x2: Math.max(...boxes.map((b) => b.x2)),
  y2: Math.max(...boxes.map((b) => b.y2)),
});

/**
 * Tight boxes for every step. When steps are written on one line and chained by "=",
 * the "=" signs SAM finds are the true borders between steps (the model's boxes can
 * drift sideways), so each number goes to the segment between two "=" signs.
 * Other layouts (one step per line) fall back to refineStepBox.
 */
export function refineSteps(steps: PixelBox[], numbers: PixelBox[], equals: PixelBox[]): { box: PixelBox; refined: boolean }[] {
  const result = steps.map((s) => refineStepBox(s, numbers));
  // Group steps that share a line (their vertical ranges overlap), in reading order.
  const lines: number[][] = [];
  for (const i of steps.map((_, i) => i).sort((a, b) => centerY(steps[a]) - centerY(steps[b]))) {
    const line = lines.find((l) => l.some((j) => steps[j].y1 < steps[i].y2 && steps[i].y1 < steps[j].y2));
    if (line) line.push(i);
    else lines.push([i]);
  }
  for (const line of lines) {
    if (line.length < 2) continue;
    line.sort((a, b) => centerX(steps[a]) - centerX(steps[b]));
    const band = union(line.map((i) => steps[i]));
    const signs = equals
      .filter((e) => centerY(e) >= band.y1 && centerY(e) <= band.y2)
      .map(centerX)
      .sort((a, b) => a - b);
    if (signs.length !== line.length - 1) continue; // cannot tell the borders apart
    const inBand = numbers.filter((n) => centerY(n) >= band.y1 - 50 && centerY(n) <= band.y2 + 50);
    line.forEach((stepIndex, k) => {
      const left = k === 0 ? -Infinity : signs[k - 1];
      const right = k === line.length - 1 ? Infinity : signs[k];
      const mine = inBand.filter((n) => centerX(n) > left && centerX(n) < right);
      if (mine.length) result[stepIndex] = { box: union(mine), refined: true };
    });
  }
  return result;
}
