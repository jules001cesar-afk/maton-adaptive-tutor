# MATON Adaptive AI Tutor

Built for the Meta Global AI Developer Hackathon 2026 (Indie Developer track, "Build for Your World").

A student photographs handwritten homework. MATON finds the exact step where the
reasoning went wrong, marks the correction on the student's own page, explains it in
Haitian Creole, and gives a new practice exercise whose math is checked by code.

All code in this repository was written during the hackathon (started Oct 26, 2026).
It is a separate project from the existing MATON platform at maton-edu.com.

## How it works

1. **Meta Muse Spark** (`muse-spark-1.3`, Chat Completions + strict JSON schema) reads the photo,
   transcribes each step with its position on the page, names the operation and the
   misconception, and writes the explanation in Haitian Creole.
2. **Code verifies the math** (`shared/verify.ts`): exact fractions, every step re-computed,
   the first wrong step found independently. When the model and the code disagree, the code wins.
3. **Code makes the next exercise** (`shared/practice.ts`), so its answer is always right.
4. **Automatic text checks** (`shared/checks.ts`): one guiding question, answer not given away,
   no French/English words, safe accent restoration. These do not judge whether the Kreyòl is
   natural; a human review sheet does.

## Commands

```bash
npm test                                    # math unit tests, no API calls
npm run diagnose -- test-photos/notebook.jpg --effort medium
npm run diagnose -- --problem "1/2 + 1/3" --work "1/2 + 1/3 = 2/5"
npm run eval -- --effort medium             # 15 cases across 7 topics, writes a review sheet
```

## Setup

Copy `.dev.vars.example` to `.dev.vars` and paste your Meta Model API key after `MODEL_API_KEY=`.
The key is read only on the machine running the scripts. It is never printed or committed.
Requires Node 22.18+ (runs TypeScript directly, no build step).
