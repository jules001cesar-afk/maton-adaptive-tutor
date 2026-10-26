// Runs every case in tests/cases.ts through the real Meta Model API and scores it.
//
//   node --env-file=.dev.vars scripts/eval.ts [--effort low] [--only frac-add,add-carry]
//
// Writes test-results/eval-<time>.json and a review sheet (review-<time>.md) for a
// human to grade the Kreyòl. Automatic checks cannot judge whether Kreyòl is natural.
import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { diagnoseWork, type DiagnosisRun } from "../shared/diagnose.ts";
import type { ReasoningEffort } from "../shared/meta-client.ts";
import { CASES, type EvalCase } from "../tests/cases.ts";

const { values } = parseArgs({ options: { effort: { type: "string" }, only: { type: "string" } } });
const apiKey = process.env.MODEL_API_KEY?.trim();
if (!apiKey) {
  console.error("MODEL_API_KEY is empty.");
  process.exit(1);
}

const cases = values.only ? CASES.filter((c) => values.only!.split(",").includes(c.id)) : CASES;
type Row = { c: EvalCase; run?: DiagnosisRun; error?: string };
const rows: Row[] = [];

// Three at a time keeps us far below the rate limit.
for (let i = 0; i < cases.length; i += 3) {
  const batch = cases.slice(i, i + 3);
  rows.push(
    ...(await Promise.all(
      batch.map(async (c): Promise<Row> => {
        try {
          const run = await diagnoseWork(
            { text: { problem: c.problem, work: c.work } },
            { apiKey, reasoningEffort: values.effort as ReasoningEffort | undefined, seed: 1 },
          );
          return { c, run };
        } catch (err) {
          return { c, error: (err as Error).message };
        }
      }),
    )),
  );
  process.stdout.write(`${rows.length}/${cases.length} `);
}
console.log("\n");

const mark = (ok: boolean | null) => (ok === null ? "n/a" : ok ? "ok" : "NO");
const table = [
  "| case | operation | misconception | step (code/model) | answer hidden | 1 question | no FR/EN | accents fixed | seconds |",
  "|---|---|---|---|---|---|---|---|---|",
];
let passAll = 0;
for (const { c, run, error } of rows) {
  if (!run) {
    table.push(`| ${c.id} | ERROR: ${error} | | | | | | | |`);
    continue;
  }
  const d = run.diagnosis;
  const t = run.textChecks;
  const checks = {
    operation: d.operation === c.expect.operation,
    misconception: d.misconception_id === c.expect.misconception,
    step:
      run.verification && c.expect.firstWrongStep !== null
        ? run.verification.firstWrongStep === c.expect.firstWrongStep && run.stepAgreement === true
        : null,
    hidden: t.answerLeaked === null ? null : !t.answerLeaked,
    question: t.guidingQuestionMarks === 1 && t.questionsElsewhere.length === 0,
    language: t.foreignWords.length === 0,
  };
  if (Object.values(checks).every((x) => x !== false)) passAll++;
  table.push(
    `| ${c.id} | ${mark(checks.operation)} ${d.operation} | ${mark(checks.misconception)} ${d.misconception_id} | ${mark(checks.step)} ${run.verification?.firstWrongStep ?? "?"}/${d.first_wrong_step_index} | ${mark(checks.hidden)} | ${mark(checks.question)} | ${mark(checks.language)}${t.foreignWords.length ? ` (${t.foreignWords.join(" ")})` : ""} | ${t.accentFixes} | ${run.meta.seconds.toFixed(1)} |`,
  );
}

// Repeated openings across cases sound robotic.
const openings = rows.filter((r) => r.run).map((r) => r.run!.diagnosis.encouragement_ht.split(/\s+/).slice(0, 3).join(" ").toLowerCase());
const repeated = [...new Set(openings.filter((o, i) => openings.indexOf(o) !== i))];

const summary = [
  `Model: muse-spark-1.3 | effort: ${values.effort ?? "default"} | ${new Date().toISOString()}`,
  `All automatic checks passed: ${passAll}/${rows.length}`,
  `Repeated openings: ${repeated.length ? repeated.join(" | ") : "none"}`,
];
console.log(table.join("\n"));
console.log("\n" + summary.join("\n"));

const review = [
  "# Kreyòl review sheet",
  "",
  "Grade each case 1-5 on: natural Kreyòl, clear for a 10-14 year old, math correct, respectful tone.",
  "Automatic checks above do not judge naturalness; this sheet does.",
  "",
  ...rows.flatMap(({ c, run }) => {
    if (!run) return [];
    const d = run.diagnosis;
    return [
      `## ${c.id}: ${c.work.replace(/\n/g, " / ")}`,
      "",
      `- ${d.encouragement_ht}`,
      `- ${d.student_action_ht}`,
      `- ${d.concept_ht}`,
      d.example_ht ? `- ${d.example_ht}` : "- (no example)",
      `- **${d.guiding_question_ht}**`,
      `- Konsèy: ${d.practice_hint_ht}`,
      `- Practice (code): ${run.practice?.problem ?? "none"}`,
      "",
      "Natural: _ /5 | Clear: _ /5 | Math: _ /5 | Tone: _ /5 | Notes:",
      "",
    ];
  }),
];

await mkdir("test-results", { recursive: true });
const stamp = Date.now();
await writeFile(`test-results/eval-${stamp}.json`, JSON.stringify({ summary, rows }, null, 2));
await writeFile(`test-results/review-${stamp}.md`, [...summary, "", ...table, "", ...review].join("\n"));
console.log(`\nSaved: test-results/eval-${stamp}.json and test-results/review-${stamp}.md`);
