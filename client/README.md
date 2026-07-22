# 🛡️ Habit Armor Frontend Client

This is the React + Vite frontend client for **Habit Armor**. It provides the primary user interface for logging morning metrics, tracking calories/steps, writing journal reflections, reviewing stats on a glassmorphic dashboard, and configuring system targets.

---

## 🚀 Development & Build

### 1. Installation
Install the client dependencies from the `client/` subdirectory:
```bash
npm install
```

### 2. Run Development Server
Run the local Vite development server with Hot Module Replacement (HMR):
```bash
npm run dev
```

### 3. Production Build
Compile and bundle production-ready assets:
```bash
npm run build
```
Vite will output the compiled static HTML, CSS, and JS bundle into the `client/dist/` directory, which is served by the Node.js backend.

---

## 📁 Modular UI Component Structure

The frontend code has been refactored from a single monolithic file into a modular, components-driven architecture:

```
client/src/
├── App.css               # Main styling rules (glassmorphic theme, responsive layouts)
├── App.jsx               # Main state router, API sync hooks, and forms orchestrator
├── main.jsx              # Application mount point
└── components/
    ├── Header.jsx        # App header with mixed-case title and lock unlock status pill
    ├── Navigation.jsx    # Tab selection sidebar tabs (Morning, Night, Dashboard, etc.)
    ├── WarningBanner.jsx # Floating warning banner for lock grace period timers
    ├── MorningForm.jsx   # Metrics form for waking weight, sleep hours, resting HR, etc.
    ├── MorningJournalForm.jsx # Unified daily intention open journal box with guiding questions
    ├── MorningReferenceCard.jsx # Intention recap displayed inside evening logs
    ├── NightForm.jsx     # Metrics form for training progress, calories, and steps
    ├── NightJournalForm.jsx # Unified retrospective reflection journal box with guiding questions
    ├── WeeklyForm.jsx    # Weekly Sunday body spec stats
    ├── DashboardView.jsx # Premium glassmorphic SVG charts (bezier curves, glows, target lines)
    ├── HistoryView.jsx   # Expandable history logs table with past date catchup widgets
    ├── GymView.jsx       # Workout verification status and triggers
    ├── HevyView.jsx      # Hevy workouts list and Gemini AI overload analysis
    └── SettingsView.jsx  # Configuration editor for windows, locks, and goal targets
```

---

## 🎨 Tech Stack & Styling
- **Core Framework**: React 19 + Vite 8 (Vite-powered HMR and compilation).
- **Styling System**: Custom Vanilla CSS with visual styles:
  - **Glassmorphism**: Translucent backdrops (`backdrop-filter: blur(...)`) and glowing border accents.
  - **SVG Charting**: Hand-crafted SVG charts utilizing dynamic Bezier curves, drop-shadow glow filters, shaded goal targets, and floating coordinate tooltips.
