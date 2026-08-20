# Code review — Habit Armour 2.0 (post-FastAPI migration)

Reviewed at `a62ee66`. Scope: full backend (`app/`, `agent.py`), infra (`install.sh`, plists),
frontend data layer (`App.jsx`, API surface). Deep-styled JSX markup skimmed, not line-reviewed.

**All findings resolved: 18 fixed, 2 closed as not-a-bug.** Tests went 21 → **48 passing**
(`tests/test_hardening.py` is new); `npm --prefix client run lint` is back to its 7 pre-existing
warnings and `vite build` succeeds.

Status key: `todo` / `wip` / `done` / `wontfix`

## Findings

| # | Status | Sev | Location | Finding | Fix |
|---|---|---|---|---|---|
| 1 | done | **crit** | `app/main.py:64-69` | SPA catch-all path-traverses: `GET /%2e%2e/%2e%2e/.env` returns the file. **Verified — leaked a sentinel `GEMINI_API_KEY`.** Reads anything the user account can read. | `os.path.realpath` + `commonpath` containment check before `FileResponse` |
| 2 | done | **crit** | `com.user.habitserver.plist.template:12` | Binds `--host 0.0.0.0` with no auth, so #1 and every write endpoint are reachable from any device on the LAN | `127.0.0.1` |
| 3 | done | **high** | `app/routes/config.py:18-20` | `setattr(cfg, k, v)` with no type check persists garbage; `{"morningStart":"x"}` makes `/api/status` 500 forever. **Verified.** Daemon then just logs "HTTP 500, retrying" (`agent.py:164-167`) — lock enforcement dies silently and survives restart | validate payload against field types / accept a typed model |
| 4 | done | **high** | `agent.py:123` | `is_allowed_url` is a substring match. `youtube.com/results?search_query=claude.ai` passes the kiosk check. **Verified.** | `urlparse` → host, match on exact host or `.suffix` |
| 5 | done | **high** | `agent.py:25-27` vs `91-112` | Firefox/Opera/Orion/Vivaldi are in `ALLOWED_BROWSERS` but have no URL-fetch script → URL is always `""` → always a violation → guaranteed re-lock even on an allowed site | drop them, or fail-closed explicitly with a log line |
| 6 | done | med | `app/pillars/practice.py:739`, `app/pillars/gym.py:74` | `datetime.utcnow()` for `lastReviewedAt`/Hevy "today" vs the 4 AM logical local day (`app/config.py:77-82`) → FSRS `elapsed_days` off by one for late-night reviews; Hevy verifies against a different day than the lock | one clock helper, used everywhere |
| 7 | done | med | `app/pillars/practice.py:744` | Caches `keyImprovements` (personalised critique of *your* answer) into `question.keyTakeaways`; the model-solution endpoint then serves them as general takeaways forever | store only `generate_model_solution`'s takeaways there |
| 8 | **wontfix** | — | `app/pillars/practice.py:183-184` | **I got this one wrong.** I claimed `practiceMinDueToUnlock == 0` is unsatisfiable. It isn't: answering a question pushes its `dueDate` forward, `record_practice_attempt` recomputes `due_count`, and the earlier `due_count == 0` branch then returns True. So 0 means "clear the whole queue, no partial credit" — coherent, deliberate, and pinned by `test_fsrs.py:94`. No change made | none |
| 9 | done | med | `app/routes/habits.py:23,42` → `app/pillars/obsidian.py:53` | `payload["date"]` is unvalidated, used as PK *and* as the Obsidian filename → `../` writes .md files outside the vault. `upload_habit_photo:106` sanitises; this path doesn't | validate `^\d{4}-\d{2}-\d{2}$` |
| 10 | done | med | `app/pillars/practice.py:285-286` | `extract_images_for_gemini` joins an unsanitised filename → `![x](/uploads/../.env)` in an answer ships arbitrary files to Gemini | `os.path.basename` |
| 11 | done | med | `app/database.py:37` | Migration defaults `practiceNewCardsPerDay` to 5; model and settings default to 1. Pre-existing DBs silently get 5 new topics/day | `DEFAULT 1` |
| 12 | done | med | `app/pillars/status.py:98-111` + `agent.py:190-193` + `App.jsx:217` | `GET /api/status` mutates the DB and polls AnkiConnect; daemon hits it every 1.5 s during lock, UI every 5 s → ~40 AnkiConnect calls/min plus a commit each | cache the Anki poll (~60 s TTL); move writes out of GET |
| 13 | done | med | `app/pillars/practice.py:558`, `app/routes/practice.py:114` | N+1: one `StudyItem` query per question inside the loop. `get_performance_analytics:826` already does it right with `items_map` | build the map once |
| 14 | done | low | `app/pillars/practice.py:822`, `app/routes/habits.py:62` | `/performance` loads every `StudyAttempt` including full `answerMarkdown` (which inlines base64 diagrams); `/history` returns every entry with all JSON blobs | `/performance` now selects only the 3 columns it needs. `/history` left alone — a few hundred rows a year is not worth paginating, and the dashboard stats need the full set |
| 15 | done | low | `client/src/App.jsx:299,389,430` | Calls `/api/hevy/analyze`, `/api/test-sync`, `/api/sync-all` — **none exist**. "Sync All" is wired into `Navigation` and `HistoryView`, so it's a visible button that 404s | delete the handlers and their buttons |
| 16 | done | low | `client/src/App.jsx:33-38`, `.env.example:1,10-20` | Dead Google Sheets / GDoc config keys; `.env.example` still says "Express Server Port" and documents Sheets vars removed in `f3aae37` | prune both |
| 17 | done | low | `install.sh:72` | Installs `requirements.txt` (loose `>=`), so `requirements.lock.txt` is decorative | install the lock, or delete it |
| 18 | done | low | `AGENTS.md:104,140` and `:43` | Says "there is no test suite" / "no tests" (21 now pass) and "PracticeView.jsx ~1700 lines" (677 after the `c3ba239` split). AGENTS.md's own rule is to fix staleness in the same commit | update |
| 19 | done | low | `app/config.py:71` | Pydantic v1 `class Config:` → `PydanticDeprecatedSince20`. Plus `.dict()` and `datetime.utcnow()` throughout (33 warnings in the run) | `model_config = SettingsConfigDict(...)`, `.model_dump()`, `datetime.now(UTC)` |
| 20 | done | low | `app/main.py:64` | Catch-all shadows unmatched `/api/*` → index.html with 200 instead of 404, so a client typo looks like a parse error | 404 for paths starting `/api/` |

