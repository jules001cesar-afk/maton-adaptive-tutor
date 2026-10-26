// Automatic checks on the model's Kreyòl text. They catch obvious problems only:
// passing them does NOT mean the Kreyòl is natural. A human review decides that.
import type { Diagnosis } from "./tutor-prompt.ts";
import type { Verification } from "./verify.ts";

const HT_FIELDS = [
  "encouragement_ht",
  "student_action_ht",
  "concept_ht",
  "example_ht",
  "guiding_question_ht",
  "practice_hint_ht",
] as const;

// Common French / English words that are not Kreyòl (Kreyòl "la", "de", "ki", "pou" are fine).
const FRENCH = ["est", "nous", "vous", "avec", "dans", "être", "c'est", "les", "des", "une", "qui", "que", "pour", "mais", "aussi", "donc", "très"];
const ENGLISH = ["the", "and", "is", "you", "with", "this", "that", "of"];

// Unaccented spellings that are not Kreyòl words, so restoring the accent is always safe.
// Words that are valid both ways (te, se, ke, kle, divize...) are deliberately left out.
const ACCENTS: Record<string, string> = {
  anle: "anlè", anko: "ankò", cheche: "chèche", denominate: "denominatè", deye: "dèyè",
  dezyem: "dezyèm", dizen: "dizèn", fe: "fè", fok: "fòk", gwose: "gwosè", kolon: "kolòn",
  kom: "kòm", konple: "konplè", le: "lè", lot: "lòt", nimerate: "nimeratè", parey: "parèy",
  pemet: "pèmèt", pwoblem: "pwoblèm", res: "rès", santen: "santèn", twazyem: "twazyèm",
  vale: "valè", we: "wè",
};

/** Restore missing accents in place. Returns how many words were fixed. */
export function fixAccents(d: Diagnosis): number {
  let fixed = 0;
  for (const f of HT_FIELDS) {
    d[f] = d[f].replace(/\p{L}+/gu, (w) => {
      const right = ACCENTS[w.toLowerCase()];
      if (!right) return w;
      fixed++;
      return w[0] === w[0].toUpperCase() ? right[0].toUpperCase() + right.slice(1) : right;
    });
  }
  return fixed;
}

export type TextChecks = {
  accentFixes: number;
  foreignWords: string[];
  guidingQuestionMarks: number;
  questionsElsewhere: string[];
  answerLeaked: boolean | null;
};

const words = (s: string) => s.toLowerCase().split(/[^\p{L}']+/u).filter(Boolean);

/** Forms of the correct answer that would give it away if they appeared in the Kreyòl text. */
function leakPatterns(v: Verification): RegExp[] | null {
  const c = v.correct;
  if (c.kind === "solution") {
    if (c.solution.kind !== "one") return null;
    const { n, d } = c.solution.x;
    return [new RegExp(`\\bx\\s*=\\s*${d === 1 ? n : `${n}\\s*/\\s*${d}`}\\b`)];
  }
  if (c.kind === "remainder") return [new RegExp(`\\b${c.q}\\s*(rès|r)\\s*${c.r}\\b`, "i")];
  const { n, d } = c.value;
  if (d !== 1) return [new RegExp(`\\b${n}\\s*/\\s*${d}\\b`)];
  // A one-digit whole answer also appears in ordinary sentences, so it cannot be checked this way.
  return Math.abs(n) >= 10 ? [new RegExp(`(?<![\\d/])${n}(?![\\d/])`)] : null;
}

export function checkKreyol(d: Diagnosis, v: Verification | null, accentFixes = 0): TextChecks {
  const all = HT_FIELDS.map((f) => d[f]).join(" ");
  const tokens = words(all);
  const foreignWords = [...new Set(tokens.filter((t) => FRENCH.includes(t) || ENGLISH.includes(t)))];
  const patterns = v ? leakPatterns(v) : null;
  return {
    accentFixes,
    foreignWords,
    guidingQuestionMarks: (d.guiding_question_ht.match(/\?/g) ?? []).length,
    questionsElsewhere: HT_FIELDS.filter((f) => f !== "guiding_question_ht" && d[f].includes("?")),
    answerLeaked: patterns ? patterns.some((p) => p.test(all)) : null,
  };
}
