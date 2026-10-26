// Shown only when the Meta API cannot be reached. It is a real Muse Spark + SAM 3.1
// result recorded earlier on the demo photo (scripts/record-fallback.ts), and the UI
// must always show FALLBACK_LABEL with it so nobody mistakes it for a live answer.
import data from "./fallback-data.json" with { type: "json" };

export const FALLBACK_LABEL = "Repons anrejistre davans: li pa soti nan Meta kounya a.";

export const FALLBACK = data as typeof data & { source: "recorded" };
