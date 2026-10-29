# WhatsApp walkthrough

How a WhatsApp conversation with MATON Kaye works, step by step, with the code that does each
step. The message texts are quoted from `MESSAGES` and `diagnosisMessage()` in
`shared/whatsapp.ts`. To run it yourself, see
[Run WhatsApp with your own test number](../README.md#run-whatsapp-with-your-own-test-number).

Evidence for each step is listed in [evidence/README.md](evidence/README.md). Labels used below:
**[tests]** automated tests with Meta and WhatsApp simulated, **[trace]** a recorded real Muse
Spark run, **[rendered]** text produced locally by the real code from that trace,
**[screenshot pending]** a real phone screenshot not yet added.

## The flow

```
Student's WhatsApp
   │ photo or text
   ▼
Meta WhatsApp Cloud API ──POST, signed──►  /api/whatsapp  (functions/api/whatsapp.ts)
                                              │ handleWhatsApp(): check signature, parse
                                              │ answer(): one message at a time
                                              ├─ photo ─► downloadPhoto() ─► diagnoseWork()
                                              │             (Muse Spark + SAM 3.1 + code checks)
                                              │           ─► session saved in KV (1 hour)
                                              └─ text  ─► checkStep() against the session
   ▲                                          │
   └────── sendText() ◄───────────────────────┘
```

## 1. Meta calls the webhook

- **Verification (once, at setup):** Meta sends `GET /api/whatsapp?hub.mode=subscribe&...`.
  The server returns `hub.challenge` only if `hub.verify_token` equals `WHATSAPP_VERIFY_TOKEN`,
  otherwise `403`. **[tests]** "webhook verification answers Meta's challenge only with the
  right token". The local `curl` checks in the README were also run on
  `wrangler pages dev` on 2026-10-28.
- **Every message:** Meta sends a `POST` signed with `X-Hub-Signature-256`, an HMAC-SHA256 of
  the body with the app secret. `validSignature()` checks it in constant time. Unsigned or
  wrongly signed requests get `401` and nothing is sent. **[tests]** "a POST without Meta's
  signature, or signed with another secret, is refused".
- Bodies over 64 KB get `413`, invalid JSON `400`, and missing secrets `500`. **[tests]** for
  the missing secrets.
- `incomingMessages()` keeps only real messages with a numeric sender, so delivery status
  updates are ignored.
- Meta can deliver the same message twice. Each message ID is remembered for 24 hours as a
  keyed hash, and a repeat is ignored. **[tests]** "the same message delivered twice is
  answered once".

## 2. The student sends a photo

1. `downloadPhoto()` asks Meta for the media URL, then accepts only JPEG, PNG or WebP up to
   4 MB, from an `https` address. Anything else gets:
   > Mwen pa ka li foto sa a. Voye yon foto JPG oswa PNG, ki pa twò gwo, epi ki klè.

   **[tests]** "a photo type the app cannot read gets a clear message and no Meta call".
2. The student is told the photo arrived:
   > Mwen resevwa foto a. M ap li kaye a, tann yon ti moman...
3. `diagnoseWork()` runs the same pipeline as the web app: Muse Spark reads the steps and
   writes the Kreyòl explanation, SAM 3.1 finds the handwritten numbers, and code re-computes
   every step and makes the practice problem. **[trace]**
4. The practice problem, its operation and the hint are saved in KV for 1 hour, under a keyed
   hash of the phone number. The answer is not saved; it is recomputed when the student
   replies. **[tests]** "the phone number is never stored in clear and never logged".
5. The explanation is sent. For the photo `47 + 38 = 75` the real recorded run gives
   **[rendered]**:

   ```
   *MATON Kaye*
   Mwen li: 47 + 38 = 75

   Chif 5 ou mete nan kolòn inite yo bon.

   *Ann gade etap sa a:* 47 + 38 = 75
   *Sa ou te fè:* Ou ajoute 47 ak 38, ou jwenn 5 nan inite yo, men ou bliye pote dizèn ki soti nan 7 plis 8 lan nan kolòn dizèn yo.

   *Ide pou sonje:* Chak kolòn kenbe yon sèl chif. Lè total inite yo fè dis oswa plis, nou pote yon dizèn nan kolòn dizèn yo.
   *Egzanp:* 10 grenn mango fè yon pakèt dis. Pakèt la ale nan kolòn dizèn yo, pa nan kolòn inite yo.

   *Reflechi sou sa:* Konbyen dizèn ou dwe pote nan kolòn dizèn yo apre ou fin ajoute inite yo?

   *Pratike (1/3):* 66 + 15 = ?
   Ekri repons ou isit la.
   ```

   WhatsApp shows the `*…*` parts in bold. The right answer to the student's problem (85) and
   to the practice (81) are not in the message. **[tests]** "a photo gets the Kreyòl
   explanation and a practice problem, without any answer". **[screenshot pending]**

## 3. The student answers the practice

`checkStep()` and `solveProblem()` from `shared/verify.ts` grade the typed answer; the model is
not involved.

| Student sends | Reply |
|---|---|
| a wrong answer | `Poko.` + the hint written for this mistake + the same problem again |
| a right answer (1st or 2nd) | `Wi, se sa! Ou jwenn li.` + a new problem one level harder, made by `makePractice()` (`Pratike (2/3)`, then `(3/3)`) |
| the 3rd right answer | `Wi, se sa! Ou jwenn li.` + `Bravo! Ou rezoud 3 egzèsis youn apre lòt. Ou metrize etap sa a. Voye yon lòt paj kaye lè w vle.` The session is deleted |

**[tests]** "practice answers are checked by code, and 3 in a row finishes the loop".
**[screenshot pending]**: a real run on 2026-10-27 (84 − 65 answered 4 then 19, then
364 − 193 = 171 and 771 − 514 = 257, ending with `Bravo!`).

## 4. Other messages

- **Text with no practice in progress** (or longer than 30 characters):
  > Bonjou! Se MATON Kaye. Pran yon foto klè paj kaye ou ki gen kalkil la, epi voye l isit la. M ap montre w ki etap pou w gade ankò.

  **[tests]** "text with no practice in progress gets the welcome message".
- **Meta's Model API fails:**
  > Sèvis AI a pa reponn kounya a. Eseye voye foto a ankò nan yon ti moman.

  No recorded result is ever sent instead. **[tests]** "a Meta API error becomes a plain
  Kreyòl message".
- **Any other error:**
  > Gen yon pwoblèm. Eseye voye foto a ankò.

## 5. What is logged

Only status and error codes, for example `whatsapp: Meta model API error (status 503)` or
`whatsapp: send failed (status 400, code 10, …)`. Never the phone number, the message text, or
Meta's error message (which can contain the phone number). **[tests]** checks that the phone
number appears in no log line and no stored key or value.

## 6. Timing

A diagnosis took between 5 and 33 seconds in the recorded runs. The webhook does the work before answering Meta's
request, because Cloudflare cancels background work about 30 seconds after the response
(commit `7f8e872`). If Meta resends the message meanwhile, the duplicate check in step 1 stops
a second answer.
