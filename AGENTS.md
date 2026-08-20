# AGENTS.md — Habit Armour

Rules and context for any coding agent (Claude Code, Codex, Cursor, etc.) working in this repo.
Read this before making changes. If something here turns out to be wrong or stale, fix it in the
same commit that makes it stale — this file rots fast if left behind.

## What this is

A personal, single-user macOS habit-tracking system: FastAPI + SQLite backend, React/Vite
frontend, plus a native PyObjC "lock daemon" that enforces habit compliance by locking the screen.
It runs as two background `launchd` services, not as a dev server you visit and forget. There is
exactly one user (the repo owner) and no auth layer — don't add one unless asked.

## Critical: the repo is not the running app

The live app runs from `~/.habitarmour/`, a **separate deployed copy**, not this repo directory.
`install.sh` builds the client, rsyncs source into `~/.habitarmour/` (excluding `.db*`, `uploads/`,
`*.log`), and restarts the two launchd agents (`com.user.habitserver`, `com.user.habitlock`).

**Consequences that matter every session:**
- Editing files in this repo has **zero runtime effect** until you run `bash install.sh`.
- The live SQLite database is `~/.habitarmour/habit_armour.db`, never the one (if any) sitting in
  the repo root. Always operate on the `~/.habitarmour/` copy for real data; back it up
  (`cp habit_armour.db habit_armour.db.backup-$(date +%Y%m%d-%H%M%S)`) before any bulk mutation.
- After `install.sh`, verify with `curl -s http://localhost:3000/api/...` — don't assume a deploy
  worked just because the script printed success.
- `install.sh` unloads/reloads launchd agents, i.e. it restarts the live service. Treat that as a
  "restart a running system" action — fine for this single-user local app, but say what you're
  doing.

## Architecture map

- `app/routes/*.py` — FastAPI routers, one per "pillar" (gym, anki, practice, habits, status,
  config). HTTP layer only where possible.
- `app/pillars/*.py` — business logic the routes call into (FSRS math, Gemini prompt construction,
  JSON repair, satisfied/gate logic). `practice.py` here is math/AI logic; `routes/practice.py` is
  the HTTP surface — don't blur that line further, and prefer moving logic *out* of routes into
  pillars over adding more inline logic to routes.
- `app/models/*.py` — SQLModel table definitions.
- `app/database.py` — engine + `init_db()`, which also runs **hand-written migrations** (see below).
- `client/src/components/*.jsx` — one big component per view, plain inline `style={{...}}` props
  throughout (no CSS-in-JS lib, no Tailwind). `App.css` holds the shared class-based styles. Several
  components are large (`PracticeView.jsx` ~1700 lines, `DashboardView.jsx` ~1550, `App.jsx` ~900) —
  when touching one, prefer surgical edits over reflowing the whole file.

## Database migrations: no framework, do it by hand

There is no Alembic/migration tool. Schema changes are additive `ALTER TABLE` statements guarded by
`PRAGMA table_info` checks inside `init_db()` in `app/database.py`, e.g.:

```python
if "order" not in existing_cols:
    conn.exec_driver_sql('ALTER TABLE study_questions ADD COLUMN "order" INTEGER DEFAULT 0;')
```

Follow this exact pattern for any new column. `order` is a reserved SQL keyword — always
double-quote it in raw SQL. This block only *adds* columns; it never drops/renames, and failures are
swallowed with a `print()` (see the `except Exception as e` around it) — if you add a migration,
sanity-check it actually ran (`PRAGMA table_info` on the live db) rather than trusting silence.

If you're mutating the live DB directly with a one-off script (not through the API), always: back up
first, use parameterized queries, and re-verify counts/integrity after (see git history around the
"Consistent Practice" ladder restructure for the pattern used).

## Consistent Practice pillar (the FSRS study system)

This is the most complex pillar — read `app/models/study.py`, `app/pillars/practice.py`, and
`app/routes/practice.py` together before touching it.

