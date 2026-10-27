# MATON Kaye

Snap your notebook, get a Kreyòl tutor.

Built for the Meta Global AI Developer Hackathon 2026 (Indie Developer track, "Build for Your World").

A student in Haiti photographs handwritten math homework on paper. MATON Kaye finds the
exact step where the reasoning went wrong, circles it in red (and the good steps in green)
on the student's own page, explains the mistake in Haitian Creole, and then gives new
practice exercises until the student gets three in a row.

It is not a chatbot. The student never types a prompt: the notebook page is the input,
and the output is a corrected page, one explanation and a short practice loop.

## Why

Many Haitian students learn math on paper, think in Kreyòl, and share one phone with slow
data. Tutoring apps assume English, a keyboard and typed equations. MATON Kaye starts from
what the student already has: a notebook and a camera.

## How it works

```
photo ──► Muse Spark ──► steps + positions + misconception + Kreyòl explanation
   │                              │
   └──► SAM 3.1 ──► boxes for the handwritten numbers and "=" signs
                                  │
                code: verify the math, place the marks, make the next exercise
```

1. **Meta Muse Spark** (`muse-spark-1.3`, Chat Completions with a strict JSON schema) reads the
   photo, transcribes each step with its position on the page, names the operation and the
   misconception (15 known ones, `shared/misconceptions.ts`), and writes the explanation in
   Haitian Creole (`shared/tutor-prompt.ts`).
2. **Meta SAM 3.1** runs at the same time and returns boxes for the handwritten numbers and
   the "=" signs (`shared/sam-client.ts`).
3. **Code places the marks** (`shared/refine.ts`): it lines up the model's rough step boxes
   with SAM's numbers, gives each number to exactly one step, and on one-line work circles
   only the new answer, not the problem again. If SAM fails, the model's own boxes are used.
4. **Code verifies the math** (`shared/verify.ts`): exact fractions, every step re-computed,
   the first wrong step found independently. When the model and the code disagree, the code wins.
5. **Code makes the next exercise** (`shared/practice.ts`), so its answer is always right.
   The answer stays on the server; the browser only receives the problem, and
   `POST /api/check` grades the student's answer.
6. **Automatic text checks** (`shared/checks.ts`): one guiding question, answer not given away,
   no French or English words, safe accent restoration. These do not judge whether the Kreyòl
   sounds natural; a human review does.

If the Meta API cannot be reached, the app can show a result recorded earlier from a real
Muse Spark + SAM 3.1 run on the demo photo. It is always labelled on screen as recorded,
never presented as a live answer. (WhatsApp never uses it: it says plainly that Meta could not be reached.)

## On WhatsApp

The same tutor also works in WhatsApp, the app many students and families already use
every day (`shared/whatsapp.ts`, webhook at `/api/whatsapp`):

1. The student sends a photo of the notebook page.
2. MATON Kaye replies in Kreyòl: what it read, the step to look at, what the student did,
   the idea to remember, an example and one guiding question. No answer is given.
3. It sends a practice problem made by code. The student types an answer; code checks it.
   A wrong answer gets a hint, a right one gets the next problem, and three in a row ends
   with "Bravo!".

Every request must carry Meta's `X-Hub-Signature-256` signature. The current exercise is kept
for 1 hour in Cloudflare KV under a hashed phone number, never the number itself, and phone
numbers and message text are never logged. Privacy policy: `/privacy`.

During the hackathon the WhatsApp number is Meta's test number, which can only message
numbers added to the app (5 at most). The web app is open to everyone.

## Privacy and safety

- The Meta API key lives only on the server (`.dev.vars` locally, an encrypted secret when
  deployed). It is never sent to the browser, logged, or committed.
- Photos are resized in the browser (max 1600 px). Re-encoding drops EXIF data such as GPS
  location. Photos are not stored.
- Only box coordinates are sent back to the browser, never full SAM masks.
- All test data in this repository is fictional. No real student data is used.

## Run it

Requires Node 22.18+ (TypeScript runs directly, no build step for the scripts).

```bash
npm install
cp .dev.vars.example .dev.vars              # then paste your Meta Model API key after MODEL_API_KEY=
npx vite build                              # build the web app into dist/
npx wrangler pages dev dist                 # app + API at http://localhost:8788
```

Other commands:

```bash
npm test                                                        # unit tests, no API calls
npm run diagnose -- test-photos/notebook.jpg --effort medium    # one photo from the command line
npm run diagnose -- --problem "1/2 + 1/3" --work "1/2 + 1/3 = 2/5"
npm run eval -- --effort medium                                 # 15 cases across 7 topics
node --env-file=.dev.vars scripts/debug-marks.ts <photo> <w> <h>   # where every mark comes from
```

## Project layout

| Path | What it is |
|---|---|
| `src/` | React web app: photo, analysis, corrected page, explanation, practice |
| `functions/api/` | Cloudflare Pages Functions: `/api/analyze`, `/api/check` and `/api/whatsapp` |
| `shared/` | Code shared by the server and the scripts: Meta clients, prompt, math, marks |
| `tests/` | Unit tests: math, marks, `/api/check` safety, Meta API errors, bad photos, fallback |
| `scripts/` | Command-line tools for diagnosis, evaluation and mark debugging |

## What's new (hackathon work)

Everything in this repository was written during the hackathon. The first commit is
Oct 26, 2026; the full history is in `git log`. This includes:

- the photo → Muse Spark + SAM 3.1 pipeline and the Kreyòl tutor prompt
- the code that verifies each step and places the red and green marks
- the misconception list, the practice generator and the answer checking
- the web app, the API endpoints and the WhatsApp channel
- the tests and evaluation scripts

Reused from before the hackathon: only the MATON name, logo and colours. MATON is an existing
education platform in Haiti (maton-edu.com). MATON Kaye is a separate, new project and shares
no code with it.

## Limits

- Arithmetic, fractions, powers, division with remainder and simple equations. No geometry
  or word problems yet.
- The Kreyòl explanations are checked automatically and reviewed by hand, but the model can
  still make wording mistakes.
- Blurry or very dark photos can put a mark in the wrong place. The diagnosis itself comes
  from the transcription, not from the marks.
