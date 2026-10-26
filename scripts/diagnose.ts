// Diagnose one piece of student work with the Meta Model API.
//
//   node --env-file=.dev.vars scripts/diagnose.ts test-photos/notebook-1.jpg
//   node --env-file=.dev.vars scripts/diagnose.ts --problem "1/2 + 1/3" --work "1/2 + 1/3 = 2/5"
//   options: --effort low|medium|high   --level 1|2|3   --seed 42
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { parseArgs } from "node:util";

import { diagnoseWork } from "../shared/diagnose.ts";
import type { ReasoningEffort } from "../shared/meta-client.ts";
import type { Level } from "../shared/practice.ts";
import type { WorkInput } from "../shared/tutor-prompt.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    problem: { type: "string" },
    work: { type: "string" },
    effort: { type: "string" },
    level: { type: "string" },
    seed: { type: "string" },
  },
});

const apiKey = process.env.MODEL_API_KEY?.trim();
if (!apiKey) {
  console.error("MODEL_API_KEY is empty. Paste your key into .dev.vars after MODEL_API_KEY= and run again.");
  process.exit(1);
}

let input: WorkInput;
const photoPath = positionals[0];
if (photoPath) {
  const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[
    extname(photoPath).toLowerCase()
  ];
  if (!mime) throw new Error("Use a .jpg, .png or .webp photo.");
  input = { photo: { mime, base64: (await readFile(photoPath)).toString("base64") } };
} else if (values.problem && values.work) {
  input = { text: { problem: values.problem, work: values.work.replace(/\\n/g, "\n") } };
} else {
  console.error("Give a photo path, or --problem and --work.");
  process.exit(1);
}

const run = await diagnoseWork(input, {
  apiKey,
  model: process.env.MODEL_ID,
  reasoningEffort: values.effort as ReasoningEffort | undefined,
  level: values.level ? (Number(values.level) as Level) : undefined,
  seed: values.seed ? Number(values.seed) : undefined,
});

const d = run.diagnosis;
const v = run.verification;
console.log(`${run.meta.model} | ${run.meta.seconds.toFixed(1)}s | tokens ${JSON.stringify(run.meta.usage)}\n`);
console.log(`Transcription: ${d.transcription}`);
console.log(`Operation: ${d.operation} | misconception: ${d.misconception_id}`);
console.log(`\nKreyòl:\n  ${d.encouragement_ht}\n  ${d.student_action_ht}\n  ${d.concept_ht}\n  ${d.example_ht}\n  ${d.guiding_question_ht}\n  Konsèy: ${d.practice_hint_ht}`);
console.log("\nCode checks:");
if (v) {
  console.log(`  correct answer (code): ${v.correctText}`);
  v.steps.forEach((s, i) => console.log(`  step ${i}: ${s.text}  ->  ${s.shown ?? "?"} ${s.matches === null ? `(unreadable: ${s.error})` : s.matches ? "ok" : "WRONG"}`));
  console.log(`  first wrong step: code ${v.firstWrongStep}, model ${d.first_wrong_step_index} -> ${run.stepAgreement ? "agree" : "DISAGREE"}`);
} else {
  console.log(`  could not verify: ${run.verificationError}`);
}
const t = run.textChecks;
console.log(`  answer given away: ${t.answerLeaked === null ? "n/a" : t.answerLeaked ? "YES" : "no"}`);
console.log(`  question marks in the guiding question: ${t.guidingQuestionMarks} | questions elsewhere: ${t.questionsElsewhere.join(", ") || "none"}`);
console.log(`  French/English words: ${t.foreignWords.join(", ") || "none"}`);
console.log(`  practice (code): ${run.practice ? `${run.practice.problem}  [answer ${run.practice.answerText}]` : "none"}`);

await mkdir("test-results", { recursive: true });
const out = `test-results/diagnose-${Date.now()}.json`;
await writeFile(out, JSON.stringify(run, null, 2));
console.log(`\nSaved: ${out}`);
