// Photo -> marked steps + Kreyòl explanation + next exercise.
// Muse Spark and the two SAM 3.1 calls run at the same time; SAM only sharpens the
// marks, so if it fails the model's own boxes are used.
import { diagnoseWork, type DiagnosisRun } from "./diagnose.ts";
import { gridToPixels, refineSteps, type PixelBox } from "./refine.ts";
import { samBoxes } from "./sam-client.ts";
import type { Level } from "./practice.ts";

export type MarkedStep = {
  text: string;
  /** From code verification when it could check the step, else the model's opinion. */
  status: "correct" | "wrong";
  checkedBy: "code" | "model";
  box: PixelBox;
  preciseMark: boolean;
};

export type PhotoAnalysis = {
  run: DiagnosisRun;
  steps: MarkedStep[];
  sam: { ok: boolean; numbers: number; equals: number };
};

export async function analyzePhoto(opts: {
  apiKey: string;
  mime: string;
  base64: string;
  width: number;
  height: number;
  level?: Level;
}): Promise<PhotoAnalysis> {
  const imageDataUrl = `data:${opts.mime};base64,${opts.base64}`;
  const sam = (prompt: string) => samBoxes({ apiKey: opts.apiKey, imageDataUrl, prompt }).then((r) => r.boxes);

  const [run, numbers, equals] = await Promise.all([
    diagnoseWork({ photo: { mime: opts.mime, base64: opts.base64 } }, { apiKey: opts.apiKey, level: opts.level }),
    sam("number").catch(() => null),
    sam("equals sign").catch(() => null),
  ]);

  const coarse = run.diagnosis.steps.map((s) => gridToPixels(s.box, opts.width, opts.height));
  const samOk = numbers !== null && equals !== null;
  const marks = samOk ? refineSteps(coarse, numbers, equals) : coarse.map((box) => ({ box, refined: false }));

  const steps: MarkedStep[] = run.diagnosis.steps.map((s, i) => {
    const codeSays = run.verification?.steps[i]?.matches ?? null;
    return {
      text: s.text,
      status: (codeSays ?? s.is_correct) ? "correct" : "wrong",
      checkedBy: codeSays === null ? "model" : "code",
      box: marks[i].box,
      preciseMark: marks[i].refined,
    };
  });

  return { run, steps, sam: { ok: samOk, numbers: numbers?.length ?? 0, equals: equals?.length ?? 0 } };
}
