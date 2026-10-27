import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import type { DiagnosisRun } from "../shared/diagnose.ts";
import { MetaApiError } from "../shared/meta-client.ts";
import { solveProblem, answerText } from "../shared/verify.ts";
import { GRAPH_URL, handleWhatsApp, MESSAGES, type Kv, type WhatsAppDeps, type WhatsAppEnv } from "../shared/whatsapp.ts";

const SECRET = "app_secret_for_tests";
const STUDENT = "50937000000";
const PHONE_ID = "123456789";
const PHOTO_BYTES = new Uint8Array(500).fill(7);

function memoryKv(): Kv & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    put: async (k, v) => void data.set(k, v),
    delete: async (k) => void data.delete(k),
  };
}

const env = (kv = memoryKv()): WhatsAppEnv & { MATON_KV: ReturnType<typeof memoryKv> } => ({
  MODEL_API_KEY: "LLM_test_key_that_must_never_leak",
  WHATSAPP_TOKEN: "wa_token_that_must_never_leak",
  WHATSAPP_APP_SECRET: SECRET,
  WHATSAPP_VERIFY_TOKEN: "verify-me",
  MATON_KV: kv,
});

const fakeRun = {
  diagnosis: {
    problem: "47 + 38",
    transcription: "47 + 38 = 75",
    operation: "addition",
    misconception_id: "add_no_carry",
    steps: [
      { text: "47 + 38", is_correct: true, box: {} },
      { text: "47 + 38 = 75", is_correct: false, box: {} },
    ],
    first_wrong_step_index: 1,
    encouragement_ht: "Chif 5 ou mete nan kolòn inite yo bon.",
    student_action_ht: "Ou bliye pote dizèn nan.",
    concept_ht: "Lè inite yo fè dis oswa plis, nou pote yon dizèn.",
    example_ht: "10 grenn mango fè yon pakèt dis.",
    guiding_question_ht: "Konbyen dizèn ou dwe pote?",
    practice_hint_ht: "Sonje ajoute dizèn ou te pote a.",
  },
  verification: { firstWrongStep: 1 },
  practice: { problem: "56 + 26", answer: solveProblem("56 + 26"), answerText: "82", misconceptionId: "add_no_carry" },
  meta: { model: "muse-spark-1.3", seconds: 12, usage: {} },
} as unknown as DiagnosisRun;

/** Records what would be sent to WhatsApp, and serves the photo download. */
function harness(diagnose: WhatsAppDeps["diagnoseWork"] = async () => fakeRun, mime = "image/jpeg") {
  const sent: { to: string; body: string }[] = [];
  const pending: Promise<unknown>[] = [];
  const calls: string[] = [];
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    if (url === `${GRAPH_URL}/${PHONE_ID}/messages`) {
      const b = JSON.parse(String(init?.body));
      sent.push({ to: b.to, body: b.text.body });
      return new Response("{}", { status: 200 });
    }
    if (url === `${GRAPH_URL}/777`) {
      return Response.json({ url: "https://lookaside.example/photo", mime_type: mime, file_size: PHOTO_BYTES.length });
    }
    if (url === "https://lookaside.example/photo") return new Response(PHOTO_BYTES);
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  const deps: WhatsAppDeps = { fetch: fakeFetch, diagnoseWork: diagnose, waitUntil: (p) => void pending.push(p) };
  return { sent, calls, deps, settle: () => Promise.all(pending) };
}

let nextId = 0;
const message = (extra: Record<string, unknown>) => ({
  entry: [
    {
      changes: [
        {
          value: {
            metadata: { phone_number_id: PHONE_ID },
            messages: [{ id: `wamid.${++nextId}`, from: STUDENT, ...extra }],
          },
        },
      ],
    },
  ],
});
const photoMessage = () => message({ type: "image", image: { id: "777" } });
const textMessage = (body: string) => message({ type: "text", text: { body } });

function signed(payload: unknown, secret = SECRET) {
  const body = JSON.stringify(payload);
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  return new Request("http://localhost/api/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Hub-Signature-256": `sha256=${sig}` },
    body,
  });
}

test("webhook verification answers Meta's challenge only with the right token", async () => {
  const h = harness();
  const url = (token: string) => `http://localhost/api/whatsapp?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=42`;
  const ok = await handleWhatsApp(new Request(url("verify-me")), env(), h.deps);
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "42");
  const bad = await handleWhatsApp(new Request(url("guess")), env(), h.deps);
  assert.equal(bad.status, 403);
});

