# AGENTS.md — Habit Armour

Rules and context for any coding agent working in this repo. Read this before making changes.
If something here turns out to be wrong or stale, fix it in the same commit that makes it stale —
this file rots fast if left behind.

## Before you say a change is done

```bash
make check     # ruff lint + format check + oxlint + CSS token check + pytest + vite build
```

That is the same command CI runs. `make install` first if there is no `.venv`. `make fmt`
auto-fixes lint violations and formats. Do not hand-format Python; ruff owns it.

Style, import order and line length are enforced by tooling and are therefore **not** documented
here. If a rule can be checked by a machine, it belongs in `pyproject.toml` or `.flake8`, not in
this file.

## Critical: the repo is not the running app

The live app runs from `~/.habitarmour/`, a **separate deployed copy**. `make deploy` (i.e.
`install.sh`) builds the client, rsyncs source into `~/.habitarmour/` and restarts the two launchd
agents (`com.user.habitserver`, `com.user.habitlock`).

- Editing files here has **zero runtime effect** until you deploy.
- The live database is `~/.habitarmour/habit_armour.db`, never one in the repo. Back it up before
  any bulk mutation: `cp habit_armour.db habit_armour.db.backup-$(date +%Y%m%d-%H%M%S)`.
- `make deploy` restarts a running system. Say so before you do it.
- After deploying, verify with `curl -s http://localhost:3000/api/...`. Don't trust the success message.

## Architecture

| Path | Holds |
|---|---|
| `app/routes/*.py` | FastAPI routers, one per pillar. HTTP layer only. |
| `app/pillars/*.py` | Business logic the routes call into: FSRS math, Gemini prompts, gate logic. |
| `app/models/*.py` | SQLModel table definitions. |
| `app/config.py` | Settings **and the clock helpers**. See below. |
| `app/database.py` | Engine + `init_db()`, which runs hand-written migrations. |
| `agent.py` | The PyObjC lock daemon. Polls `/api/status`, enforces the kiosk. |
| `client/src/api/client.js` | The only place that knows the API base URL. |
| `client/src/components/ui/` | UI primitives. Use these. |

`practice.py` exists in both `pillars/` and `routes/` — one is math/AI logic, the other is the HTTP
surface. Don't blur that line; prefer moving logic *out* of routes into pillars.

## Invariants you cannot infer from the code

**The logical day starts at 4 AM, not midnight.** Never call `datetime.now()` or `datetime.utcnow()`
to decide what day it is. Use the helpers in `app/config.py`: `now_local()`, `get_local_date_string()`,
`logical_date_of()`, `elapsed_logical_days()`. Mixing UTC timestamps with logical local dates
previously put FSRS `elapsed_days` off by one for late-night reviews, and made Hevy verify against a
different day than the lock enforced.

**There is no auth layer.** Any client that reaches the port can read and write everything,
including `POST /api/config`. That is why `HOST` defaults to `127.0.0.1` (`app/config.py` →
`install.sh` → the launchd plist). Setting `HOST=0.0.0.0` re-enables the sidebar's iOS remote-status
URL and simultaneously exposes every write endpoint to the local network — treat adding auth as a
prerequisite, not a follow-up. Don't add auth unless asked.

**Never take a raw `dict` as a request body.** Every route body is a Pydantic model in
`app/schemas.py`; a new route adds one there. This is not tidiness — two real bugs came from
unvalidated input reaching a sink. Copy the existing patterns:
- `app/schemas.py` — request models. `_validate_logical_date` is shared by every model with a date
  field, because a date here is a primary key *and* an Obsidian filename.
- `resolve_static_file()` in `app/main.py` — containment check for anything path-shaped.
- `_coerce_to_field_type()` in `app/routes/config.py` — `/api/config` is a *partial* update so it
  can't use a plain model. SQLModel skips validation on table models, so an unchecked `setattr`
  would persist `morningStart="abc"` and 500 every later `/api/status`, silently killing lock
  enforcement.

Free-form blobs stay `dict[str, Any]` deliberately: a habit log's `data` and a Hevy workout are
owned by the frontend and by Hevy respectively, not by us.

**Schema changes are hand-written.** No Alembic. Additive `ALTER TABLE` guarded by a
`PRAGMA table_info` check inside `init_db()` in `app/database.py`. `order` is a reserved word —
always double-quote it. Failures are swallowed with a `print()`, so verify the migration actually
ran against the live DB rather than trusting silence.

## Consistent Practice (the FSRS pillar)

The most complex pillar. Read `app/models/study.py`, `app/pillars/practice.py` and
`app/routes/practice.py` together before touching it.

- `StudyItem` = topic or paper. `StudyQuestion` = one FSRS-tracked card. `StudyAttempt` = a graded
  submission — **never delete these**, they are the real study history.
- **FSRS-5 is per-question**, not per-topic. Don't give a topic a review state.
- **`order`** sequences questions within a topic into a ladder. Continue the existing sequence;
  `_next_order_for_item()` computes the next slot.
- **Sections are tags**, not a column — a `"Section: X"` string prepended to `StudyItem.tags`. A
  deliberate choice to avoid a migration for a purely organisational grouping. Keep using it.
