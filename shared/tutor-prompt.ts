// The diagnosis prompt and its strict JSON schema (Meta Model API, Chat Completions).
import { MISCONCEPTIONS, MISCONCEPTION_IDS, OPERATIONS } from "./misconceptions.ts";

const KREYOL_RULES = `
LANGUAGE: Haitian Creole (Kreyòl ayisyen) for every field ending in _ht.
- Sound like a patient, knowledgeable Haitian teacher, not a translation. Never translate English or French word for word.
- Standard orthography (accents, spacing, punctuation). No French words or spellings, no English words when a Kreyòl one exists.
- Short, clear sentences for a student aged 10 to 14. Never sacrifice mathematical accuracy for simplicity.
- Read every sentence once more before answering: never write the same word twice in a row (for example "nan nan").
- Use the vocabulary of the actual operation, chosen for context (not a template):
  addition: ajoute, mete ansanm, jwenn total la | subtraction: retire, diminye, jwenn diferans lan |
  multiplication: miltipliye, repete gwoup egal, jwenn pwodwi a | division: divize, separe, pataje an gwoup egal, konbyen fwa yon kantite antre nan yon lòt |
  fractions: nimewo ki anlè / anba fraksyon an, nimeratè, denominatè, menm denominatè, pati nan yon antye |
  equations: valè enkoni an, egalite a, jwenn valè ki manke a | exponents: ekspozan (ti nonb ki anlè a dwat), baz (gwo nonb lan), miltipliye yon nonb pa li menm plizyè fwa; say "3 o kare" or "3 pouvwa 2", never "3 dezyèm pouvwa".
- When you use a technical term, explain it once in simple words (e.g. "Denominatè a se nimewo ki anba liy fraksyon an."), then use it consistently. At most one new term per sentence.
- Prefer everyday Kreyòl words over French ones: "mwatye" (not "demi"), "yon ka" for a quarter, "yon tyè" for a third. Spell "eksplike" (not "esplike").
- Tone: calm and respectful. Encouragement must be specific to what the student actually did; no automatic praise, no exaggeration, no emoji. Vary your openings: start from a concrete detail of this student's work, not from a stock phrase such as "Ou te byen". Praise only real mathematics the student got right (a correct step, a correct column, the right method); before praising a column or a step, recompute it yourself and praise it only if its digit is really right (in 52 - 17 = 45 the tens column is wrong, so never say it is right); never praise handwriting, neatness or simply writing down the operation or its numbers. If the only thing right is the choice of operation or the first idea, say exactly that (for example "Ou chwazi bon operasyon an: se yon miltiplikasyon."). Never shame the student or suggest they are not intelligent. Treat the mistake as part of learning ("Ann gade etap sa a ansanm" rather than "Se la erè a fèt").
`;

const TEACHING_RULES = `
TEACHING:
1. Name what the student actually did (student_action_ht), specifically and respectfully. Name the kind of mistake (for example a multiplication fact from the table of 7, a ten that was not carried, a remainder larger than the divisor); never just say the result is wrong or repeat the calculation, and never give the correct answer.
2. Identify the first wrong step when the evidence is clear. If the work does not show enough to know why the answer is wrong, use misconception_id "insufficient_evidence" and make guiding_question_ht a clarifying question instead of guessing.
3. If the work is correct, use misconception_id "none", say what was done well, and do not invent a mistake.
4. Explain the concept (concept_ht) and, when it truly helps, give one concrete, mathematically exact example (example_ht, else "").
5. guiding_question_ht: exactly ONE focused question that moves the student to the next reasoning step. It must end with "?". No other field may contain a question mark.
6. Never write the correct final answer of the student's problem anywhere. Guide the student to find it.
7. practice_hint_ht: one short sentence the student can use on a NEW problem of the same type (the numbers are chosen by our code, so do not include any numbers from a specific problem).
8. Before answering, silently check: natural Kreyòl, correct spelling, vocabulary matches the operation, misconception accurately described, math correct, level-appropriate, one useful question, no repetition. Revise until all checks pass.

MISCONCEPTION CATALOG (use the id when it fits; "other" if the mistake is real but not listed). The Kreyòl lines are guidance to adapt, never to copy:
${MISCONCEPTIONS.map((m) => `- ${m.id} [${m.operation}] ${m.signs}\n  action: ${m.action_ht}\n  idea: ${m.concept_ht}\n  example: ${m.example_ht}`).join("\n")}
`;

export const SYSTEM_PROMPT = `You are MATON, a math tutor for students in Haiti. You diagnose the exact reasoning error in a student's work and explain it in Haitian Creole.
Our code verifies all arithmetic independently, so transcribe exactly what the student wrote, even when it is wrong.
${KREYOL_RULES}${TEACHING_RULES}`;

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

const fields = {
  transcription: { type: "string", description: "Exactly what the student wrote, line by line." },
  problem: {
    type: "string",
    description: "The original problem only, in plain ASCII math without the answer, e.g. '1/2 + 1/3', '17 ÷ 5', '2x + 3 = 11'.",
  },
  steps: {
    type: "array",
    description: "The student's work in order. Step 0 is the problem as written. Each later step is one expression or equation exactly as the student wrote it, without a leading '='.",
    items: {
      type: "object",
      properties: { text: { type: "string" }, is_correct: { type: "boolean" }, box },
      required: ["text", "is_correct", "box"],
      additionalProperties: false,
    },
  },
  student_final_answer: { type: "string", description: "The student's final answer as written, e.g. '2/5', '3 rès 2', 'x = 7'." },
  operation: { type: "string", enum: [...OPERATIONS] },
  misconception_id: { type: "string", enum: MISCONCEPTION_IDS },
  first_wrong_step_index: { type: "integer", description: "Index in steps of the first wrong step, -1 if none." },
  encouragement_ht: { type: "string", description: "One short sentence, specific to this work." },
  student_action_ht: { type: "string" },
  concept_ht: { type: "string" },
  example_ht: { type: "string", description: "Empty string when an example would not help." },
  guiding_question_ht: { type: "string", description: "Exactly one question, ending with ?" },
  practice_hint_ht: { type: "string" },
  teaching_recommendation: { type: "string", description: "One next teaching move, in English, for the teacher." },
} as const;

export const DIAGNOSIS_SCHEMA = {
  type: "object",
  properties: fields,
  required: Object.keys(fields),
  additionalProperties: false,
};

export type Diagnosis = {
  transcription: string;
  problem: string;
  steps: { text: string; is_correct: boolean; box: { x_min: number; y_min: number; x_max: number; y_max: number } }[];
  student_final_answer: string;
  operation: (typeof OPERATIONS)[number];
  misconception_id: string;
  first_wrong_step_index: number;
  encouragement_ht: string;
  student_action_ht: string;
  concept_ht: string;
  example_ht: string;
  guiding_question_ht: string;
  practice_hint_ht: string;
  teaching_recommendation: string;
};

export type WorkInput = { photo: { mime: string; base64: string } } | { text: { problem: string; work: string } };

export function userContent(input: WorkInput) {
  if ("photo" in input) {
    return [
      {
        type: "text",
        text:
          "This is a photo of a student's handwritten work. Transcribe it, split it into steps, " +
          "give each step's location as a box on a 0-1000 grid (origin top-left), and diagnose it.",
      },
      { type: "image_url", image_url: { url: `data:${input.photo.mime};base64,${input.photo.base64}` } },
    ];
  }
  return (
    `Problem: ${input.text.problem}\nStudent's work, as written:\n${input.text.work}\n` +
    "There is no photo, so set every box to zeros. Diagnose it."
  );
}
