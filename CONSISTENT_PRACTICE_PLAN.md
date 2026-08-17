# Consistent Practice — Active Recall + Spaced Repetition for Study Topics & Papers

## Context

The user is deep in AI safety/ML study (AI Control, Transformers, PPO, DPO, REINFORCE, Q-learning, SARSA, DQN, Bellman equations, IOI, Linear Probes, and key papers) and wants a system that forces *active recall* so the material actually sticks, rather than passive rereading. The idea: a bank of concrete questions tied to Topics and Papers; the user writes a Markdown answer (proof/derivation + intuition + mandatory ELI5 for topics; claims/methodology/results/limitations + ELI5 for papers); Gemini acts as a strict, critical evaluator — flagging vague language and misused terms, not just cheerleading — and returns a score out of 10; that score drives a full SM-2 spaced-repetition schedule for when the question comes due again. Per the user's explicit instructions: build Topics and Papers together as one unified model (not phased apart), let the question bank be populated flexibly (manual file edits, UI, or Gemini generation — no hard blocking gate), use full SM-2 (not a simplified scheduler), and — critically — this must tie into the same screen-lock mechanism that makes "Habit Armour" work, the same way the existing Anki tab does.

This app (`/Users/rakshit/Documents/Github/habit-armour`) already has 5 lock domains (morning/night/weekly/gym/anki) hand-inlined into one `/api/status` handler in a 1695-line `server.js`, and a working Gemini-critique pattern (`POST /api/hevy/analyze`) to model this on. The user separately flagged wanting a general architecture health-check given how much is now riding on the lock system — that's addressed below as part of this build, not deferred.

## Architecture decision: scoped restructuring, not a rewrite

Bolting a 6th lock domain straight into the existing pattern (inline in `/api/status`, routes appended to `server.js`) would push that single status handler past 300 lines and add ~600-900 more lines to an already-dense monolith. A full split of `server.js` into `routes/*.js` is **not** justified for this change — it would touch working lock-critical code (Gym/Anki/Weekly) that the user depends on nightly, for no benefit to this feature. Instead:

1. **New file `practice.js`** — an Express `Router` + all practice logic (data access, SM-2, Gemini eval). `server.js` only adds `import practiceRouter, { verifyPracticeStatus } from './practice.js'` and `app.use('/api/practice', practiceRouter)`. Keeps the monolith's growth to ~15 lines instead of ~700, and makes a future full route-split trivial (this module lifts out verbatim).
2. **New data file `study_data.json`** (sibling to `habits_data.json`), with its own `readStudyDb()`/`writeStudyDb()` using the same atomic tmp-file-rename write pattern. Reasoning: study content (items, questions, full Gemini critique text per attempt) accumulates forever and is unrelated in shape/lifecycle to daily habit entries; `/api/status` is polled every 5 seconds by macOS/iOS, so it must never load megabytes of attempt history just to check a due-count. A read failure on `study_data.json` must fail closed without ever breaking `/api/status` (which already has a fail-safe global error handler that force-unlocks on any route error — a study-data bug must not trip that for unrelated lock domains).
3. **Extract `createDefaultEntry(date)`** in `server.js` — the per-day entry-defaults object is currently hand-duplicated in 3 places (`/api/status` line ~452, `POST /api/anki/verify` line ~1529, `POST /api/anki/override` line ~1587, each with a different field subset). Since this feature adds new fields (`practiceCompleted`, etc.) to all three, consolidate into one function as part of touching that code — a behavior-preserving refactor, not speculative cleanup.
4. **Do not** split Gym/Anki/Weekly/Morning/Night into their own files now. Flag as future work once a 7th domain arrives or `server.js` crosses ~2500 lines.

One frontend-side extraction is also worth doing while touching this pattern: `HevyView.jsx`'s hand-rolled `renderMarkdown()`/`formatBoldText()` (lines 226-260) gets lifted into a shared `client/src/utils/renderMarkdown.jsx`, imported by both `HevyView.jsx` and the new practice UI, rather than copy-pasted a third time — and extended with one new rule to render `![alt](url)` image syntax as an `<img>` (needed for embedded hand-drawn diagrams, see below), which HevyView's existing usage never triggers so it's purely additive.

