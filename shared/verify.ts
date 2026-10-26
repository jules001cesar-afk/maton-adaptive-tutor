// Checks a student's work step by step with exact math. The model's diagnosis is
// compared against this; when they disagree, this wins.
import { evaluate, solveLinear, type Solution } from "./parse.ts";
import { equals, rat, show, type Rational } from "./rational.ts";

export type Answer =
  | { kind: "value"; value: Rational }
  | { kind: "remainder"; q: number; r: number; divisor: number }
  | { kind: "solution"; solution: Solution };

export type StepCheck = { text: string; shown: string | null; matches: boolean | null; error?: string };

export type Verification = {
  mode: "arithmetic" | "equation";
  correct: Answer;
  correctText: string;
  steps: StepCheck[];
  /** Index of the first step that is mathematically wrong, -1 if none. */
  firstWrongStep: number;
  finalCorrect: boolean | null;
};

const REMAINDER = /^(-?\d+)\s*(?:r|R|rès|res|reste|rest)\.?\s*(\d+)$/;
const INT_DIVISION = /^\s*(\d+)\s*[÷:]\s*(\d+)\s*$/;

export function answerText(a: Answer): string {
  if (a.kind === "value") return show(a.value);
  if (a.kind === "remainder") return a.r === 0 ? String(a.q) : `${a.q} rès ${a.r}`;
  const s = a.solution;
  return s.kind === "one" ? `x = ${show(s.x)}` : s.kind === "all" ? "tout valè" : "pa gen solisyon";
}

function sameSolution(a: Solution, b: Solution): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === "one" && b.kind === "one" ? equals(a.x, b.x) : true;
}

/** The correct answer of a problem such as "1/2 + 1/3", "17 ÷ 5" or "2x + 3 = 11". */
export function solveProblem(problem: string): Answer {
  if (problem.includes("=")) return { kind: "solution", solution: solveLinear(problem) };
  const intDiv = INT_DIVISION.exec(problem);
  if (intDiv) {
    const [a, b] = [Number(intDiv[1]), Number(intDiv[2])];
    if (b !== 0 && a % b !== 0 && a > b) return { kind: "remainder", q: Math.floor(a / b), r: a % b, divisor: b };
  }
  return { kind: "value", value: evaluate(problem) };
}

/** Does one written step (or final answer) still equal the correct answer? */
export function checkStep(text: string, correct: Answer): StepCheck {
  // Steps are often written "= 2/5"; in arithmetic keep the last part of a chain.
  const raw = text.trim().replace(/^=\s*/, "");
  try {
    if (correct.kind === "solution") {
      const step = raw.includes("=") ? raw : `x = ${raw}`;
      const solution = solveLinear(step);
      return { text, shown: answerText({ kind: "solution", solution }), matches: sameSolution(solution, correct.solution) };
    }
    const last = raw.split("=").pop()!.trim();
    const rem = REMAINDER.exec(last);
    if (correct.kind === "remainder") {
      if (rem) {
        const [q, r] = [Number(rem[1]), Number(rem[2])];
        const ok = q === correct.q && r === correct.r; // also rejects a remainder >= the divisor
        return { text, shown: `${q} rès ${r}`, matches: ok };
      }
      const v = evaluate(last);
      // An exact value such as 17/5 or 3.4 is also correct; a bare quotient (3) is not.
      return { text, shown: show(v), matches: equals(v, rat(correct.q * correct.divisor + correct.r, correct.divisor)) };
    }
    if (rem) return { text, shown: last, matches: false };
    const v = evaluate(last);
    return { text, shown: show(v), matches: equals(v, correct.value) };
  } catch (err) {
    return { text, shown: null, matches: null, error: (err as Error).message };
  }
}

export function verifyWork(problem: string, steps: string[], finalAnswer: string): Verification {
  const correct = solveProblem(problem);
  const checks = steps.map((s) => checkStep(s, correct));
  const final = checkStep(finalAnswer, correct);
  return {
    mode: correct.kind === "solution" ? "equation" : "arithmetic",
    correct,
    correctText: answerText(correct),
    steps: checks,
    firstWrongStep: checks.findIndex((c) => c.matches === false),
    finalCorrect: final.matches,
  };
}
