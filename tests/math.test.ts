import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluate, solveLinear } from "../shared/parse.ts";
import { checkPracticeAnswer, makePractice } from "../shared/practice.ts";
import { rat, show } from "../shared/rational.ts";
import { verifyWork } from "../shared/verify.ts";
import { CASES } from "./cases.ts";
import { MISCONCEPTIONS } from "../shared/misconceptions.ts";
import { fixAccents } from "../shared/checks.ts";
import type { Diagnosis } from "../shared/tutor-prompt.ts";

test("evaluates what students write", () => {
  assert.equal(show(evaluate("1/2 + 1/3")), "5/6");
  assert.equal(show(evaluate("(1+1)/(2+3)")), "2/5");
  assert.equal(show(evaluate("7 × 8")), "56");
  assert.equal(show(evaluate("7 x 8")), "56");
  assert.equal(show(evaluate("1/2 ÷ 1/4")), "2");
  assert.equal(show(evaluate("403 − 158")), "245");
  assert.equal(show(evaluate("2³")), "8");
  assert.equal(show(evaluate("3,5 + 1")), "9/2");
  assert.equal(show(evaluate("2(3+4)")), "14");
  assert.throws(() => evaluate("1/0"));
  assert.throws(() => evaluate("2 +"));
});

test("solves linear equations", () => {
  assert.deepEqual(solveLinear("2x + 3 = 11"), { kind: "one", x: rat(4) });
  assert.deepEqual(solveLinear("3x = 12"), { kind: "one", x: rat(4) });
  assert.deepEqual(solveLinear("x + 1 = x + 1"), { kind: "all" });
  assert.throws(() => solveLinear("x*x = 4"));
});

test("finds the first wrong step in every evaluation case", () => {
  for (const c of CASES) {
    // One step per '=' segment or line, the way the model is asked to split them.
    const steps = c.work
      .split(/\n/)
      .filter((l) => !/^[-\s]*$/.test(l))
      .flatMap((line) => (c.problem.includes("=") ? [line] : line.split("=")))
      .map((s) => s.trim())
      .filter(Boolean);
    if (c.id === "add-align" || c.expect.firstWrongStep === null) continue; // column layouts
    const v = verifyWork(c.problem, steps, steps[steps.length - 1]);
    assert.equal(v.firstWrongStep, c.expect.firstWrongStep, `${c.id}: steps ${JSON.stringify(steps)}`);
  }
});

test("division with a remainder", () => {
  assert.equal(verifyWork("17 ÷ 5", ["17 ÷ 5", "3"], "3").finalCorrect, false);
  assert.equal(verifyWork("17 ÷ 5", ["17 ÷ 5", "3 rès 2"], "3 rès 2").finalCorrect, true);
  assert.equal(verifyWork("29 ÷ 4", ["29 ÷ 4", "6 rès 5"], "6 rès 5").finalCorrect, false);
  assert.equal(verifyWork("17 ÷ 5", ["3.4"], "3.4").finalCorrect, true);
  assert.equal(verifyWork("17 ÷ 5", [], "17 ÷ 5").correctText, "3 rès 2");
});

test("practice problems are new, solvable and checked by code", () => {
  for (const m of MISCONCEPTIONS) {
    for (const level of [1, 2, 3] as const) {
      for (let seed = 1; seed <= 25; seed++) {
        const p = makePractice({ misconceptionId: m.id, operation: m.operation, level, seed, avoid: "1/2 + 1/3" });
        assert.ok(p, `${m.id} level ${level} seed ${seed}`);
        assert.notEqual(p.problem.replace(/\s+/g, ""), "1/2+1/3");
        assert.ok(checkPracticeAnswer(p, p.answerText), `${m.id}: ${p.problem} -> ${p.answerText}`);
      }
    }
  }
  const p = makePractice({ misconceptionId: "frac_add_across", operation: "fractions", seed: 7 })!;
  assert.equal(checkPracticeAnswer(p, "2/5"), false);
});

test("restores only unambiguous missing accents", () => {
  const d = {
    encouragement_ht: "Le ou fe sa, res la pi piti.",
    student_action_ht: "Ou te kle sou sa ou te fè.",
    concept_ht: "Valè chak chif",
    example_ht: "",
    guiding_question_ht: "Ki sa ou we?",
    practice_hint_ht: "",
  } as Diagnosis;
  assert.equal(fixAccents(d), 4);
  assert.equal(d.encouragement_ht, "Lè ou fè sa, rès la pi piti.");
  assert.equal(d.student_action_ht, "Ou te kle sou sa ou te fè.");
  assert.equal(d.guiding_question_ht, "Ki sa ou wè?");
});

test("snaps chained steps to the borders SAM finds between them", async () => {
  const { refineSteps } = await import("../shared/refine.ts");
  // Real boxes from test-photos/notebook-1.jpg: the model's step 3 box drifted onto the "3" of step 2.
  const steps = [
    { x1: 138, y1: 428, x2: 573, y2: 662 },
    { x1: 593, y1: 392, x2: 1247, y2: 524 },
    { x1: 1248, y1: 384, x2: 1479, y2: 560 },
  ];
  const n = (x1: number, y1: number, x2: number, y2: number) => ({ x1, y1, x2, y2 });
  const numbers = [
    n(171, 407, 277, 524), n(1376, 358, 1445, 421), n(1256, 397, 1306, 457), n(991, 379, 1018, 484),
    n(554, 499, 604, 577), n(1393, 455, 1451, 531), n(220, 563, 301, 659), n(801, 399, 848, 466),
    n(1109, 382, 1154, 500), n(492, 363, 576, 463), n(762, 386, 815, 492), n(925, 394, 977, 468),
    n(1141, 397, 1205, 465),
  ];
  const equals = [n(1335, 423, 1367, 433), n(679, 464, 724, 483)];
  const [a, b, c] = refineSteps(steps, numbers, equals);
  assert.deepEqual(a.box, { x1: 171, y1: 363, x2: 604, y2: 659 });
  assert.deepEqual(b.box, { x1: 762, y1: 379, x2: 1306, y2: 500 }); // now includes "+3"
  assert.deepEqual(c.box, { x1: 1376, y1: 358, x2: 1451, y2: 531 }); // just "2/5"
});
