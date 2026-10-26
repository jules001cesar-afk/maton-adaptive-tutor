// Day-1 check of the Meta Model API: one request, structured JSON back.
//
//   node --env-file=.dev.vars scripts/test-meta.mjs                 text only
//   node --env-file=.dev.vars scripts/test-meta.mjs <photo.jpg>     handwritten photo
//
// The key is read from MODEL_API_KEY and is never printed. The correct answer is
// computed here in code, never taken from the model.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";

const BASE_URL = "https://api.meta.ai/v1";
const MODEL = process.env.MODEL_ID || "muse-spark-1.3";
const TIMEOUT_MS = 90_000;

const key = process.env.MODEL_API_KEY?.trim();
if (!key) {
  console.error("MODEL_API_KEY is empty. Paste your key into .dev.vars after MODEL_API_KEY= and run again.");
  process.exit(1);
}

const photoPath = process.argv[2];

// ---- Fraction math, done by code ------------------------------------------
const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));
function addFractions([a, b], [c, d]) {
  const n = a * d + c * b;
  const m = b * d;
  const g = gcd(n, m);
  return [n / g, m / g];
}
const PROBLEM = { left: [1, 2], right: [1, 3], studentAnswer: [2, 5] };
const correct = addFractions(PROBLEM.left, PROBLEM.right);

// ---- Response schema (strict subset: every key required, no extra keys) ----
const box = {
  type: "object",
  description: "Location on the photo, normalized 0-1000 grid, origin top-left. All zeros when there is no photo.",
  properties: {
    x_min: { type: "integer" },
    y_min: { type: "integer" },
    x_max: { type: "integer" },
    y_max: { type: "integer" },
  },
  required: ["x_min", "y_min", "x_max", "y_max"],
  additionalProperties: false,
};
const schema = {
  type: "object",
  properties: {
    transcription: { type: "string", description: "Exactly what the student wrote, line by line." },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          is_correct: { type: "boolean" },
          box,
        },
        required: ["text", "is_correct", "box"],
        additionalProperties: false,
      },
    },
    student_final_answer: { type: "string", description: "The student's final answer, as a fraction like 2/5." },
    first_wrong_step_index: { type: "integer", description: "Index in steps of the first wrong step, -1 if none." },
    misconception: { type: "string", description: "Short name of the misconception, in English." },
    explanation_ht: {
      type: "string",
      description: "Short explanation for the student in Haitian Creole (Kreyòl ayisyen), warm, 3-5 sentences. Do not give the final answer.",
    },
    teaching_recommendation: { type: "string", description: "One next teaching move, in English." },
  },
  required: [
    "transcription",
    "steps",
    "student_final_answer",
    "first_wrong_step_index",
    "misconception",
    "explanation_ht",
    "teaching_recommendation",
  ],
  additionalProperties: false,
};

const system =
  "You are MATON, a patient math tutor for students in Haiti. Diagnose the student's exact misconception. " +
  "Write explanation_ht in natural Haitian Creole (Kreyòl ayisyen, standard orthography), never French. " +
  "Never state the correct final answer; guide the student to find it.";

let userContent;
if (photoPath) {
  const ext = extname(photoPath).toLowerCase();
  const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[ext];
  if (!mime) {
    console.error(`Unsupported photo type ${ext}. Use .jpg, .png or .webp.`);
    process.exit(1);
  }
  const data = (await readFile(photoPath)).toString("base64");
  userContent = [
    {
      type: "text",
      text:
        "This is a photo of a student's handwritten work. Transcribe it, split it into steps, " +
        "give each step's location as a box on a 0-1000 grid (origin top-left), and diagnose the mistake.",
    },
    { type: "image_url", image_url: { url: `data:${mime};base64,${data}` } },
  ];
} else {
  userContent =
    "A student solved this problem:\n1/2 + 1/3 = ?\nStudent's work:\n1/2 + 1/3 = (1+1)/(2+3) = 2/5\n" +
    "There is no photo, so set every box to zeros. Diagnose the mistake.";
}

const body = {
  model: MODEL,
  messages: [
    { role: "system", content: system },
    { role: "user", content: userContent },
  ],
  response_format: { type: "json_schema", json_schema: { name: "NotebookDiagnosis", strict: true, schema } },
};

console.log(`Model: ${MODEL} | mode: ${photoPath ? "photo" : "text"}`);
const started = Date.now();
let res;
try {
  res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
} catch (err) {
  console.error(`Request failed before a response: ${err.name}: ${err.message}`);
  process.exit(1);
}
const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`HTTP ${res.status} in ${seconds}s`);

const raw = await res.text();
if (!res.ok) {
  console.error(raw.slice(0, 1500));
  process.exit(1);
}

const payload = JSON.parse(raw);
const content = payload.choices?.[0]?.message?.content ?? "";
let result;
try {
  result = JSON.parse(content);
} catch {
  console.error("The model did not return valid JSON:\n" + content.slice(0, 1500));
  process.exit(1);
}

console.log(`Tokens: ${JSON.stringify(payload.usage ?? {})}`);
console.log(JSON.stringify(result, null, 2));

// ---- Code checks -------------------------------------------------------------
const [cn, cd] = correct;
const answerMatch = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(result.student_final_answer ?? "");
const studentRight = answerMatch ? Number(answerMatch[1]) * cd === Number(answerMatch[2]) * cn : null;
const leaked = new RegExp(`\\b${cn}\\s*/\\s*${cd}\\b`).test(result.explanation_ht ?? "");
console.log("\nCode checks:");
console.log(`  correct answer (computed by code): ${cn}/${cd}`);
console.log(`  model read the student's answer as: ${result.student_final_answer} -> ${studentRight === null ? "unreadable" : studentRight ? "correct" : "wrong"}`);
console.log(`  explanation gives away ${cn}/${cd}: ${leaked ? "YES (problem)" : "no"}`);

await mkdir("test-results", { recursive: true });
const out = `test-results/${photoPath ? "photo" : "text"}-${Date.now()}.json`;
await writeFile(out, JSON.stringify({ model: MODEL, seconds, usage: payload.usage, result }, null, 2));
console.log(`\nSaved: ${out}`);
