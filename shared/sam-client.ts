// SAM 3.1 through the Meta Model API Responses endpoint, as validated in scripts/test-sam.ts:
// non-streaming request, inline data-URL photo, one noun phrase per call.
// Only box coordinates leave this module; the (large) masks are dropped here.
import { META_BASE_URL, MetaApiError } from "./meta-client.ts";
import { parseSamBoxes, type PixelBox } from "./refine.ts";

export type SamResult = { boxes: PixelBox[]; status: number; seconds: number };

export async function samBoxes(opts: {
  apiKey: string;
  imageDataUrl: string;
  prompt: string;
  timeoutMs?: number;
}): Promise<SamResult> {
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`${META_BASE_URL}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sam-3.1",
        stream: false,
        input: [
          {
            type: "message",
            role: "user",
            content: [
              { type: "input_text", text: opts.prompt },
              { type: "input_image", image_url: opts.imageDataUrl },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
    });
  } catch (err) {
    throw new MetaApiError(`SAM request failed: ${(err as Error).name}`, 0);
  }
  const raw = await res.text();
  if (!res.ok) throw new MetaApiError(`SAM ${res.status}: ${raw.slice(0, 300)}`, res.status);

  const payload = JSON.parse(raw);
  const text: string =
    payload.output_text ??
    (payload.output ?? [])
      .flatMap((o: { content?: { text?: string }[] }) => o.content ?? [])
      .map((c: { text?: string }) => c.text ?? "")
      .join("");
  return { boxes: parseSamBoxes(text), status: res.status, seconds: (Date.now() - started) / 1000 };
}
