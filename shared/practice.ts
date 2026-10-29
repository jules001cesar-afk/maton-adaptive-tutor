// New practice problems are made by code, so their answers are always right.
// The model only writes the Kreyòl around them.
import { findMisconception, type Operation } from "./misconceptions.ts";
import { checkStep, solveProblem, answerText, type Answer } from "./verify.ts";

export type Level = 1 | 2 | 3;
export type Practice = { problem: string; answer: Answer; answerText: string; misconceptionId: string };

/** Small seeded generator so a demo run can be repeated exactly. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pick = (min: number, max: number) => number;

const MAKERS: Record<string, (pick: Pick, level: Level) => string> = {
  add_no_carry: (pick, level) => {
    if (level === 1) {
      const a = pick(1, 7) * 10 + pick(5, 9);
      return `${a} + ${pick(1, 8 - Math.floor(a / 10)) * 10 + pick(10 - (a % 10), 9)}`;
    }
    return `${pick(120, 480)} + ${pick(15, 99)}`;
  },
  add_place_value_misalign: (pick) => `${pick(120, 899)} + ${pick(11, 98)}`,
  sub_smaller_from_larger: (pick, level) => {
    const big = level === 1 ? pick(4, 9) * 10 + pick(0, 4) : pick(3, 9) * 100 + pick(1, 9) * 10 + pick(0, 4);
    const small = level === 1 ? pick(1, Math.floor(big / 10) - 1) * 10 + pick((big % 10) + 1, 9) : pick(101, big - 100);
    return `${big} - ${small}`;
  },
  sub_borrow_not_reduced: (pick) => `${pick(3, 9) * 100 + pick(1, 6)} - ${pick(1, 2) * 100 + pick(1, 9) * 10 + pick(7, 9)}`,
  mul_fact_error: (pick, level) => (level === 1 ? `${pick(6, 9)} × ${pick(6, 9)}` : `${pick(12, 19)} × ${pick(3, 9)}`),
  mul_added_instead: (pick) => `${pick(3, 9)} × ${pick(3, 9)}`,
  div_reversed: (pick) => {
    const d = pick(2, 9);
    return `${d * pick(3, 9)} ÷ ${d}`;
  },
  div_remainder_ignored: (pick) => {
    const d = pick(3, 9);
    return `${d * pick(2, 9) + pick(1, d - 1)} ÷ ${d}`;
  },
  frac_add_across: (pick, level) => {
    const max = level === 1 ? 6 : level === 2 ? 10 : 12;
    const b = pick(2, max);
    let d = pick(2, max);
    while (d === b) d = pick(2, max);
    return `${pick(1, b - 1)}/${b} + ${pick(1, d - 1)}/${d}`;
  },
  frac_div_not_inverted: (pick) => `${pick(1, 4)}/${pick(5, 8)} ÷ ${pick(1, 3)}/${pick(4, 9)}`,
  eq_inverse_operation_wrong: (pick) => {
    const [a, x, b] = [pick(2, 6), pick(2, 9), pick(1, 12)];
    return `${a}x + ${b} = ${a * x + b}`;
  },
  eq_divide_wrong: (pick) => {
    const a = pick(2, 9);
    return `${a}x = ${a * pick(2, 9)}`;
  },
  exp_multiply_base_by_exponent: (pick) => {
    const [b, e] = [pick(3, 6), pick(2, 3)];
    return `${b}^${e}`;
  },
};
MAKERS.div_remainder_too_big = MAKERS.div_remainder_ignored;
MAKERS.eq_one_side_only = MAKERS.eq_inverse_operation_wrong;

const BY_OPERATION: Partial<Record<Operation, string>> = {
  addition: "add_no_carry",
  subtraction: "sub_smaller_from_larger",
  multiplication: "mul_fact_error",
  division: "div_remainder_ignored",
  fractions: "frac_add_across",
  equations: "eq_inverse_operation_wrong",
  exponents: "exp_multiply_base_by_exponent",
};

/** Same problem written another way: spaces, "x", "*" or "·" for ×, or the two factors swapped. */
export function sameProblem(a: string, b: string): boolean {
  // Only a sign between two digits is a multiplication; the x in "2x + 7" stays a variable.
  const norm = (s: string) => s.replace(/\s+/g, "").replace(/(?<=\d)[xX*·](?=\d)/g, "×");
  const [x, y] = [norm(a), norm(b)];
  const product = /^(\d+)×(\d+)$/.exec(x);
  return x === y || (!!product && y === `${product[2]}×${product[1]}`);
}

/** A new problem that targets the same misconception, never the student's original one. */
export function makePractice(opts: {
  misconceptionId: string;
  operation: Operation;
  level?: Level;
  seed?: number;
  avoid?: string;
}): Practice | null {
  // With no clear misconception the operation picks the problem; a fraction division
  // should not be practised with a fraction addition.
  const fractionDivision =
    opts.misconceptionId === "insufficient_evidence" && opts.operation === "fractions" && /[÷:]/.test(opts.avoid ?? "");
  const id = MAKERS[opts.misconceptionId]
    ? opts.misconceptionId
    : fractionDivision
      ? "frac_div_not_inverted"
      : BY_OPERATION[opts.operation];
  if (!id || !findMisconception(id)) return null;
  const random = rng(opts.seed ?? Date.now());
  const pick: Pick = (min, max) => min + Math.floor(random() * (max - min + 1));
  for (let i = 0; i < 20; i++) {
    const problem = MAKERS[id](pick, opts.level ?? 1);
    if (opts.avoid && sameProblem(problem, opts.avoid)) continue;
    const answer = solveProblem(problem);
    return { problem, answer, answerText: answerText(answer), misconceptionId: id };
  }
  return null;
}

/** Is the student's answer to a practice problem right? Checked by code only. */
export const checkPracticeAnswer = (practice: Practice, input: string) => checkStep(input, practice.answer).matches === true;
