// Browser side of /api/analyze and /api/check. The Meta key never comes near this file.
import type { publicAnalysis } from "../shared/api.ts";
import type { PreparedPhoto } from "./resize-photo.ts";

export type Analysis = ReturnType<typeof publicAnalysis>;
export type CheckResult = { correct: boolean; next?: { problem: string; level: 1 | 2 | 3 } | null };

export class ApiError extends Error {
  code: string;
  constructor(code: string, messageHt: string) {
    super(messageHt);
    this.code = code;
  }
}

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if ((err as Error).name === "TimeoutError") throw new ApiError("timeout", "Analiz la pran twòp tan. Eseye ankò.");
    throw new ApiError("offline", "Pa gen koneksyon ak sèvè a. Tcheke entènèt ou.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "unknown", data.message_ht ?? "Gen yon pwoblèm. Eseye ankò.");
  return data as T;
}

export const analyzePhoto = (photo: PreparedPhoto, level = 1) =>
  post<Analysis>("/api/analyze", { mime: photo.mime, base64: photo.base64, width: photo.width, height: photo.height, level }, 45_000);

export const checkAnswer = (body: { problem: string; answer: string; misconceptionId: string; operation: string; level: number }) =>
  post<CheckResult>("/api/check", body, 15_000);
