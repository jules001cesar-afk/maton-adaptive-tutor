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

Step-by-step walkthrough with the code behind each message:
[docs/whatsapp-walkthrough.md](docs/whatsapp-walkthrough.md). Test output, a real Muse Spark
trace and the reply built from it: [docs/evidence/](docs/evidence/README.md).

No WhatsApp number is shared with the judges: anyone can run the channel with their own
free Meta test number, as described in
[Run WhatsApp with your own test number](#run-whatsapp-with-your-own-test-number).

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

## Run WhatsApp with your own test number

The WhatsApp channel needs no code change and no number of ours: the code reads the sending
phone number ID from each message Meta delivers. You need your own Meta developer app with
the WhatsApp product, which comes with a free test number.

What was checked: the steps below are the ones used to set up the live channel, and the local
checks in step 5 were run on `wrangler pages dev`. Steps marked **(not tested)** were not run
by us.

### 1. Meta app and test number

1. At [developers.facebook.com/apps](https://developers.facebook.com/apps), create an app
   (type "Business") and add the **WhatsApp** product. Meta creates a test number for it.
2. In **WhatsApp > API Setup**, under "To", add the phone number you will test from (up to 5).
   WhatsApp sends a code to that phone; type it in.
3. On the same page, send the **hello_world** template to that phone. Until it has received
   a message from the test number, WhatsApp may say the test number "isn't on WhatsApp".

### 2. Secrets

Copy `.dev.vars.example` to `.dev.vars` and fill in:

| Variable | Where it comes from |
|---|---|
| `MODEL_API_KEY` | Your Meta Model API key (Muse Spark and SAM 3.1) |
| `WHATSAPP_TOKEN` | **WhatsApp > API Setup > Generate access token** (expires after about 24 hours), or a system user token with `whatsapp_business_messaging` and `whatsapp_business_management` |
| `WHATSAPP_APP_SECRET` | **App settings > Basic > App secret** |
| `WHATSAPP_VERIFY_TOKEN` | Any long random string you choose |

The `MATON_KV` binding in `wrangler.toml` stores practice sessions. Locally,
`wrangler pages dev` keeps it in a local store, so nothing has to be created.

### 3. A public HTTPS address for the webhook

Meta must reach `/api/whatsapp` over HTTPS, so `localhost` alone is not enough. Two options:

**A. Local server and a tunnel (not tested).**

```bash
npx vite build
npx wrangler pages dev dist                       # http://localhost:8788
cloudflared tunnel --url http://localhost:8788    # in a second terminal (not tested)
```

`cloudflared` is a separate download. It prints an `https://….trycloudflare.com` address;
any other HTTPS tunnel works the same way.

**B. Your own Cloudflare Pages project.** This is how the live demo runs.

```bash
npx wrangler kv namespace create MATON_KV        # put the printed id in wrangler.toml
npx wrangler pages project create maton-adaptive-tutor
npx wrangler pages secret put MODEL_API_KEY --project-name maton-adaptive-tutor
npx wrangler pages secret put WHATSAPP_TOKEN --project-name maton-adaptive-tutor
npx wrangler pages secret put WHATSAPP_APP_SECRET --project-name maton-adaptive-tutor
npx wrangler pages secret put WHATSAPP_VERIFY_TOKEN --project-name maton-adaptive-tutor
npx vite build
npx wrangler pages deploy dist --project-name maton-adaptive-tutor --branch main
```

The `id` in `wrangler.toml` belongs to our Cloudflare account; replace it with yours. A secret
added after a deploy only takes effect after the next deploy.

### 4. Connect the webhook

1. In **WhatsApp > Configuration**, set the callback URL to `https://<your address>/api/whatsapp`
   and the verify token to your `WHATSAPP_VERIFY_TOKEN`, then **Verify and save**.
2. Under **Webhook fields**, subscribe to `messages`.
3. Subscribe your WhatsApp Business Account to the app. Without this, no messages reached our
   webhook. The account ID is shown in **WhatsApp > API Setup**.

   ```bash
   curl -X POST "https://graph.facebook.com/v25.0/<WABA_ID>/subscribed_apps" \
     -H "Authorization: Bearer $WHATSAPP_TOKEN"            # answers {"success":true}
   ```

4. Our app was also switched to **Live** mode, which needs a privacy policy URL (ours is
   `/privacy`). We did not check whether a test number needs this.

### 5. Check it

Local checks that need no Meta account (run on `npx wrangler pages dev dist`):

```bash
# Webhook verification: prints 42 with the right token, "forbidden" with a wrong one.
curl "http://localhost:8788/api/whatsapp?hub.mode=subscribe&hub.verify_token=<your token>&hub.challenge=42"
# A POST without Meta's signature is refused: prints "bad signature"
# (or "not configured" if a WhatsApp secret is missing from .dev.vars).
curl -X POST http://localhost:8788/api/whatsapp -d '{}'
```

Then the real conversation, from the phone you added in step 1:

| You send | MATON Kaye answers |
|---|---|
| any text, with no practice in progress | a short welcome asking for a notebook photo |
| a photo of handwritten math | "Mwen resevwa foto a…" (working), then 20-30 s later: what it read, the step to look at, what you did, the idea, an example, a guiding question, and `Pratike (1/3): … = ?` |
| a wrong answer | `Poko.` with a hint, and the same problem again |
| the right answer | `Wi, se sa! Ou jwenn li.` and the next problem (2/3, 3/3) |
| the third right answer in a row | `Bravo! Ou rezoud 3 egzèsis youn apre lòt.` |

The answers are never sent before the student writes their own. A GIF or other unsupported
file gets a plain message, and an unavailable Meta API gets a plain "try again later" message,
never a recorded result.

### Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| "Verify and save" fails | The verify token differs from `WHATSAPP_VERIFY_TOKEN`, or the URL does not end in `/api/whatsapp`, or (deployed) the secret was added after the last deploy |
| The phone says the test number "isn't on WhatsApp" | Send the `hello_world` template from API Setup first |
| Messages arrive on the phone but nothing reaches the server | The WhatsApp Business Account is not subscribed (step 4.3) or the `messages` field is not subscribed |
| Server answers 401 `bad signature` | `WHATSAPP_APP_SECRET` is not the secret of the app that owns the webhook |
| Server answers 500 `not configured` | One of the four secrets or the `MATON_KV` binding is missing |
| Log shows `send failed (status 401, code 190 …)` (not seen by us) | The access token expired (temporary tokens last about 24 hours) |
| Log shows `send failed (… code 10 …)` with a system user token | In Business settings, give the system user both the WhatsApp account asset and **Messaging accounts > Test Messaging Account** |
| Log shows `send failed (… code 131030 …)` (not seen by us) | The phone is not in the test number's recipient list (step 1.2) |
| Only "Mwen resevwa foto a…" arrives | The diagnosis failed or took too long; check the log. Deployed logs: `npx wrangler pages deployment tail <deployment URL> --project-name <project>` |

The server never logs phone numbers, message text or Meta's error messages, only status and
error codes, so the log can be shared safely.

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