## Verification

Items 1, 3, 4 were reproduced against a live uvicorn instance before the fix and re-probed after,
in a throwaway `/tmp` copy with a real `vite build` and a sentinel `.env` (probe dir and scratch
venv removed; repo untouched). Post-fix results:

| Probe | Result |
|---|---|
| `GET /%2e%2e/%2e%2e/.env`, `/../../.env`, `..%2f` variants, `/etc/hosts` | blocked, serves SPA |
| `GET /` | 200, SPA still served |
| `GET /api/nope` | 404 (was 200 index.html) |
| `POST /api/config {"morningStart":"not-an-int"}` | 422, not persisted |
| `GET /api/status` after that POST | 200 (was 500 forever) |
| `POST /api/config {"morningStart":6}` | applied |
| `POST /api/submit {"date":"../../../../tmp/evil"}` | 400 |

Also run: `pytest` 48 passed, `oxlint` 7 warnings (all pre-existing), `vite build` clean,
`bash -n install.sh`, plist renders `--host 127.0.0.1`.

## Follow-ups for you (not code changes)

- **`HOST` now defaults to `127.0.0.1`.** The sidebar's "iOS Remote Lock" URL only works on a LAN
  bind. If you use it, set `HOST=0.0.0.0` in `.env` and re-run `install.sh` — but that re-exposes
  every unauthenticated write endpoint to the wifi you're on.
- **Check the live DB's `practiceNewCardsPerDay`.** Fixing the migration default only affects DBs
  that haven't added the column yet; an existing row may still hold the old `5`.
  `sqlite3 ~/.habitarmour/habit_armour.db 'select practiceNewCardsPerDay from app_config;'`
- **`install.sh` now installs `requirements.lock.txt`.** Regenerate it (`pip freeze`) when you add
  a dependency, or the new package won't reach the deployed venv.
- Nothing was deployed: `install.sh` was not run, so `~/.habitarmour/` is untouched.

## Not findings

- Large `DashboardView.jsx` (1543) / `App.css` (1282) — already flagged in AGENTS.md as a
  deliberate, reviewed refactor rather than a drive-by. No change proposed here.
- `renderMarkdown.jsx` — `dangerouslySetInnerHTML` is fed only KaTeX output with default
  `trust: false`. Fine.
- FSRS-5 math (`compute_next_fsrs`) matches the published equations for initial stability,
  recall/lapse stability and the retrievability power law. Two small fidelity gaps: no
  `(10-D)/9` damping on ΔD, and mean reversion targets D0(3) not D0(4) (`practice.py:117`).
  Cosmetic for single-user scheduling — noted, not filed.
