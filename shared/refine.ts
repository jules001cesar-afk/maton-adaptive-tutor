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

const MIN_WIDTH_RATIO = 0.2;

const centerX = (b: PixelBox) => (b.x1 + b.x2) / 2;
const centerY = (b: PixelBox) => (b.y1 + b.y2) / 2;
const union = (boxes: PixelBox[]): PixelBox => ({
  x1: Math.min(...boxes.map((b) => b.x1)),
  y1: Math.min(...boxes.map((b) => b.y1)),
  x2: Math.max(...boxes.map((b) => b.x2)),
  y2: Math.max(...boxes.map((b) => b.y2)),
});

/**
 * On one line the model often repeats earlier steps inside a later one: "47 + 38" and
 * then "47 + 38 = 75" for the whole line. What the later step adds is only what lies to
 * the right of the earlier one ("= 75"), so trim it to that part. The model's edge can
 * cut through a digit, so the border moves to the gap between SAM numbers just after
 * it, which is where the "=" was written.
 */
export function ownParts(steps: PixelBox[], numbers: PixelBox[] = []): PixelBox[] {
  const xs = [...numbers].sort((a, b) => a.x1 - b.x1);
  const border = (e: PixelBox, line: PixelBox) => {
    // The model's edge tends to stop just short of the earlier step's last digit, so the
    // border is the first real gap from there on (the "=" between the steps).
    const from = e.x2 - 20;
    const reach = e.x2 + 0.4 * (e.x2 - e.x1);
    const onLine = xs.filter((n) => centerY(n) >= line.y1 && centerY(n) <= line.y2);
    for (let k = 1; k < onLine.length; k++) {
      const gap = onLine[k].x1 - onLine[k - 1].x2;
      const at = (onLine[k].x1 + onLine[k - 1].x2) / 2;
      if (gap >= 25 && at >= from && at <= reach) return at;
    }
    return e.x2;
  };
  return steps.map((s, i) => {
    let x1 = s.x1;
    for (let j = 0; j < i; j++) {
      const e = steps[j];
      const sameLine = e.y1 < s.y2 && s.y1 < e.y2;
      const covered = Math.max(0, Math.min(e.x2, s.x2) - Math.max(e.x1, s.x1)) >= 0.7 * (e.x2 - e.x1);
      if (sameLine && covered && e.x2 < s.x2) x1 = Math.max(x1, border(e, s));
    }
    return { ...s, x1 };
  });
}

/**
 * Muse Spark's boxes can sit a little off on the page, mostly vertically (on portrait
 * photos they drift down, by a whole line on tightly written work). Find the vertical
 * stretch and shift that make the model's boxes cover the most SAM numbers, with every
 * step covering at least one, and prefer the smallest correction on ties.
 */
export function alignToNumbers(steps: PixelBox[], numbers: PixelBox[]): PixelBox[] {
  if (!steps.length || !numbers.length) return steps;
  const top = Math.min(...steps.map((s) => s.y1));
  const bottom = Math.max(...steps.map((s) => s.y2));
  const span = Math.max(bottom - top, 1);
  const centers = numbers.map((n) => ({ x: centerX(n), y: centerY(n) }));
  const move = (b: PixelBox, k: number, dy: number): PixelBox => ({
    x1: b.x1,
    x2: b.x2,
    y1: top + (b.y1 - top) * k + dy,
    y2: top + (b.y2 - top) * k + dy,
  });
  let best = { score: -1, cost: Infinity, k: 1, dy: 0 };
  for (let k = 0.8; k <= 1.2001; k += 0.025) {
    for (let f = -0.6; f <= 0.6001; f += 0.02) {
      const dy = f * span;
      const boxes = steps.map((s) => move(s, k, dy));
      const covered = boxes.map((b) => centers.filter((c) => c.x >= b.x1 && c.x <= b.x2 && c.y >= b.y1 && c.y <= b.y2).length);
      const inside = centers.filter((c) => boxes.some((b) => c.x >= b.x1 && c.x <= b.x2 && c.y >= b.y1 && c.y <= b.y2)).length;
      const score = inside + (covered.every((n) => n > 0) ? numbers.length : 0);
      const cost = Math.abs(k - 1) + Math.abs(f);
      if (score > best.score || (score === best.score && cost < best.cost)) best = { score, cost, k, dy };
    }
  }
  return steps.map((s) => move(s, best.k, best.dy));
}

/**
 * Tight boxes for every step. The model's boxes are first aligned to the numbers SAM
 * found. When steps are written on one line and chained by "=", the "=" signs are the
 * true borders between steps (the model's boxes can drift sideways), so each number
 * goes to the segment between two "=" signs. Otherwise each number goes to the one
 * step box that holds it (the nearest centre when boxes overlap), so marks never
 * share a number.
 */
