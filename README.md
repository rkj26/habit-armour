# Habit Armour 2.0 🛡️

**Habit Armour** is an OS-enforced habit tracking, fitness verification, spaced repetition, and active-recall learning studio for macOS.

When daily habit windows, fitness goals, Anki flashcard reviews, or mathematical proofs are incomplete, Habit Armour engages a **native macOS lock screen and kiosk mode** to ensure complete accountability.

---

## 🏛️ Architecture

```
habit-armour/
├── app/
│   ├── main.py                     # FastAPI app factory, CORS, static client mount
│   ├── config.py                   # Pydantic Settings (.env + DB config)
│   ├── database.py                 # SQLite engine (WAL mode) & SQLModel sessions
│   ├── models/                     # Strongly-typed DB schemas
│   │   ├── config.py               # AppConfigModel
│   │   ├── daily_entry.py          # DailyEntry (habits, journal, gym, anki, practice)
│   │   └── study.py                # StudyItem, StudyQuestion, StudyAttempt
│   ├── pillars/                    # Isolated modular domain engines
│   │   ├── obsidian.py             # Journal markdown file generator
│   │   ├── gym.py                  # Hevy API & steps / rest day calculator
│   │   ├── anki.py                 # AnkiConnect reachability & deck due counter
│   │   ├── practice.py             # Active recall, SM-2 engine & Gemini 2.5 Flash evaluator
│   │   └── status.py               # Central status & lock engine (/api/status)
│   ├── routes/                     # Clean FastAPI APIRouters
│   │   ├── status.py               # /api/status, /api/test-lock, /api/ip
│   │   ├── config.py               # /api/config
│   │   ├── habits.py               # /api/log, /api/history, /api/sync-entry
│   │   ├── gym.py                  # /api/hevy/*
│   │   ├── anki.py                 # /api/anki/*
│   │   └── practice.py             # /api/practice/*
│   └── migrate_json.py             # JSON -> SQLite data migrator
├── agent.py                        # Native PyObjC macOS Lock Daemon
├── requirements.txt                # FastAPI, SQLModel, Uvicorn, PyObjC, HTTPX
├── install.sh                      # One-click installer & launchd manager
├── uninstall.sh                    # Clean daemon uninstaller
└── client/                         # Modern React + Vite frontend dashboard
```

---

## ⚡ Core Habit Pillars

1. **🌅 Morning & 🌙 Night Habits**:
   - Bio-metrics: Waking weight, sleep hours, resting heart rate, hydration.
   - Nutrition & Supplements: Calorie and protein targets, creatine, vitamins checklist.
   - Journaling: Structured morning intentions and evening reflections automatically appended to your local Obsidian Vault.

2. **💪 Physical Activity & Gym (Hevy Integration)**:
   - Queries Hevy API for verified workout completion, set thresholds, and exercise logs.
   - Enforces a 5-day weekly active goal and a strict **No Consecutive Rest Days** rule with step count fallbacks (13,000 steps).

3. **🧠 Spaced Repetition Flashcards (Anki)**:
   - Polls AnkiConnect (`http://localhost:8765`) for pending reviews and deck due counts.
   - Enforces review completion before evening cutoff hours, with fail-safe error handling and mobile overrides.

4. **🔬 Consistent Practice & AI Proof Grader**:
   - Spaced repetition (SM-2) for active recall topics and research papers.
   - Built-in Markdown & KaTeX mathematical derivation editor with handwriting diagram uploads.
   - **Gemini 2.5 Flash Academic Auditor**: Grades submissions strictly out of 10 across 5 granular rubric dimensions (`correctness`, `precisionRigor`, `intuitionQuality`, `eli5Clarity`, `completeness`) and flags vague or hand-wavy reasoning.
   - AI Question Generator for synthesizing active-recall questions from topic notes.

---

## 🔒 Native macOS Enforcement Daemon (`agent.py`)

- Uses native Apple Cocoa APIs (`AppKit.NSWorkspace`) to monitor active applications with 0% CPU overhead.
- When an active breach occurs, triggers native macOS lock screen and kiosk mode, locking access to unapproved apps until required logs/proofs are completed.
- Whitelists Habit Armour dashboard, Anki, Obsidian, and Antigravity IDE during active study sessions.

---

## 🚀 Installation & Setup

```bash
# 1. Clone the repository
git clone https://github.com/rkj26/habit-armour.git
cd habit-armour

# 2. Configure .env with your API keys
cp .env.example .env
# The API has no auth layer, so it binds to 127.0.0.1 by default.
# Set HOST=0.0.0.0 only if you need the iOS remote-status URL.

# 3. Run the installer (sets up virtualenv, SQLite, builds client, and registers macOS launchd daemons)
./install.sh
```

### Useful Commands

```bash
# Run server in development mode
npm run dev

# Run the test suite
pytest

# Run lock agent manually in test mode
npm run agent

# Run client in development mode
npm run client:dev

# Reinstall / reload launchd services
./install.sh

# Uninstall background daemons
./uninstall.sh
```
