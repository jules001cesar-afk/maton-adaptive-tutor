# Evidence

Every file here was produced by this repository's own code; nothing was written by hand or
invented. Each item is labelled **real** (a recorded call to Meta's Model API), **rendered
locally** (real code run on a recorded result, nothing sent) or **simulated** (automated tests
with Meta and WhatsApp replaced by fakes), and says what it does and does not show.

| File | What it is | Source | Kind |
|---|---|---|---|
| [npm-test-output.txt](npm-test-output.txt) | The 32 automated tests passing | `node --test --test-reporter=spec "tests/*.test.ts"`, run 2026-10-28 | Automated tests. Meta and WhatsApp are **simulated** with fakes; no network calls |
| [diagnosis-trace-47-plus-38.json](diagnosis-trace-47-plus-38.json) | One full diagnosis of a notebook photo: Muse Spark's steps and Kreyòl text, the code's own re-computation, the practice problem, the text checks | `npm run diagnose` on a phone photo of fictional homework, 2026-10-26 20:38, copied unchanged from `test-results/` | **Real** Muse Spark (`muse-spark-1.3`) output, through the same `diagnoseWork()` the WhatsApp webhook calls. Not a WhatsApp conversation |
| [whatsapp-reply-rendered-47-plus-38.txt](whatsapp-reply-rendered-47-plus-38.txt) | The WhatsApp text the webhook builds from that trace | `diagnosisMessage()` from `shared/whatsapp.ts`, run locally on the trace above | **Rendered locally** by the real code. Not sent on WhatsApp |
| [Phone photo runs](#phone-photo-runs) (below) | 8 notebook photos diagnosed in one batch | `npm run diagnose` on 8 phone photos, 2026-10-26 20:38; summarised from the JSON in `test-results/` | **Real** Muse Spark output. Summary written by a script |
| WhatsApp screenshots | Not added yet | | See [Screenshots still needed](#screenshots-still-needed) |

## How to read the trace

- `diagnosis` is what Muse Spark returned: the transcription, each step with its position on the
  page (`box`, 0-1000 scale), the misconception and the Kreyòl texts (`*_ht`).
- `verification` is computed by code (`shared/verify.ts`), not by the model: the right result is
  85, step 1 ("47 + 38 = 75") does not match it, so `firstWrongStep` is 1. `stepAgreement: true`
  means the model and the code found the same wrong step.
- `practice` is made by code (`shared/practice.ts`). Its `answer` stays on the server: compare
  with the rendered reply, which shows `66 + 15 = ?` and never `81` or `85`.
- `textChecks` are the automatic checks (`shared/checks.ts`): no French or English words, one
  guiding question, `answerLeaked: false`.
- The photo itself is not included. The trace holds no phone number, name, key or token.

## Phone photo runs

Eight phone photos of handwritten, fictional homework, diagnosed together on 2026-10-26
(evening of the hackathon's first day). "Model" and "Code" are the index of the first wrong
step found by Muse Spark and by `shared/verify.ts`.

| Transcription by Muse Spark | Misconception | Model | Code | Answer given away | Practice made by code | Seconds |
|---|---|---|---|---|---|---|
| `7 x 8 = 54` | mul_fact_error | 1 | 1 | no | `7 × 8` | 12.6 |
| `47 + 38 = 75` | add_no_carry | 1 | 1 | no | `66 + 15` | 17.7 |
| `29 ÷ 4 = 6 / Res 5` | div_remainder_too_big | 1 | 1 | no | `21 ÷ 5` | 18.5 |
| `52 - 17 = 45` | sub_smaller_from_larger | 1 | 1 | no | `84 - 65` | 19.8 |
| `2/3 + 1/4 = 3/7` | frac_add_across | 1 | 1 | no | `3/5 + 3/4` | 21.5 |
| `1/2 ÷ 1/4 = 3/2` | insufficient_evidence | 1 | 1 | not checked | `2/3 + 2/4` | 22.3 |
| `3^2 +4 =9` | insufficient_evidence | 1 | 1 | no | `5^3` | 26.1 |
| `x + 5 = 12 / x = 12 + 5 / x = 17` | eq_inverse_operation_wrong | 1 | 1 | no | `2x + 7 = 15` | 32.6 |

What this shows, and what it does not:

- On all 8 photos, the model and the code agree on the first wrong step.
- Two photos got `insufficient_evidence`: the work shows only a final answer, and the model
  says so instead of guessing a cause. For `1/2 ÷ 1/4` the answer-leak check says "not
  checked": the right answer is the single digit 2, which also appears in ordinary sentences,
  so `shared/checks.ts` does not search for it.
- Seen while preparing this page, not fixed: for `7 x 8 = 54` the practice problem is the
  same multiplication (`7 × 8`), and for `1/2 ÷ 1/4` the practice is a fraction addition.
- These runs were made from the command line, before the WhatsApp channel was added
  (commit `4ac5d42`, 21:10 the same day). The WhatsApp webhook calls the same `diagnoseWork()`.
- The 8 calls were started together, so the seconds include waiting for each other. A single
  earlier run (`1/2 + 1/3`, same day) took 5.2 s.

## Screenshots still needed

These must be real screenshots from a phone. None has been created or edited here. Before
adding one, check that it shows no personal phone number, name or contact photo.

1. **Photo in, explanation out:** the notebook photo sent, the "Mwen resevwa foto a…" message,
   and the full explanation ending with `Pratike (1/3)`.
2. **Wrong answer:** a wrong reply and the `Poko.` message with the same problem.
3. **Right answers to the end:** `Wi, se sa!`, the 2/3 and 3/3 problems, and `Bravo!`.
   A screenshot of this from 2026-10-27 exists (84 − 65, 364 − 193, 771 − 514) and covers
   items 2 and 3; it is waiting for approval to be added.
4. **Welcome:** a text such as "bonjou" with no practice in progress, and the welcome reply.
5. Optional: the Meta dashboard's **WhatsApp > Configuration** page showing the callback URL
   ending in `/api/whatsapp` and the `messages` field subscribed, with no token visible.
