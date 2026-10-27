// WhatsApp channel: a student sends a notebook photo to the MATON number and gets the
// Kreyòl explanation and a practice loop back as text messages.
//
// Rules enforced here:
// - every POST must carry Meta's X-Hub-Signature-256, checked with the app secret;
// - phone numbers are never logged and never stored in clear: the session key is an
//   HMAC of the number;
// - the practice answer stays on the server (in the session), like /api/check;
// - the webhook replies 200 at once (so Meta does not resend) and does the work in
//   waitUntil, which Cloudflare lets run about 30 s after the response.
import { diagnoseWork, type DiagnosisRun } from "./diagnose.ts";
import { MetaApiError } from "./meta-client.ts";
import { OPERATIONS, type Operation } from "./misconceptions.ts";
import { makePractice, type Level } from "./practice.ts";
import { checkStep, solveProblem } from "./verify.ts";

export const GRAPH_URL = "https://graph.facebook.com/v25.0";
const MAX_BODY = 64 * 1024;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SESSION_TTL = 60 * 60;
const GOAL = 3;

export type Kv = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

export type WhatsAppEnv = {
  MODEL_API_KEY?: string;
  WHATSAPP_TOKEN?: string;
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  MATON_KV?: Kv;
};

export type WhatsAppDeps = {
  fetch: typeof fetch;
  diagnoseWork: typeof diagnoseWork;
  waitUntil: (p: Promise<unknown>) => void;
};

type Session = { problem: string; misconceptionId: string; operation: string; level: Level; solved: number; hint: string };

type Incoming = { id: string; from: string; phoneId: string; type: string; text?: string; mediaId?: string };

export const MESSAGES = {
  welcome:
    "Bonjou! Se MATON Kaye. Pran yon foto klè paj kaye ou ki gen kalkil la, epi voye l isit la. M ap montre w ki etap pou w gade ankò.",
  working: "Mwen resevwa foto a. M ap li kaye a, tann yon ti moman...",
  badPhoto: "Mwen pa ka li foto sa a. Voye yon foto JPG oswa PNG, ki pa twò gwo, epi ki klè.",
  metaDown: "Sèvis AI a pa reponn kounya a. Eseye voye foto a ankò nan yon ti moman.",
  internal: "Gen yon pwoblèm. Eseye voye foto a ankò.",
  right: "Wi, se sa! Ou jwenn li.",
  mastered: "Bravo! Ou rezoud 3 egzèsis youn apre lòt. Ou metrize etap sa a. Voye yon lòt paj kaye lè w vle.",
};

const enc = new TextEncoder();

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function validSignature(body: string, header: string | null, appSecret: string): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false;
  return sameText(header.slice(7).toLowerCase(), await hmacHex(appSecret, body));
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** The messages worth answering in a webhook payload; statuses and the rest are skipped. */
export function incomingMessages(payload: unknown): Incoming[] {
  const out: Incoming[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    for (const change of (entry as { changes?: unknown[] })?.changes ?? []) {
      const value = (change as { value?: Record<string, any> })?.value;
      const phoneId = value?.metadata?.phone_number_id;
      if (typeof phoneId !== "string" || !Array.isArray(value?.messages)) continue;
      for (const m of value.messages) {
        if (typeof m?.id !== "string" || typeof m?.from !== "string" || !/^\d{6,16}$/.test(m.from)) continue;
        out.push({ id: m.id, from: m.from, phoneId, type: String(m.type), text: m.text?.body, mediaId: m.image?.id });
      }
    }
  }
  return out;
}

const askLine = (problem: string) => (problem.includes("=") ? `${problem}  (jwenn x)` : `${problem} = ?`);

const practiceLine = (s: Session) => `*Pratike (${s.solved + 1}/${GOAL}):* ${askLine(s.problem)}\nEkri repons ou isit la.`;

/** The text reply for a diagnosed photo. Never contains the answer to the student's problem or to the practice. */
export function diagnosisMessage(run: DiagnosisRun, session: Session | null): string {
  const d = run.diagnosis;
  const wrongIndex = run.verification ? run.verification.firstWrongStep : d.first_wrong_step_index;
  const wrongStep = wrongIndex >= 0 ? d.steps[wrongIndex]?.text : undefined;
  const lines = [`*MATON Kaye*`, `Mwen li: ${d.transcription}`, "", d.encouragement_ht];
  if (wrongStep && d.misconception_id !== "none") {
    lines.push("", `*Ann gade etap sa a:* ${wrongStep}`, `*Sa ou te fè:* ${d.student_action_ht}`);
  }
  lines.push("", `*Ide pou sonje:* ${d.concept_ht}`);
  if (d.example_ht) lines.push(`*Egzanp:* ${d.example_ht}`);
  lines.push("", `*Reflechi sou sa:* ${d.guiding_question_ht}`);
  if (session) lines.push("", practiceLine(session));
  return lines.join("\n");
}