- **Due-queue pacing** (`GET /api/practice/due`) groups by topic, one box per topic:
  - *in-progress* topics (any row in `study_attempts`) are shown in full, capped at
    `practiceReviewTopicsPerDay`, most urgent first. Classify by attempt history, **not** by whether
    today's due subset happens to contain a reviewed card.
  - *new* topics (zero attempts) are capped at `practiceNewCardsPerDay` — semantically "new topic
    areas per day", repurposed rather than adding a column — ordered by `SECTION_RANK`.
  - Do **not** reintroduce per-card day-staggering. `/api/practice/balance-backlog` still does this
    and is legacy; ask before wiring it back in.
- **`practiceMinDueToUnlock = 0` means "clear the whole queue"**, not "no requirement". It is
  satisfiable: answering pushes each `dueDate` forward until `due_count` hits zero.
- **The ✨ Generate Questions and ✂️ Split into atomic features are intentionally unused.** The owner
  writes questions directly. The code works — don't delete it, don't extend it, don't suggest it.
- Gemini calls need `GEMINI_API_KEY` — a personal, small-quota key. No bulk/loop calls without
  flagging the volume first.

## Frontend

**Tailwind v4 + shadcn/ui. Use the vendored components in `client/src/components/shadcn/`** —
`Button`, `Card`, `Input`, `Select`, `Switch`, `Tabs`, `Table`, `Dialog`, `Badge`, `Alert`,
`Sidebar` and the rest. Add more with `npx shadcn add <name>`, never by hand. Adding a bespoke
button style is the failure mode to avoid; no linter catches it, so it is your job.

**The theme is stock shadcn `new-york` / slate and is not to be customised.** `client/src/index.css`
holds those values verbatim. An earlier version overrode them with a bespoke palette and the result
was shadcn components wearing someone else's theme — the reason nothing looked like shadcn. If you
want a different look, pick a different shadcn base colour; do not hand-edit values. The only
addition is `--success`, because shadcn ships `--destructive` with no positive counterpart.

`make tokens` fails the build on an undefined `var()`. That check is how 78 dead references were
found — `--accent-red` was used 26 times and defined nowhere, so every error message rendered in the
default body colour.

**Chart colour is computed, not chosen.** Series use `--chart-1..5`. Before changing any of them,
load the `dataviz` skill and run its palette validator; picking by eye is how a 1.68:1 amber line
ended up invisible on a white card.

**Layout.** `App.jsx` is the shell: `SidebarProvider` → `AppSidebar` + `SidebarInset`. Sidebar
destinations live in `client/src/nav.js`; anything finer-grained is an in-page `Tabs`, not a new
sidebar entry. The sticky header owns the page title, so views must not repeat it in an `<h2>`.

**All API calls go through `client/src/api/client.js`.** It resolves the base URL once and throws
`ApiError` on non-2xx, with `.isOffline` for network failures. `fetch` does not throw on 4xx/5xx,
which is how rejected submissions used to look identical to successful ones.

**Form drafts use `useDraft`**, which stamps localStorage with the logical day and drops the draft
on rollover. Plain `localStorage.setItem` brings yesterday's half-written log back this morning.

`DashboardView.jsx` (~1500 lines) is large and its six charts are hand-rolled SVG. Prefer surgical
edits; treat splitting it as a deliberate reviewed project, not a drive-by.

## Testing

`pytest` from the repo root. `tests/conftest.py` points `DATABASE_URL` at a temp SQLite file
**before** importing `app.*`, so tests never touch the live DB.

- `test_fsrs.py` — FSRS-5 math and the daily gate (pure functions).
- `test_due_queue.py` — `/api/practice/due` grouping and pacing, via `TestClient`.
- `test_hardening.py` — static-file containment, config validation, kiosk URL allowlist.

**Add a case when you fix a bug.** Every test in `test_hardening.py` exists because the behaviour it
pins was once wrong. There are no frontend component tests, so UI changes need `make check` plus a
manual pass in both light and dark.

## Conventions

- Route handlers return plain dicts, not response models. Match that.
- Commits: `type(scope): description` (`feat(practice):`, `fix(lock):`).
- **No `Co-Authored-By: Claude`** or any AI trailer. The owner wants sole authorship.
- Secrets live in `.env` (gitignored). Never commit or print them.

## Deliberate omissions

Don't "helpfully" add these without asking:

- **mypy** — annotating ~3.5k untyped lines is its own project and would emit hundreds of day-one errors.
- **Auth** — see above.

If `ruff` ever dies with exit 137 (SIGKILL) rather than printing anything, that is the managed-Mac
security tooling blocking the binary, not a config problem. It needs approving locally; don't
replace the toolchain over it.

## Known rough edges

- `PracticeView.jsx` and `PracticeAnswerEditor.jsx` still derive their own base URL instead of using
  `api/client.js`. Their logic is correct, just duplicated — migrate them when you next touch them.
- `compute_next_fsrs` deviates slightly from published FSRS-5: no `(10-D)/9` damping on the
  difficulty delta, and mean reversion targets `D0(3)` rather than `D0(4)`. Harmless at single-user
  scale; don't "fix" it without re-checking the scheduling it produces.
- 132 white-on-dark inline styles remain in unmigrated components, left over from a pre-light-mode
  design. They render as invisible cards. Replace with `<Card>` as you touch each file.
