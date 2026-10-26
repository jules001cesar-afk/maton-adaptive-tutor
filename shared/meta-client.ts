// Minimal Meta Model API client (Chat Completions + strict JSON schema).
// The key is passed in by the caller and never logged.

export const META_BASE_URL = "https://api.meta.ai/v1";
export const DEFAULT_MODEL = "muse-spark-1.3";

export type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

export type ChatJsonResult<T> = {
  data: T;
  status: number;
  seconds: number;
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
};

export class MetaApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export async function chatJson<T>(opts: {
  apiKey: string;
  model?: string;
  messages: unknown[];
  schema: object;
  schemaName: string;
  reasoningEffort?: ReasoningEffort;
  timeoutMs?: number;
}): Promise<ChatJsonResult<T>> {
  const body = JSON.stringify({
    model: opts.model ?? DEFAULT_MODEL,
    messages: opts.messages,
    response_format: { type: "json_schema", json_schema: { name: opts.schemaName, strict: true, schema: opts.schema } },
    ...(opts.reasoningEffort ? { reasoning_effort: opts.reasoningEffort } : {}),
  });

  const started = Date.now();
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${META_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
      });
    } catch (err) {
      if (attempt < 2) continue;
      throw new MetaApiError(`request failed: ${(err as Error).name}`, 0);
    }
    if (RETRYABLE.has(res.status) && attempt < 2) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || 1000;
      await new Promise((r) => setTimeout(r, Math.min(wait, 10_000)));
      continue;
    }
    const raw = await res.text();
    if (!res.ok) throw new MetaApiError(`Meta API ${res.status}: ${raw.slice(0, 500)}`, res.status);
    const payload = JSON.parse(raw);
    const content = payload.choices?.[0]?.message?.content ?? "";
    let data: T;
    try {
      data = JSON.parse(content) as T;
    } catch {
      throw new MetaApiError("model returned invalid JSON", res.status);
    }
    return { data, status: res.status, seconds: (Date.now() - started) / 1000, usage: payload.usage };
  }
}