- `StudyItem` = a topic or paper. `StudyQuestion` = one FSRS-tracked flashcard belonging to an item.
  `StudyAttempt` = a graded submission log (never delete these — they're the real study history).
- **FSRS-5 is per-question**, not per-topic. Spaced repetition, retention scoring, and due-dates all
  operate at the individual-question level. Don't try to make a "topic" itself have a review state.
- **`order`** (int on `StudyQuestion`) sequences questions within a topic into a "ladder" — easy to
  hard, each building on the last, mixing theory/intuition with math. When adding questions to an
  existing topic, continue the existing `order` sequence; don't leave gaps or duplicates
  (`_next_order_for_item()` in `routes/practice.py` computes the next slot).
- **Sections** (Foundations / Value Optimisation / Policy Optimisation / RLHF-RLAIF-RLVR / Papers)
  are *not* a schema field — they're a `"Section: X"` string prepended to `StudyItem.tags`. This was
  a deliberate choice to avoid a schema/migration for a purely organizational grouping; keep using
  the tag convention rather than adding a `section` column unless the owner asks for one.
- **Due-queue pacing** (`GET /api/practice/due` in `routes/practice.py`) groups due questions by
  topic ("one box per topic") and separates them into:
  - *in-progress* topics (any row in `study_attempts` for that item) — always shown in full, never
    gated. Classify by attempt history, **not** by whether today's due subset happens to contain a
    reviewed card — a topic you're mid-ladder on can have its next review land tomorrow while its
    unattempted tail is still due today, and it must still show as one group.
  - *new* topics (zero attempts ever) — capped at `config.practiceNewCardsPerDay` per day (this
    field is semantically "new topic areas per day" now, not raw card count — it was repurposed
    rather than adding a new column), surfaced in a stable syllabus order via a `SECTION_RANK` dict.
  - Do **not** reintroduce per-card day-staggering for brand-new questions (e.g. via
    `/api/practice/balance-backlog`, which still staggers by raw count and predates the topic-aware
    pacing above) — it fragments a topic's ladder across multiple days and defeats the "one box"
    design. That endpoint is legacy; ask before wiring it back into the UI.
- **The ✨ "Generate Questions" and "✂️ Split into atomic" AI features are intentionally unused.**
  The owner writes/curates questions directly (with agent help) rather than trusting Gemini
  generation for this content. The code paths still exist and work — don't delete them, but don't
  extend them either unless explicitly asked. Don't default to "let's use the generator" when adding
  content to this pillar.
- Gemini calls (`evaluate_answer_with_gemini`, `generate_model_solution_with_gemini`, etc., all in
  `app/pillars/practice.py`) require `GEMINI_API_KEY` in `.env` — a personal, small-quota key. Don't
  write code paths that call it in loops/bulk without the owner's awareness of the volume.

## Testing & verification (there is no test suite)

There are no automated tests, no CI, and no Python linter/type-checker configured (only
`client/.oxlintrc.json` for JS via `npm run lint`). This means:
- Before claiming a change works, actually verify it: `python3 -c "import ast; ast.parse(open(f).read())"`
  for syntax, `cd client && npx vite build` for the frontend, and `curl` the relevant endpoint
  against the live (or a scratch) DB.
- Prefer small, verifiable steps over large unverified batches, especially for anything touching
  `app/routes/practice.py` or the DB directly.
- If you add a feature substantial enough to deserve a test and there's reasonable time budget,
  it's reasonable to introduce a minimal test setup (pytest + `TestClient`) rather than leaving
  everything to manual curl checks forever — but this is a design decision worth flagging to the
  owner first, not doing silently.

## Style & conventions actually used here

- Python: FastAPI + SQLModel, `snake_case` functions, route handlers return plain dicts (not
  response models) — matches existing code, don't introduce Pydantic response models for just one
  endpoint.
- React: function components, `useState`/`useEffect`, inline styles, no component library. Keep new
  UI consistent with this rather than introducing a new styling approach for one component.
- Commit messages follow `type(scope): description` (e.g. `feat(practice): ...`, `fix(lock): ...`).
- **Do not add `Co-Authored-By: Claude` (or any AI co-author trailer) to commits** — the owner wants
  sole authorship on GitHub. This applies regardless of which agent is committing.
- Secrets live in `.env` (gitignored) — `GEMINI_API_KEY`, `HEVY_API_KEY`. Never commit real values,
  never print them in full.

## Known rough edges (real, not hypothetical — seen in review)

- CORS is wide open (`allow_origins=["*"]` with `allow_credentials=True`) in `app/main.py`. Low risk
  today (localhost-only, single user) but worth tightening to explicit origins if this is ever
  exposed beyond localhost.
- No dependency lockfile for Python (`requirements.txt` uses loose `>=` pins; no `pip freeze` lock).
  `client/package-lock.json` exists and is fine.
- Several frontend components (`PracticeView.jsx`, `DashboardView.jsx`, `App.jsx`) are large,
  single-file, and mix data-fetching, state, and heavily-styled markup. Splitting them is worthwhile
  but is a real refactor with regression risk on a UI with no tests — treat as a deliberate,
  reviewed project, not an opportunistic drive-by edit.
