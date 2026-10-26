// One full pass: Meta model reads and diagnoses the work, code verifies the math,
// code makes the next practice problem. Shared by the scripts and, later, the web server.
import { checkKreyol, fixAccents, type TextChecks } from "./checks.ts";
import { chatJson, type ReasoningEffort } from "./meta-client.ts";
import { makePractice, type Level, type Practice } from "./practice.ts";
import { DIAGNOSIS_SCHEMA, SYSTEM_PROMPT, userContent, type Diagnosis, type WorkInput } from "./tutor-prompt.ts";
import { verifyWork, type Verification } from "./verify.ts";

export type DiagnosisRun = {
  diagnosis: Diagnosis;
  /** Null when our code could not parse the problem; the diagnosis is then unverified. */
  verification: Verification | null;
  verificationError?: string;
  /** Model and code agree on which step is the first wrong one. */
  stepAgreement: boolean | null;
  practice: Practice | null;
  textChecks: TextChecks;
  meta: { model: string; seconds: number; usage: unknown };
};

export async function diagnoseWork(
  input: WorkInput,
  opts: { apiKey: string; model?: string; reasoningEffort?: ReasoningEffort; level?: Level; seed?: number },
): Promise<DiagnosisRun> {
  const model = opts.model ?? "muse-spark-1.3";
  const res = await chatJson<Diagnosis>({
    apiKey: opts.apiKey,
    model,
    // Medium: cleaner Kreyòl (accents, varied openings) than low, ~11 s per answer.
    reasoningEffort: opts.reasoningEffort ?? "medium",
    schemaName: "NotebookDiagnosis",
    schema: DIAGNOSIS_SCHEMA,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent(input) },
    ],
  });
  const d = res.data;
  const accentFixes = fixAccents(d);

  let verification: Verification | null = null;
  let verificationError: string | undefined;
  try {
    // With a typed problem we trust our own copy of it, not the model's.
    const problem = "text" in input ? input.text.problem : d.problem;
    verification = verifyWork(problem, d.steps.map((s) => s.text), d.student_final_answer);
  } catch (err) {
    verificationError = (err as Error).message;
  }

  const practice = makePractice({
    misconceptionId: d.misconception_id,
    operation: d.operation,
    level: opts.level,
    seed: opts.seed,
    avoid: d.problem,
  });

  return {
    diagnosis: d,
    verification,
    verificationError,
    stepAgreement: verification ? verification.firstWrongStep === d.first_wrong_step_index : null,
    practice,
    textChecks: checkKreyol(d, verification, accentFixes),
    meta: { model, seconds: res.seconds, usage: res.usage },
  };
}