export async function handleWhatsApp(request: Request, env: WhatsAppEnv, deps: WhatsAppDeps): Promise<Response> {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const token = url.searchParams.get("hub.verify_token") ?? "";
    const ok =
      url.searchParams.get("hub.mode") === "subscribe" && !!env.WHATSAPP_VERIFY_TOKEN && sameText(token, env.WHATSAPP_VERIFY_TOKEN);
    return ok ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new Response("forbidden", { status: 403 });
  }
  if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!env.WHATSAPP_APP_SECRET || !env.WHATSAPP_TOKEN || !env.MODEL_API_KEY || !env.MATON_KV) {
    return new Response("not configured", { status: 500 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return new Response("too large", { status: 413 });
  const body = await request.text();
  if (body.length > MAX_BODY) return new Response("too large", { status: 413 });
  if (!(await validSignature(body, request.headers.get("x-hub-signature-256"), env.WHATSAPP_APP_SECRET))) {
    return new Response("bad signature", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const messages = incomingMessages(payload);
  if (messages.length) deps.waitUntil(Promise.all(messages.map((m) => answer(m, env as Required<WhatsAppEnv>, deps))));
  return new Response("ok", { status: 200 });
}

async function answer(m: Incoming, env: Required<WhatsAppEnv>, deps: WhatsAppDeps): Promise<void> {
  const kv = env.MATON_KV;
  const send = (text: string) => sendText(deps.fetch, env.WHATSAPP_TOKEN, m.phoneId, m.from, text);
  try {
    // Meta may deliver the same message twice; answer it once.
    const seenKey = `seen:${await hmacHex(env.WHATSAPP_APP_SECRET, m.id)}`;
    if (await kv.get(seenKey)) return;
    await kv.put(seenKey, "1", { expirationTtl: 24 * 60 * 60 });
    const sessionKey = `wa:${await hmacHex(env.WHATSAPP_APP_SECRET, m.from)}`;

    if (m.type === "image" && m.mediaId) {
      const photo = await downloadPhoto(deps.fetch, env.WHATSAPP_TOKEN, m.mediaId);
      if (!photo) return void (await send(MESSAGES.badPhoto));
      await send(MESSAGES.working);
      const run = await deps.diagnoseWork({ photo }, { apiKey: env.MODEL_API_KEY, level: 1 });
      const session: Session | null = run.practice
        ? {
            problem: run.practice.problem,
            misconceptionId: run.practice.misconceptionId,
            operation: run.diagnosis.operation,
            level: 1,
            solved: 0,
            hint: run.diagnosis.practice_hint_ht,
          }
        : null;
      if (session) await kv.put(sessionKey, JSON.stringify(session), { expirationTtl: SESSION_TTL });
      else await kv.delete(sessionKey);
      return void (await send(diagnosisMessage(run, session)));
    }

    const raw = await kv.get(sessionKey);
    const text = m.type === "text" ? (m.text ?? "").trim() : "";
    if (!raw || !text || text.length > 30) return void (await send(MESSAGES.welcome));
    const session = JSON.parse(raw) as Session;
    let correct = false;
    try {
      correct = checkStep(text, solveProblem(session.problem)).matches === true;
    } catch {
      correct = false;
    }
    if (!correct) return void (await send(`Poko. ${session.hint}\n\n${practiceLine(session)}`));

    const solved = session.solved + 1;
    if (solved >= GOAL) {
      await kv.delete(sessionKey);
      return void (await send(`${MESSAGES.right}\n\n${MESSAGES.mastered}`));
    }
    const level = Math.min(3, session.level + 1) as Level;
    const op = OPERATIONS.includes(session.operation as Operation) ? (session.operation as Operation) : "other";
    const next = makePractice({ misconceptionId: session.misconceptionId, operation: op, level, avoid: session.problem });
    if (!next) {
      await kv.delete(sessionKey);
      return void (await send(`${MESSAGES.right}\n\nVoye yon lòt paj kaye lè w vle.`));
    }
    const updated: Session = { ...session, problem: next.problem, level, solved };
    await kv.put(sessionKey, JSON.stringify(updated), { expirationTtl: SESSION_TTL });
    await send(`${MESSAGES.right}\n\n${practiceLine(updated)}`);
  } catch (err) {
    // Never log the phone number or the message text.
    if (err instanceof MetaApiError) {
      console.error(`whatsapp: Meta model API error (status ${err.status})`);
      await send(MESSAGES.metaDown).catch(() => {});
    } else {
      console.error(`whatsapp: failed (${(err as Error).name})`);
      await send(MESSAGES.internal).catch(() => {});
    }
  }
}

async function downloadPhoto(f: typeof fetch, token: string, mediaId: string): Promise<{ mime: string; base64: string } | null> {
  if (!/^\d{1,30}$/.test(mediaId)) return null;
  const auth = { Authorization: `Bearer ${token}` };
  const info = await f(`${GRAPH_URL}/${mediaId}`, { headers: auth });
  if (!info.ok) throw new Error(`media info ${info.status}`);
  const meta = (await info.json()) as { url?: string; mime_type?: string; file_size?: number };
  const mime = meta.mime_type?.split(";")[0].trim() ?? "";
  if (!MIME_TYPES.has(mime) || (meta.file_size ?? 0) > MAX_PHOTO_BYTES || !meta.url?.startsWith("https://")) return null;
  const file = await f(meta.url, { headers: auth });
  if (!file.ok) throw new Error(`media download ${file.status}`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 100 || bytes.length > MAX_PHOTO_BYTES) return null;
  return { mime, base64: toBase64(bytes) };
}

async function sendText(f: typeof fetch, token: string, phoneId: string, to: string, body: string): Promise<void> {
  const res = await f(`${GRAPH_URL}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: body.slice(0, 4000) } }),
  });
  if (!res.ok) {
    // Only Meta's error codes are logged; its message text can contain the phone number.
    const err = ((await res.json().catch(() => ({}))) as { error?: { code?: number; error_subcode?: number; type?: string } }).error;
    console.error(`whatsapp: send failed (status ${res.status}, code ${err?.code}, subcode ${err?.error_subcode}, ${err?.type})`);
  }
}
