// Representative student mistakes for the evaluation run (scripts/eval.ts).
// `expect` is what a good diagnosis should say; firstWrongStep is checked by code too.
import type { Operation } from "../shared/misconceptions.ts";

export type EvalCase = {
  id: string;
  problem: string;
  work: string;
  /** firstWrongStep null: the work shows column sub-steps, which are not whole-problem values. */
  expect: { operation: Operation; misconception: string; firstWrongStep: number | null };
};

export const CASES: EvalCase[] = [
  {
    id: "frac-add",
    problem: "1/2 + 1/3",
    work: "1/2 + 1/3 = (1+1)/(2+3) = 2/5",
    expect: { operation: "fractions", misconception: "frac_add_across", firstWrongStep: 1 },
  },
  {
    id: "frac-div",
    problem: "1/2 ÷ 1/4",
    work: "1/2 ÷ 1/4 = 1/8",
    expect: { operation: "fractions", misconception: "frac_div_not_inverted", firstWrongStep: 1 },
  },
  {
    id: "frac-correct",
    problem: "3/4 + 1/8",
    work: "3/4 + 1/8 = 6/8 + 1/8 = 7/8",
    expect: { operation: "fractions", misconception: "none", firstWrongStep: -1 },
  },
  {
    id: "add-carry",
    problem: "38 + 47",
    work: "38 + 47 = 715",
    expect: { operation: "addition", misconception: "add_no_carry", firstWrongStep: 1 },
  },
  {
    id: "add-align",
    problem: "256 + 38",
    work: "  256\n+ 38\n-----\n  636",
    expect: { operation: "addition", misconception: "add_place_value_misalign", firstWrongStep: 1 },
  },
  {
    id: "sub-smaller",
    problem: "52 - 27",
    work: "52 - 27 = 35",
    expect: { operation: "subtraction", misconception: "sub_smaller_from_larger", firstWrongStep: 1 },
  },
  {
    // 403 - 158 = 355 looked like this case but is really smaller-from-larger in every column.
    // Here the student's own notes show the borrow, then the tens column left unchanged.
    id: "sub-borrow",
    problem: "73 - 28",
    work: "inite: mwen prete 1 dizèn, 13 - 8 = 5\ndizèn: 7 - 2 = 5\nrepons: 55",
    expect: { operation: "subtraction", misconception: "sub_borrow_not_reduced", firstWrongStep: null },
  },
  {
    id: "mul-fact",
    problem: "7 × 8",
    work: "7 × 8 = 54",
    expect: { operation: "multiplication", misconception: "mul_fact_error", firstWrongStep: 1 },
  },
  {
    id: "mul-added",
    problem: "6 × 4",
    work: "6 × 4 = 10",
    expect: { operation: "multiplication", misconception: "mul_added_instead", firstWrongStep: 1 },
  },
  {
    id: "div-reversed",
    problem: "3 ÷ 12",
    work: "3 ÷ 12 = 4",
    expect: { operation: "division", misconception: "div_reversed", firstWrongStep: 1 },
  },
  {
    id: "div-remainder",
    problem: "17 ÷ 5",
    work: "17 ÷ 5 = 3",
    expect: { operation: "division", misconception: "div_remainder_ignored", firstWrongStep: 1 },
  },
  {
    id: "div-big-remainder",
    problem: "29 ÷ 4",
    work: "29 ÷ 4 = 6 rès 5",
    expect: { operation: "division", misconception: "div_remainder_too_big", firstWrongStep: 1 },
  },
  {
    id: "eq-inverse",
    problem: "2x + 3 = 11",
    work: "2x + 3 = 11\n2x = 14\nx = 7",
    expect: { operation: "equations", misconception: "eq_inverse_operation_wrong", firstWrongStep: 1 },
  },
  {
    id: "eq-divide",
    problem: "3x = 12",
    work: "3x = 12\nx = 36",
    expect: { operation: "equations", misconception: "eq_divide_wrong", firstWrongStep: 1 },
  },
  {
    id: "exp-base",
    problem: "2^3",
    work: "2³ = 6",
    expect: { operation: "exponents", misconception: "exp_multiply_base_by_exponent", firstWrongStep: 1 },
  },
];
