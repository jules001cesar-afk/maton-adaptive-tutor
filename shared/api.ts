// HTTP handlers for /api/analyze and /api/check, kept free of Cloudflare specifics so
// they run in plain Node tests. functions/api/*.ts only forward to these.
//
// Rules enforced here:
// - the Meta key comes from the server environment and never appears in a response;
// - the answer to a practice problem never leaves the server: /api/check recomputes it.
import { MetaApiError } from "./meta-client.ts";
import { OPERATIONS, type Operation } from "./misconceptions.ts";
import { analyzePhoto, type PhotoAnalysis } from "./photo-pipeline.ts";
import { makePractice, type Level } from "./practice.ts";
import { checkStep, solveProblem, type Answer } from "./verify.ts";

export type Env = { MODEL_API_KEY?: string };
export type Deps = { analyzePhoto: typeof analyzePhoto };

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

const fail = (status: number, error: string, message_ht: string) => json(status, { error, message_ht });

async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  if (request.method !== "POST") throw new HttpError(405, "method_not_allowed", "Se sèlman POST ki aksepte.");
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) {
    throw new HttpError(413, "too_large", "Foto a twò gwo. Eseye ak yon foto ki pi piti.");
  }
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "too_large", "Foto a twò gwo. Eseye ak yon foto ki pi piti.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "bad_json", "Demann lan pa valab.");
  }
}

class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function base64Bytes(b64: string): number {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

const isLevel = (v: unknown): v is Level => v === 1 || v === 2 || v === 3;

/** What the browser receives: no practice answer, no masks, no key, no raw model payload. */
export function publicAnalysis(a: PhotoAnalysis, level: Level) {
  const d = a.run.diagnosis;
  return {
    source: "meta" as const,
    model: a.run.meta.model,
    seconds: a.run.meta.seconds,
    transcription: d.transcription,
    operation: d.operation,
    misconceptionId: d.misconception_id,
    kreyol: {
      encouragement: d.encouragement_ht,
      studentAction: d.student_action_ht,
      concept: d.concept_ht,
      example: d.example_ht,
      question: d.guiding_question_ht,
      hint: d.practice_hint_ht,
    },
    steps: a.steps,
    marksFrom: a.sam.ok ? "muse-spark+sam-3.1" : "muse-spark",
    practice: a.run.practice ? { problem: a.run.practice.problem, level } : null,
  };
}

export async function handleAnalyze(request: Request, env: Env, deps: Deps = { analyzePhoto }): Promise<Response> {
  try {
    const body = (await readJson(request, Math.ceil(MAX_PHOTO_BYTES * 1.4) + 4096)) as Record<string, unknown>;
    const { mime, base64, width, height } = body ?? {};
    const level = isLevel(body?.level) ? body.level : 1;
    if (typeof mime !== "string" || !MIME_TYPES.has(mime)) {
      return fail(400, "bad_image_type", "Voye yon foto JPG, PNG oswa WEBP.");
    }
    if (typeof base64 !== "string" || base64.length < 100 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
      return fail(400, "bad_image", "Foto a pa ka li. Eseye pran l ankò.");
    }
    if (base64Bytes(base64) > MAX_PHOTO_BYTES) return fail(413, "too_large", "Foto a twò gwo. Eseye ak yon foto ki pi piti.");
    const okSide = (v: unknown) => Number.isInteger(v) && (v as number) >= 100 && (v as number) <= 4000;
    if (!okSide(width) || !okSide(height)) return fail(400, "bad_size", "Gwosè foto a pa valab.");
    if (!env.MODEL_API_KEY) return fail(500, "not_configured", "Sèvè a pa konfigire. Kontakte ekip MATON.");

    const analysis = await deps.analyzePhoto({
      apiKey: env.MODEL_API_KEY,
      mime,
      base64,
      width: width as number,
      height: height as number,
      level,
    });
    return json(200, publicAnalysis(analysis, level));
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.code, err.message);
    if (err instanceof MetaApiError) {
      // Details stay in the server log; the student gets a plain message.
      console.error(`Meta API error (status ${err.status})`);
      return fail(502, "meta_unavailable", "Sèvis AI a pa reponn kounya a. Eseye ankò nan yon ti moman.");
    }
    console.error(`analyze failed: ${(err as Error).name}`);
    return fail(500, "internal", "Gen yon pwoblèm. Eseye ankò.");
  }
}

// Practice problems come from our generators, so they are short and use few symbols.
const PROBLEM_SHAPE = /^[0-9x+\-×÷/^() =]{3,40}$/;

export async function handleCheck(request: Request): Promise<Response> {
  try {
    const body = (await readJson(request, 2048)) as Record<string, unknown>;
    const { problem, answer, misconceptionId, operation } = body ?? {};
    const level = isLevel(body?.level) ? body.level : 1;
    if (typeof problem !== "string" || !PROBLEM_SHAPE.test(problem)) return fail(400, "bad_problem", "Egzèsis la pa valab.");
    if (typeof answer !== "string" || !answer.trim() || answer.length > 30) {
      return fail(400, "bad_answer", "Ekri yon repons.");
    }
    let expected: Answer;
    try {
      expected = solveProblem(problem);
    } catch {
      return fail(400, "bad_problem", "Egzèsis la pa valab.");
    }

    // The correct answer is recomputed here and never sent back, right or wrong.
    if (checkStep(answer, expected).matches !== true) return json(200, { correct: false });

    const op = OPERATIONS.includes(operation as Operation) ? (operation as Operation) : "other";
    const nextLevel = Math.min(3, level + 1) as Level;
    const next = makePractice({
      misconceptionId: typeof misconceptionId === "string" ? misconceptionId : "",
      operation: op,
      level: nextLevel,
      avoid: problem,
    });
    return json(200, { correct: true, next: next ? { problem: next.problem, level: nextLevel } : null });
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.code, err.message);
    return fail(500, "internal", "Gen yon pwoblèm. Eseye ankò.");
  }
}