export function refineSteps(steps: PixelBox[], numbers: PixelBox[], equals: PixelBox[]): { box: PixelBox; refined: boolean }[] {
  const shifted = alignToNumbers(steps, numbers);
  const own = ownParts(shifted, numbers);
  // An earlier step ends where a later one on its line begins.
  const aligned = shifted.map((b, i) => {
    const next = own.find((o, k) => k > i && o.x1 > b.x1 && o.x1 < b.x2 && o.y1 < b.y2 && b.y1 < o.y2);
    return { ...own[i], x2: next ? Math.min(own[i].x2, next.x1) : own[i].x2 };
  });
  const holds = (b: PixelBox, x: number, y: number, margin: number) => {
    // Never less than a few pixels: the model's edge often stops just short of the last digit.
    const mx = margin ? Math.max((b.x2 - b.x1) * margin, 30) : 0;
    const my = margin ? Math.max((b.y2 - b.y1) * margin, 15) : 0;
    return x >= b.x1 - mx && x <= b.x2 + mx && y >= b.y1 - my && y <= b.y2 + my;
  };
  const owner = numbers.map((n) => {
    const cx = centerX(n);
    const cy = centerY(n);
    // A box that holds the number outright wins over one that only reaches it with the margin.
    let holders = aligned.map((b, i) => ({ i, b })).filter(({ b }) => holds(b, cx, cy, 0));
    if (!holders.length) holders = aligned.map((b, i) => ({ i, b })).filter(({ b }) => holds(b, cx, cy, 0.08));
    if (!holders.length) return -1;
    holders.sort((a, b) => Math.hypot(centerX(a.b) - cx, centerY(a.b) - cy) - Math.hypot(centerX(b.b) - cx, centerY(b.b) - cy));
    return holders[0].i;
  });
  const result = aligned.map((box, i) => {
    const mine = numbers.filter((_, j) => owner[j] === i);
    if (!mine.length) return { box, refined: false };
    const tight = union(mine);
    // SAM missed part of the step (only the "x" of "x = 17"): keep the model's width,
    // unless that would reach into numbers that belong to another step.
    if (tight.x2 - tight.x1 < 0.5 * (box.x2 - box.x1)) {
      const wide = union([tight, box]);
      const takesOthers = numbers.some((n, j) => owner[j] !== i && owner[j] !== -1 && centerX(n) > wide.x1 && centerX(n) < wide.x2 && centerY(n) > wide.y1 && centerY(n) < wide.y2);
      if (!takesOthers) return { box: wide, refined: true };
    }
    return { box: tight, refined: true };
  });
  // Group steps that share a line (their vertical ranges overlap), in reading order.
  const lines: number[][] = [];
  for (const i of aligned.map((_, i) => i).sort((a, b) => centerY(aligned[a]) - centerY(aligned[b]))) {
    const line = lines.find((l) => l.some((j) => aligned[j].y1 < aligned[i].y2 && aligned[i].y1 < aligned[j].y2));
    if (line) line.push(i);
    else lines.push([i]);
  }
  for (const line of lines) {
    if (line.length < 2) continue;
    line.sort((a, b) => centerX(aligned[a]) - centerX(aligned[b]));
    const band = union(line.map((i) => aligned[i]));
    const signs = equals
      .filter((e) => centerY(e) >= band.y1 && centerY(e) <= band.y2)
      .map(centerX)
      .sort((a, b) => a - b);
    if (signs.length !== line.length - 1) continue; // cannot tell the borders apart
    // Each "=" must sit between the two steps it separates; otherwise SAM picked up
    // something else (a fraction bar, a stray mark) and the borders cannot be trusted.
    const ordered = signs.every((x, k) => x > centerX(aligned[line[k]]) && x < centerX(aligned[line[k + 1]]));
    if (!ordered) continue;
    const inBand = numbers.filter((n) => centerY(n) >= band.y1 - 50 && centerY(n) <= band.y2 + 50);
    line.forEach((stepIndex, k) => {
      const left = k === 0 ? -Infinity : signs[k - 1];
      const right = k === line.length - 1 ? Infinity : signs[k];
      const mine = inBand.filter((n) => centerX(n) > left && centerX(n) < right);
      if (!mine.length) return;
      const box = union(mine);
      // A step shrunk to a sliver of the model's box means a single digit was caught.
      const coarse = aligned[stepIndex];
      if (box.x2 - box.x1 < MIN_WIDTH_RATIO * (coarse.x2 - coarse.x1)) return;
      result[stepIndex] = { box, refined: true };
    });
  }
  return result;
}

/** Boxes from several SAM prompts, without the duplicates (same digit found twice). */
export function mergeBoxes(...lists: PixelBox[][]): PixelBox[] {
  const area = (b: PixelBox) => Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  const overlap = (a: PixelBox, b: PixelBox) =>
    Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const kept: PixelBox[] = [];
  for (const b of lists.flat()) {
    if (!kept.some((k) => overlap(k, b) > 0.5 * Math.min(area(k), area(b)))) kept.push(b);
  }
  return kept;
}
