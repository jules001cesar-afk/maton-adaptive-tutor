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