## Data model — `study_data.json`

```json
{
  "items": { "<itemId>": { "id", "type": "topic"|"paper", "title", "tags": [], "createdAt", "notes", "paper": null | { "arxivId", "url", "authors": [], "year" } } },
  "questions": { "<questionId>": {
      "id", "itemId", "itemType", "prompt", "answerTemplate": "topic"|"paper",
      "difficulty", "source": "manual"|"gemini-generated"|"gemini-generated-edited", "active": true,
      "sm2": { "easeFactor": 2.5, "repetitions": 0, "intervalDays": 0, "dueDate": "YYYY-MM-DD", "lastReviewedAt": null }
  } },
  "attempts": { "<attemptId>": {
      "id", "questionId", "itemId", "submittedAt", "answerMarkdown",
      "evaluation": { "score": 0-10, "quality": 0-5, "rubric": { "correctness", "precisionRigor", "intuitionQuality", "eli5Clarity", "completeness" }, "critique": "...", "flaggedIssues": [{ "type", "quote", "note" }], "raw": {...} },
      "geminiModel", "evaluatedAt"
  } },
  "meta": { "nextItemSeq", "nextQuestionSeq", "nextAttemptSeq" }
}
```

- IDs: `${type}_${Date.now()}_${seq++}` — no `uuid` dependency (confirmed not in `package.json`), consistent with the rest of the app.
- `answerTemplate` on the question (not just `item.type`) lets a paper question ask for a derivation, or vice versa — read this field, not `item.type`, everywhere prompt/rubric selection happens.
- `sm2` lives on the question (question == the unit of spaced repetition here — no note/card split needed, unlike Anki).
- Attempts are append-only/immutable; only `question.sm2` mutates on each submission.
- Cached-into-`habits_data.json` fields (mirrors the Anki split exactly — external source of truth queried live, small derived facts cached into today's entry): `entry.practiceCompleted`, `practiceManualOverride`, `practiceOverrideReason`, `practiceDueCount`, `practiceCompletedCount`.
- Config (in `DEFAULT_CONFIG`): `practiceLockEnabled`, `practiceLockStartHour` (default 21), `practiceMinDueToUnlock` (0 = clear all due questions; N = only first N required).
- Uploaded diagram images: `/uploads/practice_<questionId>_<timestamp>.<ext>`, same `UPLOADS_DIR` as existing photo uploads.

## SM-2 scheduling (`practice.js`, pure functions, no I/O)

Standard SM-2: `EF' = EF + (0.1 - (5-q)*(0.08+(5-q)*0.02))`, floored at 1.3. `q < 3` resets `repetitions=0, intervalDays=1`; otherwise `repetitions++`, interval is 1 day (1st rep), 6 days (2nd rep), or `round(interval * EF)` (3rd+). New questions default to `dueDate = today` so they enter the queue immediately (no gate).

Gemini returns a 0-10 `score` directly (not asked to guess a 0-5 quality — one precise scale from the model, deterministic mapping in code):

```
score <= 1  -> quality 0
score <= 3  -> quality 1
score <= 5  -> quality 2   (still a "fail" — resets interval; strict evaluator, 5/10 isn't mastery)
score == 6  -> quality 3   (first passing grade)
score <= 8  -> quality 4
score 9-10  -> quality 5
```

## Gemini evaluation — JSON response, not freeform Markdown

Unlike `/api/hevy/analyze` (freeform Markdown, fine since it's only ever displayed), the score here directly drives scheduling, so reliability matters. Use Gemini's `generationConfig.responseMimeType: "application/json"` + `responseSchema` (still a raw `fetch` body change, no SDK) requesting `{ score, rubric: {correctness, precisionRigor, intuitionQuality, eli5Clarity, completeness}, critique, flaggedIssues: [{type, quote, note}] }`.

Prompt framing (this is the part addressing the user's explicit complaint that Gemini tends toward encouragement): instruct the evaluator to act as a demanding reviewer, not to soften critique or praise effort, and to enumerate concrete flag categories rather than leave "be critical" vague:
- `misused-term` — technical terms swapped for near-but-wrong synonyms (e.g. "trust region" vs "clipping", "on-policy" vs "online")
- `vague` — claims asserted without stating the causal mechanism ("this improves stability" without saying how)
- `hand-wavy` — derivation steps skipped and presented as obvious
- `unsupported-leap` — conclusions that don't follow from what preceded them

Each flag must quote the exact offending phrase. The prompt inserts a template-specific completeness checklist (topic: derivation + intuition + ELI5 all required; paper: claims + methodology + results + limitations + ELI5 all required) based on `question.answerTemplate`.

## Backend endpoints (all in `practice.js`, mounted at `/api/practice`)

- **Bank**: `GET/POST /items`, `PUT/DELETE /items/:id` (delete soft-deactivates its questions, preserving attempt history), `GET /questions?itemId=`, `POST /questions` (manual, `source: "manual"`), `PUT /questions/:id`, `POST /questions/generate` (`{itemId, count}` → Gemini drafts candidate questions, JSON array response, appended directly with `source: "gemini-generated"` — no blocking approval step, per the user's explicit "populate anyhow" instruction; still editable/deletable like any question).
- **Practice loop**: `GET /due` (questions where `sm2.dueDate <= today && active`, joined with item title/type), `POST /attempts` (`{questionId, answerMarkdown}` → evaluate via Gemini → map score→quality → `computeNextSm2()` → persist attempt, update `question.sm2`, update today's cached counts in `habits_data.json`), `GET /attempts?questionId=` (history), `POST /upload-image` (`{questionId, dataUrl}` → decode base64 → write to `UPLOADS_DIR` → `{success, url}`, exact mirror of the existing `/api/upload-photo` pattern at server.js:817-848).
- **Status/lock**: `GET /status` (mirrors `/api/anki/status`), `POST /override`, `POST /reset-override` (mirror the Anki override/reset-override routes at server.js:1580-1637 exactly).

Unlike Gym/Anki, no throttled background re-check is needed in `/api/status` — practice completion updates synchronously when the user submits an attempt (local file I/O, not a rate-limited external API), so no third `lastXCheckTime` throttle global is needed.

## Lock integration

- `DEFAULT_CONFIG` additions + matching env-var overrides in `readDb()`, following the Anki entries at server.js:96-99 and :167-168 exactly.
- `createDefaultEntry()` gets the new `practice*` fields (see Data model above).
- New `/api/status` step (inserted after the existing Anki block, before `lockCount = pendingWindows.length`):
  ```js
  if (practiceLockEnabled && hour >= practiceStartHour) {
    if (!entry.practiceCompleted && !entry.practiceManualOverride) {
      const { dueCount, minRequired } = verifyPracticeStatus(config);
      entry.practiceDueCount = dueCount;
      if (dueCount === 0 || entry.practiceCompletedCount >= minRequired) {
        entry.practiceCompleted = true; writeDb(db);
      } else {
        pendingWindows.push("practice");
      }
    }
  }
  ```
  Plus a `lockReason` branch and `error` field entry matching the existing Gym/Anki pattern at server.js:615-639.
- `getLocalDateString()` (currently a local, unexported function at server.js:282) needs to be exported so `practice.js` uses the identical "day rolls over" logic as the rest of the app.
- Manual override: identical shape/flow to Anki's (`practiceManualOverride`, `practiceOverrideReason`), for days with genuinely no due items or a deliberate skip.

## Frontend

- **`PracticeView.jsx`** (new) — self-contained like `AnkiView.jsx` (only takes `{API_URL, status, onRefreshStatus}`, does its own fetching). Header banner → stat cards (due count, answered today, ease/streak summary, verified/pending pill) → due-queue list → bank-management panel (toggle: item list with type badges, add-item form branching Topic/Paper fields, per-item question list with "✨ Generate via Gemini", attempt-history expand) → manual-override modal (copy of AnkiView's, lines 315-369, retargeted).
- **`PracticeAnswerEditor.jsx`** (new) — split-pane textarea + live preview (via the shared extracted `renderMarkdown()`), opened for a due question:
  - **Image upload for the "draw the architecture" case**: a toolbar button opens a hidden file input → `compressImage(file, 1600, 0.8)` (reused unchanged from `client/src/utils/imageCompressor.js`) → `POST /api/practice/upload-image` → on success, insert `![description](url)` into the textarea at the current cursor position (via `selectionStart`/`selectionEnd` tracking, standard controlled-textarea insert). The preview pane renders it as an actual image via the new image-line rule added to the shared `renderMarkdown()`.
  - Section-scaffold buttons (insert `## ELI5`, `## Intuition` / `## Limitations` headers) as a cheap non-blocking hint, branched on `question.answerTemplate`.
  - Submit → `POST /attempts` → loading state → renders score (color-coded), rubric breakdown, critique (via shared `renderMarkdown()`), `flaggedIssues` as quote+note callouts, and the updated SM-2 fields (next due date, ease, streak).
- **`App.jsx`**: import `PracticeView`, one new tab-render block (mirrors the `anki` block), `practiceLock*` fields added to initial `config` state. No other state needed (self-fetching component, like Anki).
- **`Navigation.jsx`**: one new `tab-btn-vertical` button, same pattern as the existing 9.
- **`SettingsView.jsx`**: new section mirroring the Anki section (lines 376-460) — enable checkbox, cutoff-hour input, min-due-to-unlock input, using the same `config.practiceLockEnabled !== false && (...)` conditional-reveal pattern already used for Anki.

## Papers vs Topics

Single discriminator `item.type` (`"topic"|"paper"`), with an optional `paper: {arxivId, url, authors, year}` sub-object only for papers — one `items` collection, not two. Item-creation form toggles a type selector that reveals paper-specific fields conditionally (same technique as the Anki settings conditional block). Both the evaluation prompt and the generate-questions prompt branch on `question.answerTemplate` (defaults to `item.type`, editable per-question) to select the completeness checklist text — one prompt-builder function with one conditional insert, not two parallel code paths.

## Build order

1. **Data model + bank management** — `practice.js` CRUD routes, `study_data.json` bootstrap, `PracticeView.jsx` bank panel only, nav tab wired. Testable in isolation: create/edit Topics and Papers with questions, no Gemini/lock involved.
2. **Gemini evaluation** — `evaluateAttempt()`, `POST /attempts`, `PracticeAnswerEditor.jsx` (incl. image upload + shared `renderMarkdown()` extraction). SM-2 stubbed (always due tomorrow) just to prove the round trip. Testable: submit an answer with an embedded diagram, see the strict critique + score.
3. **Full SM-2** — `computeNextSm2()`/`scoreToSm2Quality()` wired in for real, `GET /due` filtering by actual due-date, due-queue UI. Testable: low score → due tomorrow; simulate a 3rd repetition by hand-editing `study_data.json` and confirm the ease-factor-scaled interval.
4. **Gemini question generation** — `POST /questions/generate` + UI, sequenced after the core loop is proven so generated questions flow through the identical pipeline as manual ones.
5. **Lock integration** — `DEFAULT_CONFIG`/`createDefaultEntry()` additions, `verifyPracticeStatus()`, the `/api/status` step, override routes, Settings section, override modal. Sequenced last deliberately: it's the highest-blast-radius change (touches the `/api/status` handler polled every 5s by the user's actual devices), so it only lands once the practice loop is already proven correct in isolation. Final smoke test: set the cutoff to the current hour with a due unanswered question, confirm `/api/status` reports `locked:true, window:"practice"`; answer it, confirm it clears; test manual override clears without answering.

## Verification

- No test suite exists in this repo; verification is manual, end-to-end, per phase as described above.
- Run `npm run dev` (nodemon backend) and the Vite client, exercise the Practice tab through a full cycle (add a Topic + a Paper, add/generate questions, answer one with an uploaded image, check the score/critique/flags render correctly, confirm it reappears/doesn't per SM-2, then enable the lock and confirm `/api/status` actually locks and unlocks).
- Spot-check `study_data.json` after each phase to confirm shape matches the schema above and that `habits_data.json` only ever gains the small cached `practice*` fields, not full attempt content.
