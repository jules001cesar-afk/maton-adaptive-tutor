import assert from "node:assert/strict";
import { test } from "node:test";

import { handleAnalyze, handleCheck, type Deps } from "../shared/api.ts";
import { MetaApiError } from "../shared/meta-client.ts";
import type { PhotoAnalysis } from "../shared/photo-pipeline.ts";
import { solveProblem, answerText } from "../shared/verify.ts";
import { FALLBACK, FALLBACK_LABEL } from "../src/fallback.ts";

const KEY = "LLM_test_key_that_must_never_leak";
const PHOTO = "A".repeat(400);
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const photoBody = (extra: Record<string, unknown> = {}) => ({ mime: "image/jpeg", base64: PHOTO, width: 1200, height: 1600, ...extra });

const fakeAnalysis = {
  run: {
    diagnosis: {
      transcription: "1/2 + 1/3 = 2/5",
      operation: "fractions",
      misconception_id: "frac_add_across",
      encouragement_ht: "a",
      student_action_ht: "b",
      concept_ht: "c",
      example_ht: "d",
      guiding_question_ht: "e?",
      practice_hint_ht: "f",
    },
    practice: { problem: "2/5 + 1/2", answer: solveProblem("2/5 + 1/2"), answerText: "9/10", misconceptionId: "frac_add_across" },
    meta: { model: "muse-spark-1.3", seconds: 9, usage: {} },
  },
  steps: [{ text: "2/5", status: "wrong", checkedBy: "code", box: { x1: 1, y1: 2, x2: 3, y2: 4 }, preciseMark: true }],
  sam: { ok: true, numbers: 13, equals: 2 },
} as unknown as PhotoAnalysis;
const deps = (fn: Deps["analyzePhoto"]): Deps => ({ analyzePhoto: fn });

test("/api/analyze returns the analysis without the practice answer, masks or key", async () => {
  let receivedKey = "";
  const res = await handleAnalyze(post("/api/analyze", photoBody()), { MODEL_API_KEY: KEY }, deps(async (o) => {
    receivedKey = o.apiKey;
    return fakeAnalysis;
  }));
  assert.equal(res.status, 200);
  assert.equal(receivedKey, KEY);
  const text = await res.text();
  const body = JSON.parse(text);
  assert.equal(body.source, "meta");
  assert.deepEqual(body.practice, { problem: "2/5 + 1/2", level: 1 });
  assert.ok(!text.includes("9/10"), "practice answer leaked");
  assert.ok(!text.includes(KEY), "key leaked");
  assert.ok(!/mask/i.test(text), "masks leaked");
});

test("/api/analyze rejects invalid photos before calling Meta", async () => {
  let called = false;
  const d = deps(async () => {
    called = true;
    return fakeAnalysis;
  });
  const env = { MODEL_API_KEY: KEY };
  const cases: [unknown, number, string][] = [
    [photoBody({ mime: "image/gif" }), 400, "bad_image_type"],
    [photoBody({ mime: "text/html" }), 400, "bad_image_type"],
    [photoBody({ base64: "not base64 <script>" }), 400, "bad_image"],
    [photoBody({ base64: "" }), 400, "bad_image"],
    [photoBody({ width: 50 }), 400, "bad_size"],
    [photoBody({ height: "1600" }), 400, "bad_size"],
    [photoBody({ base64: "A".repeat(6 * 1024 * 1024) }), 413, "too_large"],
    ["{not json", 400, "bad_json"],
  ];
  for (const [body, status, code] of cases) {
    const res = await handleAnalyze(post("/api/analyze", body), env, d);
    assert.equal(res.status, status, code);
    const out = await res.json();
    assert.equal(out.error, code);
    assert.ok(out.message_ht);
  }
  const get = await handleAnalyze(new Request("http://localhost/api/analyze"), env, d);
  assert.equal(get.status, 405);
  assert.equal(called, false);
});

test("/api/analyze without a configured key fails safely", async () => {
  const res = await handleAnalyze(post("/api/analyze", photoBody()), {}, deps(async () => fakeAnalysis));
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, "not_configured");
});

test("/api/analyze turns Meta errors into a plain message without details", async () => {
  const res = await handleAnalyze(
    post("/api/analyze", photoBody()),
    { MODEL_API_KEY: KEY },
    deps(async () => {
      throw new MetaApiError(`Meta API 401: invalid key ${KEY}`, 401);
    }),
  );
  assert.equal(res.status, 502);
  const text = await res.text();
  assert.equal(JSON.parse(text).error, "meta_unavailable");
  assert.ok(!text.includes(KEY));
  assert.ok(!text.includes("401"));
});

test("/api/check never reveals the answer", async () => {
  const problem = "2/5 + 1/2";
  const wrong = await handleCheck(post("/api/check", { problem, answer: "3/7", misconceptionId: "frac_add_across", operation: "fractions" }));
  const wrongText = await wrong.text();
  assert.deepEqual(JSON.parse(wrongText), { correct: false });
  assert.ok(!wrongText.includes("9/10"));

  const right = await handleCheck(post("/api/check", { problem, answer: "9/10", misconceptionId: "frac_add_across", operation: "fractions", level: 1 }));
  const body = await right.json();
  assert.equal(body.correct, true);
  assert.equal(body.next.level, 2);
  assert.notEqual(body.next.problem, problem);
  assert.deepEqual(Object.keys(body.next).sort(), ["level", "problem"]);
  // The next problem's answer is not in the response either.
  assert.ok(!JSON.stringify(body).includes(answerText(solveProblem(body.next.problem))) || /^\d$/.test(answerText(solveProblem(body.next.problem))));
});

test("/api/check accepts equivalent answers and checks equations and remainders", async () => {
  const ok = async (problem: string, answer: string) =>
    (await (await handleCheck(post("/api/check", { problem, answer, operation: "other" }))).json()).correct;
  assert.equal(await ok("2/5 + 1/2", "18/20"), true);
  assert.equal(await ok("2x + 3 = 11", "4"), true);
  assert.equal(await ok("2x + 3 = 11", "x = 4"), true);
  assert.equal(await ok("17 ÷ 5", "3 rès 2"), true);
  assert.equal(await ok("17 ÷ 5", "3"), false);
});

test("/api/check rejects anything that is not a practice problem", async () => {
  const bad: unknown[] = [
    { problem: "process.exit()", answer: "1" },
    { problem: "1/0", answer: "1" },
    { problem: "1".repeat(60), answer: "1" },
    { problem: "2 + 2", answer: "" },
    { problem: "2 + 2", answer: "4".repeat(40) },
    { problem: 5, answer: "5" },
  ];
  for (const body of bad) {
    const res = await handleCheck(post("/api/check", body));
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  assert.equal((await handleCheck(post("/api/check", "x".repeat(5000)))).status, 413);
  assert.equal((await handleCheck(new Request("http://localhost/api/check"))).status, 405);
});

test("the fallback is a labeled recording and carries no answers", () => {
  assert.equal(FALLBACK.source, "recorded");
  assert.match(FALLBACK_LABEL, /pa soti nan Meta kounya a/);
  assert.ok(FALLBACK.steps.length > 0);
  assert.ok(FALLBACK.steps.some((s) => s.status === "wrong"));
  const text = JSON.stringify(FALLBACK);
  assert.ok(!/"answer/i.test(text));
  if (FALLBACK.practice) assert.ok(!text.includes(answerText(solveProblem(FALLBACK.practice.problem))) || /^\d$/.test(answerText(solveProblem(FALLBACK.practice.problem))));
});
