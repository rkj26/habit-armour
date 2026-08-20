# Redesign: shadcn dashboard layout

Target: the official shadcn `dashboard-01` shape — collapsible icon sidebar, sticky inset header,
card-grid content. Stock `new-york` / slate theme, no custom palette.

All rows below are complete and `make check` is green.

## Shell

| # | Item | Status |
|---|---|---|
| S1 | `shadcn add sidebar breadcrumb sheet avatar scroll-area collapsible` | done |
| S2 | `ThemeProvider` (next-themes, class strategy) + `ModeToggle` in header | done |
| S3 | `AppSidebar` — brand header, grouped `SidebarMenu`, lock-status footer | done |
| S4 | `SiteHeader` — `SidebarTrigger`, page title, clock, lock badge, mode toggle | done |
| S5 | `App.jsx` shell → `SidebarProvider` + `SidebarInset` | done |
| S6 | Delete `Navigation.jsx` + `Header.jsx` | done |

## Information architecture

Twelve flat sidebar entries collapsed to seven destinations; related screens became in-page tabs.
Stock pill `TabsList` everywhere.

| # | Item | Status |
|---|---|---|
| N1 | `nav.js` — 3 groups, 7 entries, `WINDOW_TO_TAB` routing | done |
| N2 | `Today` page — morning / morning journal / night / night journal as tabs | done |
| N3 | `Training` page — Hevy workouts / lock verification as tabs | done |
| N4 | `Learning` page — Anki / practice as tabs | done |
| N5 | Drop per-view `<h2>`; the sticky header owns the page title | done |
| N6 | Drop the floating page-intro paragraph; rules moved into `CardDescription` | done |
| N7 | Collapse control moved from the header into the sidebar footer | done |
| N8 | Delete the UI gallery (tab + component); `AGENTS.md` points at `components/shadcn/` | done |
| N9 | Copy pass — sentence case, no icons in `CardTitle`, no jargon in tab labels | done |

## Screens

`inline` = count of `style={{` before migration; target is 0 except chart geometry.

| # | Screen | inline | Status |
|---|---|---|---|
| V1 | `SettingsView` | 53 | done — 5 tabs, `Switch` rows, chip lists |
| V2 | `AnkiView` | 51 | done — stat cards, `Table`, `Dialog` override |
| V3 | `WeeklyForm` | 32 | done |
| V4 | `HevyView` | 55 | done — `Tabs` for the two creator modes |
| V5 | `practice/TopicBankSection` | 15 | done |
| V6 | `practice/AllQuestionsSection` | 1 | done |
| V7 | `practice/DueQueueSection` | 29 | done |
| V8 | `practice/PerformanceSection` | 39 | done |
| V9 | `practice/PracticeModals` | 22 | done — 4 modals → `Dialog` |
| V10 | `practice/ActiveRecallSession` | 52 | done — reskin only |
| V11 | `PracticeAnswerEditor` | 49 | deleted — 584 lines, imported by nothing |
| V12 | `PracticeView` shell | 5 | done |
| V13 | `DashboardView` cards/tiles | 203 | done — 37 `style={{` left, all SVG geometry |
| V14 | `DashboardView` 6 SVG charts | — | done — reskin only, palette validated |

## Cleanup

| # | Item | Status |
|---|---|---|
| C1 | Delete the TEMPORARY compat shim block in `index.css` | done |
| C2 | `scripts/check-tokens.sh` green with the shim gone | done |
| C3 | Gallery deleted; `AGENTS.md` frontend section rewritten around shadcn | done |

## Input controls

Audited every field. Changes, by why:

| Field(s) | Was | Now |
|---|---|---|
| 9 lock hours across Settings | number, `min=0 max=23` | `Select` of clock times — `09:00`, `21:00`, plus `24:00 (midnight)` where an end hour allows it |
| `gymWeeklyGoal` | number 1–7 | `ToggleGroup` of 1–7 |
| `sleepQualityDevice` | slider, 100 stops | number 0–100 — you read this off a watch, you don't drag to it |
| `bloodPressure` | free text | `inputMode=numeric` + `pattern` for `118/74` |
| `ankiConnectUrl` | text | `type=url` |
| Two search boxes | text | `type=search` |
| calories, protein, carbs, fats, water, steps | unbounded | `min=0`, via one default on the shared `NumField` |
| weight, sleep hours, resting HR, measurements | unbounded | plausible `min`/`max` |
| `paperYear` | unbounded | 1900–2100 |
| Hevy set weight / reps | unbounded, no step | `min=0`, `step=0.5` / `step=1` |
| `weekCommencing` | any date | capped at the logical today |

## Bugs found and fixed on the way

| Bug | Effect |
|---|---|
| `PracticeView` destructured a `getBaseUrl` prop nothing passed | Every fetch in the practice tab threw; the tab only ever rendered an error banner. Now on `api.practice.*`. |
| `useDraft` written last session but never wired into `App.jsx` | Yesterday's half-written log still came back today. Now day-stamped and dropped on the 4 AM rollover. |
| `GymView` rendered on `activeTab === 'gym'`, but no nav entry set it | Screen was unreachable. Now the Training page's second tab. |
| Fats series used `--chart-4` (#ffb900) on a white card | 1.68:1 contrast — a near-invisible line. Swapped to `--chart-3`, which clears 3:1 in both modes. |
| `handleConfigChange` ran `parseInt` on every numeric field | `targetWeight` is a `float` server-side, so 75.5 silently saved as 75. Now `Number`. |
| Same handler: `parseInt('')` is `NaN`, coalesced to `0` | Clearing a field to retype it snapped the value to 0 mid-edit. Empty is kept now; saving one returns a 422 naming the field. |
| `required` on Settings inputs | Those cards have no `<form>`, so it never fired. The Obsidian vault path now shows a real inline error when sync is on and the path is blank. |

## Colour

Chart series use shadcn's stock `--chart-1..5`. `--success` is the one addition, because shadcn
ships `--destructive` with no positive counterpart and the compliance chart needs done/missed.

Verified with the `dataviz` validator rather than by eye:

| Palette | Mode | Result |
|---|---|---|
| chart-1, chart-2 (weight/sleep) | light | all checks pass |
| chart-1, chart-2, chart-3 (macros) | light | contrast + CVD pass; chart-3 flagged low-chroma |
| chart-1, chart-2, chart-3 (macros) | dark | CVD pass; chart-1 at 2.55:1 — relieved by the legend |

Remaining FAILs are inherent to stock shadcn values and were left alone deliberately — the brief
was to use the theme as shipped.

## Carve-outs

- Dashboard's 6 hand-rolled `<svg>` charts and the practice recall session were **reskinned, not
  rewritten** — that is chart/scheduling logic, not markup.
- FSRS, the 4 AM logical day, and every API contract keep their current behaviour.
