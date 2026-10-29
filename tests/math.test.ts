import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluate, solveLinear } from "../shared/parse.ts";
import { checkPracticeAnswer, makePractice, sameProblem } from "../shared/practice.ts";
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

test("ignores '=' borders that do not sit between the steps", async () => {
  const { refineSteps } = await import("../shared/refine.ts");
  // Same photo as above, but SAM also reports a fraction bar as an "=" inside step 2.
  // Trusting it shrank step 2 to the single digit "3" during a live run.
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
  const equals = [n(679, 464, 724, 483), n(785, 470, 805, 480)];
  const [, b] = refineSteps(steps, numbers, equals);
  assert.ok(b.box.x2 - b.box.x1 > 300, `step 2 too narrow: ${JSON.stringify(b.box)}`);
});

test("puts each step back on its own line when the model's boxes drift down", async () => {
  const { refineSteps } = await import("../shared/refine.ts");
  const n = (x1: number, x2: number, y1: number, y2: number) => ({ x1, y1, x2, y2 });
  // Real SAM boxes from a phone photo of "x + 5 = 12 / x = 12 + 5 / x = 17" (one step
  // per line). The model's boxes are pushed one line down, as seen on the phone.
  const numbers = [n(558, 589, 234, 280), n(589, 644, 332, 377), n(306, 364, 405, 460), n(290, 356, 307, 369), n(290, 368, 206, 276), n(450, 493, 222, 270), n(584, 635, 237, 289)];
  const steps = [n(290, 663, 298, 375), n(287, 648, 391, 473), n(299, 509, 498, 567)];
  const [a, b, c] = refineSteps(steps, numbers, []);
  const line = (box: { y1: number; y2: number }) => (box.y1 + box.y2) / 2;
  assert.ok(line(a.box) > 200 && line(a.box) < 290, `step 1 not on line 1: ${JSON.stringify(a.box)}`);
  assert.ok(line(b.box) > 300 && line(b.box) < 380, `step 2 not on line 2: ${JSON.stringify(b.box)}`);
  assert.ok(line(c.box) > 400 && line(c.box) < 470, `step 3 not on line 3: ${JSON.stringify(c.box)}`);
  assert.ok(c.box.x2 - c.box.x1 > 150, "step 3 should cover all of x = 17, not just the x");
});

test("never gives the same number to two overlapping steps", async () => {
  const { refineSteps } = await import("../shared/refine.ts");
  const n = (x1: number, x2: number, y1: number, y2: number) => ({ x1, y1, x2, y2 });
  // "47 + 38 = 75" where the model's two boxes overlap and SAM found no "=".
  const numbers = [n(100, 180, 100, 160), n(230, 310, 100, 160), n(420, 500, 100, 160)];
  const steps = [n(90, 330, 90, 170), n(200, 520, 90, 170)];
  const [a, b] = refineSteps(steps, numbers, []);
  assert.ok(a.box.x2 <= b.box.x1 || b.box.x2 <= a.box.x1 || a.box.x2 - b.box.x1 < 40, `marks overlap: ${JSON.stringify([a.box, b.box])}`);
});

test("merges the numbers from two SAM prompts without duplicates", async () => {
  const { mergeBoxes } = await import("../shared/refine.ts");
  const n = (x1: number, x2: number, y1: number, y2: number) => ({ x1, y1, x2, y2 });
  const merged = mergeBoxes([n(0, 50, 0, 50), n(100, 150, 0, 50)], [n(2, 52, 1, 49), n(200, 250, 0, 50)]);
  assert.equal(merged.length, 3);
});

test("on one line, the answer mark holds only what comes after the earlier step", async () => {
  const { refineSteps } = await import("../shared/refine.ts");
  const n = (x1: number, x2: number, y1: number, y2: number) => ({ x1, y1, x2, y2 });
  // Real boxes from phone photos. The model gives "52 - 17" and then the whole line
  // "52-17=45", and its first box stops in the middle of the "7".
  {
    const steps = [n(240, 648, 600, 776), n(240, 876, 600, 776)];
    const numbers = [n(613, 687, 615, 694), n(851, 923, 602, 687), n(341, 428, 610, 721), n(790, 850, 622, 690), n(247, 306, 625, 720), n(532, 591, 607, 720)];
    const [problem, answer] = refineSteps(steps, numbers, []);
    assert.deepEqual([problem.box.x1, problem.box.x2], [247, 687]); // all of 52 - 17
    assert.deepEqual([answer.box.x1, answer.box.x2], [790, 923]); // just 45
  }
  // "29 ÷ 4 = 6 / Res 5": the gap after "÷" is wider than the one before "=".
  {
    const steps = [n(246, 600, 688, 840), n(246, 822, 688, 848), n(294, 654, 880, 1000)];
    const numbers = [n(434, 495, 864, 956), n(284, 374, 871, 948), n(361, 408, 667, 762), n(253, 343, 656, 768), n(775, 834, 683, 777), n(364, 434, 882, 941), n(580, 671, 871, 962), n(570, 645, 697, 806)];
    const [problem, answer, rest] = refineSteps(steps, numbers, []);
    assert.equal(problem.box.x2, 645); // keeps the 4
    assert.deepEqual([answer.box.x1, answer.box.x2], [775, 834]); // just 6
    assert.ok(rest.box.y1 > 850, "Res 5 stays on its own line");
  }
});