test("a POST without Meta's signature, or signed with another secret, is refused", async () => {
  const h = harness();
  const unsigned = new Request("http://localhost/api/whatsapp", { method: "POST", body: JSON.stringify(photoMessage()) });
  assert.equal((await handleWhatsApp(unsigned, env(), h.deps)).status, 401);
  assert.equal((await handleWhatsApp(signed(photoMessage(), "other_secret"), env(), h.deps)).status, 401);
  await h.settle();
  assert.equal(h.sent.length, 0);
});

test("a photo gets the Kreyòl explanation and a practice problem, without any answer", async () => {
  const h = harness();
  const e = env();
  const res = await handleWhatsApp(signed(photoMessage()), e, h.deps);
  assert.equal(res.status, 200);
  await h.settle();
  assert.deepEqual(h.sent.map((s) => s.to), [STUDENT, STUDENT]);
  assert.equal(h.sent[0].body, MESSAGES.working);
  const reply = h.sent[1].body;
  assert.match(reply, /Ann gade etap sa a:\* 47 \+ 38 = 75/);
  assert.match(reply, /Ou bliye pote dizèn nan/);
  assert.match(reply, /Pratike \(1\/3\):\* 56 \+ 26 = \?/);
  // Neither the right answer of the student's problem (85) nor of the practice (82) is sent.
  assert.doesNotMatch(reply, /\b85\b|\b82\b/);
  for (const s of h.sent) assert.doesNotMatch(s.body, /never_leak/);
});

test("the phone number is never stored in clear and never logged", async () => {
  const h = harness();
  const e = env();
  const logs: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => void logs.push(args.join(" "));
  try {
    await handleWhatsApp(signed(photoMessage()), e, h.deps);
    await h.settle();
    await handleWhatsApp(signed(textMessage("82")), e, harness(async () => { throw new Error("x"); }).deps);
  } finally {
    console.error = original;
  }
  for (const [k, v] of e.MATON_KV.data) {
    assert.doesNotMatch(k + v, new RegExp(STUDENT));
  }
  for (const line of logs) assert.doesNotMatch(line, new RegExp(STUDENT));
});

test("practice answers are checked by code, and 3 in a row finishes the loop", async () => {
  const e = env();
  const h = harness();
  await handleWhatsApp(signed(photoMessage()), e, h.deps);
  await h.settle();

  await handleWhatsApp(signed(textMessage("72")), e, h.deps);
  await h.settle();
  assert.match(h.sent.at(-1)!.body, /^Poko\. Sonje ajoute dizèn ou te pote a\./);

  for (let i = 0; i < 3; i++) {
    const raw = [...e.MATON_KV.data].find(([k]) => k.startsWith("wa:"))![1];
    const problem = JSON.parse(raw).problem as string;
    await handleWhatsApp(signed(textMessage(answerText(solveProblem(problem)))), e, h.deps);
    await h.settle();
    assert.match(h.sent.at(-1)!.body, /^Wi, se sa!/);
  }
  assert.match(h.sent.at(-1)!.body, /Bravo! Ou rezoud 3 egzèsis/);
  assert.equal([...e.MATON_KV.data.keys()].filter((k) => k.startsWith("wa:")).length, 0);
});

test("text with no practice in progress gets the welcome message", async () => {
  const h = harness();
  await handleWhatsApp(signed(textMessage("bonjou")), env(), h.deps);
  await h.settle();
  assert.deepEqual(h.sent.map((s) => s.body), [MESSAGES.welcome]);
});

test("a photo type the app cannot read gets a clear message and no Meta call", async () => {
  let called = false;
  const h = harness(async () => {
    called = true;
    return fakeRun;
  }, "image/gif");
  await handleWhatsApp(signed(photoMessage()), env(), h.deps);
  await h.settle();
  assert.equal(called, false);
  assert.deepEqual(h.sent.map((s) => s.body), [MESSAGES.badPhoto]);
});

test("a Meta API error becomes a plain Kreyòl message", async () => {
  const h = harness(async () => {
    throw new MetaApiError("upstream down", 503);
  });
  await handleWhatsApp(signed(photoMessage()), env(), h.deps);
  await h.settle();
  assert.equal(h.sent.at(-1)!.body, MESSAGES.metaDown);
});

test("the same message delivered twice is answered once", async () => {
  const h = harness();
  const e = env();
  const payload = textMessage("bonjou");
  await handleWhatsApp(signed(payload), e, h.deps);
  await handleWhatsApp(signed(payload), e, h.deps);
  await h.settle();
  assert.equal(h.sent.length, 1);
});

test("without its secrets the webhook refuses to work", async () => {
  const h = harness();
  const res = await handleWhatsApp(signed(photoMessage()), { MODEL_API_KEY: "k" }, h.deps);
  assert.equal(res.status, 500);
});