test("without SAM numbers, the steps are fitted to the block of writing", async () => {
  const { refineSteps } = await import("../shared/refine.ts");
  const n = (x1: number, x2: number, y1: number, y2: number) => ({ x1, y1, x2, y2 });
  // Real boxes from the phone photo of "x + 5 = 12 / x = 12 + 5 / x = 17": SAM found no
  // numbers but found the whole expression at y 569-881.
  const steps = [n(156, 696, 544, 672), n(144, 624, 688, 808), n(156, 432, 824, 928)];
  const marks = refineSteps(steps, [], [], n(149, 721, 569, 881));
  const mid = (b: { y1: number; y2: number }) => (b.y1 + b.y2) / 2;
  // Text lines on the photo are centred near y 615, 730 and 845.
  [615, 730, 845].forEach((y, i) => assert.ok(Math.abs(mid(marks[i].box) - y) < 30, `step ${i + 1} at ${mid(marks[i].box)}`));
});

test("the answer mark counts the new digits when the model's edge stops early", async () => {
  const { refineSteps } = await import("../shared/refine.ts");
  const n = (x1: number, x2: number, y1: number, y2: number) => ({ x1, y1, x2, y2 });
  // Real run on "52-17=45": the model's first box stops at x 534, before the "17".
  const steps = [n(246, 534, 616, 776), n(246, 876, 616, 776)];
  const numbers = [n(247, 306, 625, 720), n(341, 428, 610, 721), n(532, 591, 607, 720), n(613, 687, 615, 694), n(790, 850, 622, 690), n(851, 923, 602, 687)];
  const [problem, answer] = refineSteps(steps, numbers, [], null, ["52-17", "52-17=45"]);
  assert.deepEqual([problem.box.x1, problem.box.x2], [247, 687]);
  assert.deepEqual([answer.box.x1, answer.box.x2], [790, 923]);
});

test("practice never repeats the student's multiplication, however it is written", () => {
  for (const avoid of ["7 x 8", "7*8", "7 X 8", "7·8", "7 × 8", "8 x 7"]) {
    for (let seed = 1; seed <= 2000; seed++) {
      const p = makePractice({ misconceptionId: "mul_fact_error", operation: "multiplication", level: 1, seed, avoid })!;
      assert.ok(p.problem !== "7 × 8" && p.problem !== "8 × 7", `${avoid} seed ${seed} gave ${p.problem}`);
    }
  }
});

test("sameProblem reads x as a variable unless it sits between two digits", () => {
  assert.ok(sameProblem("2x + 7 = 15", "2x+7=15"));
  assert.ok(!sameProblem("2x + 7 = 15", "2 × 7 = 15"));
  assert.ok(sameProblem("12 x 3", "3 × 12"));
  assert.ok(!sameProblem("7 × 8", "7 × 9"));
  assert.ok(!sameProblem("7 - 8", "8 - 7"));
  assert.ok(!sameProblem("2x + 7 = 15", "2 × 7 + 15"));
  // Swapped factors count only for a lone product, the only kind the generator makes;
  // inside a longer expression the sign is still read, but the order matters.
  assert.ok(sameProblem("2 x 7 + 3", "2 × 7 + 3"));
  assert.ok(!sameProblem("2 × 7 + 3", "7 × 2 + 3"));
  // An equation the student wrote is still never given back as practice.
  for (let seed = 1; seed <= 500; seed++) {
    const p = makePractice({ misconceptionId: "eq_divide_wrong", operation: "equations", seed, avoid: "2x = 14" })!;
    assert.notEqual(p.problem.replace(/\s+/g, ""), "2x=14");
  }
});

test("with insufficient evidence, a fraction division gets division practice", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const div = makePractice({ misconceptionId: "insufficient_evidence", operation: "fractions", seed, avoid: "1/2 ÷ 1/4" })!;
    assert.match(div.problem, /÷/);
    assert.equal(div.misconceptionId, "frac_div_not_inverted");
    const colon = makePractice({ misconceptionId: "insufficient_evidence", operation: "fractions", seed, avoid: "1/2 : 1/4" })!;
    assert.equal(colon.misconceptionId, "frac_div_not_inverted");
    const add = makePractice({ misconceptionId: "insufficient_evidence", operation: "fractions", seed, avoid: "1/2 + 1/3" })!;
    assert.match(add.problem, /\+/);
    assert.equal(add.misconceptionId, "frac_add_across");
    // A named misconception keeps its own problems.
    const named = makePractice({ misconceptionId: "frac_add_across", operation: "fractions", seed, avoid: "1/2 ÷ 1/4" })!;
    assert.equal(named.misconceptionId, "frac_add_across");
    // Other operations keep their usual fallback, even if the problem has a ":".
    const sub = makePractice({ misconceptionId: "insufficient_evidence", operation: "subtraction", seed, avoid: "52 - 17" })!;
    assert.equal(sub.misconceptionId, "sub_smaller_from_larger");
    const intDiv = makePractice({ misconceptionId: "insufficient_evidence", operation: "division", seed, avoid: "29 : 4" })!;
    assert.equal(intDiv.misconceptionId, "div_remainder_ignored");
  }
});
