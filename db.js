import fs from 'fs';
import path from 'path';

export const DB_FILE = path.join(process.cwd(), 'habits_data.json');

export const DEFAULT_CONFIG = {
  morningStart: process.env.DEFAULT_MORNING_START ? parseInt(process.env.DEFAULT_MORNING_START, 10) : 5,   // 5:00 AM
  morningEnd: process.env.DEFAULT_MORNING_END ? parseInt(process.env.DEFAULT_MORNING_END, 10) : 12,   // 12:00 PM
  nightStart: process.env.DEFAULT_NIGHT_START ? parseInt(process.env.DEFAULT_NIGHT_START, 10) : 22,    // 10:00 PM
  nightEnd: process.env.DEFAULT_NIGHT_END ? parseInt(process.env.DEFAULT_NIGHT_END, 10) : 24,      // 12:00 AM (midnight)
  gracePeriodSec: process.env.DEFAULT_GRACE_PERIOD_SEC ? parseInt(process.env.DEFAULT_GRACE_PERIOD_SEC, 10) : 120, // 2 minutes grace period
  googleSheetsUrl: process.env.GOOGLE_SHEETS_URL || "",
  googleSheetsEnabled: process.env.GOOGLE_SHEETS_ENABLED === 'true',
  journalStorage: process.env.JOURNAL_STORAGE || "none",            // "none", "obsidian", "gdoc", "both"
  obsidianVaultPath: process.env.OBSIDIAN_VAULT_PATH || "",             // e.g. "/Users/username/Documents/Obsidian"
  obsidianJournalFolder: process.env.OBSIDIAN_JOURNAL_FOLDER || "Journal",  // Subfolder in Vault
  googleDocId: process.env.GOOGLE_DOC_ID || "",                    // Google Doc ID or URL for appending journal entries
  gymLockEnabled: process.env.GYM_LOCK_ENABLED !== 'false',        // default: true
  gymLockStartHour: process.env.GYM_LOCK_START_HOUR ? parseInt(process.env.GYM_LOCK_START_HOUR, 10) : 21, // 9:00 PM
  gymMinDurationMinutes: process.env.GYM_MIN_DURATION_MINUTES ? parseInt(process.env.GYM_MIN_DURATION_MINUTES, 10) : 30,
  gymRoutineVerificationEnabled: process.env.GYM_ROUTINE_VERIFICATION_ENABLED !== 'false', // default: true
  gymMinTotalSets: process.env.GYM_MIN_TOTAL_SETS ? parseInt(process.env.GYM_MIN_TOTAL_SETS, 10) : 12,
  gymWeeklyGoal: process.env.GYM_WEEKLY_GOAL ? parseInt(process.env.GYM_WEEKLY_GOAL, 10) : 5, // 5 active days / week
  gymRequireNoConsecutiveRestDays: process.env.GYM_NO_CONSECUTIVE_REST !== 'false', // default: true (max 1 rest day in a row)
  gymMinSteps: process.env.GYM_MIN_STEPS ? parseInt(process.env.GYM_MIN_STEPS, 10) : 13000,
  weeklyLockEnabled: process.env.WEEKLY_LOCK_ENABLED !== 'false',  // default: true
  weeklyLockDay: process.env.WEEKLY_LOCK_DAY ? parseInt(process.env.WEEKLY_LOCK_DAY, 10) : 0, // 0 = Sunday
  weeklyLockStartHour: process.env.WEEKLY_LOCK_START_HOUR ? parseInt(process.env.WEEKLY_LOCK_START_HOUR, 10) : 0, // 12:00 AM
  weeklyLockEndHour: process.env.WEEKLY_LOCK_END_HOUR ? parseInt(process.env.WEEKLY_LOCK_END_HOUR, 10) : 24, // 12:00 AM (all day)
  targetWeight: process.env.TARGET_WEIGHT ? parseFloat(process.env.TARGET_WEIGHT) : 75.0,
  targetProtein: process.env.TARGET_PROTEIN ? parseInt(process.env.TARGET_PROTEIN, 10) : 150,
  targetSteps: process.env.TARGET_STEPS ? parseInt(process.env.TARGET_STEPS, 10) : 13000,
  targetCalories: process.env.TARGET_CALORIES ? parseInt(process.env.TARGET_CALORIES, 10) : 2500,
  supplementsList: ['Vitamin D3', 'Vitamin K2', 'Omega-3', 'Creatine'],
  enforceSupplementsBlocker: true,
  enforceProteinShakeBlocker: true,
  weeklyPhotosRequired: true,
  ankiLockEnabled: process.env.ANKI_LOCK_ENABLED !== 'false', // default: true
  ankiLockStartHour: process.env.ANKI_LOCK_START_HOUR ? parseInt(process.env.ANKI_LOCK_START_HOUR, 10) : 21, // 9:00 PM
  ankiConnectUrl: process.env.ANKI_CONNECT_URL || 'http://localhost:8765',
  ankiIgnoredDecks: process.env.ANKI_IGNORED_DECKS ? process.env.ANKI_IGNORED_DECKS.split(',').map(s => s.trim()).filter(Boolean) : [],
  practiceLockEnabled: process.env.PRACTICE_LOCK_ENABLED !== 'false', // default: true
  practiceLockStartHour: process.env.PRACTICE_LOCK_START_HOUR ? parseInt(process.env.PRACTICE_LOCK_START_HOUR, 10) : 21, // 9:00 PM
  practiceMinDueToUnlock: process.env.PRACTICE_MIN_DUE_TO_UNLOCK ? parseInt(process.env.PRACTICE_MIN_DUE_TO_UNLOCK, 10) : 1
};

export function getLocalDateString(dateInput = new Date()) {
  const d = new Date(dateInput);
  // Subtract 4 hours to handle night owls (logical day transitions at 4 AM)
  d.setHours(d.getHours() - 4);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createDefaultEntry(date) {
  return {
    date,
    morningCompleted: false,
    morningJournalCompleted: false,
    nightCompleted: false,
    nightJournalCompleted: false,
    weeklyCompleted: false,
    gymCompleted: false,
    gymWorkoutData: null,
    gymVerificationError: null,
    ankiCompleted: false,
    ankiDecksData: null,
    ankiVerificationError: null,
    ankiManualOverride: false,
    ankiOverrideReason: null,
    ankiTotalDue: 0,
    ankiReviewedToday: 0,
    practiceCompleted: false,
    practiceManualOverride: false,
    practiceOverrideReason: null,
    practiceDueCount: 0,
    practiceCompletedCount: 0,
    practiceCompletedQuestionIds: [],
    morningData: null,
    morningJournalData: null,
    nightData: null,
    nightJournalData: null,
    weeklyData: null,
    morningSynced: false,
    morningJournalSynced: false,
    nightSynced: false,
    nightJournalSynced: false,
    weeklySynced: false
  };
}

export function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return { entries: {}, config: DEFAULT_CONFIG };
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    parsed.config = { ...DEFAULT_CONFIG, ...parsed.config };

    if (process.env.DEFAULT_MORNING_START) parsed.config.morningStart = parseInt(process.env.DEFAULT_MORNING_START, 10);
    if (process.env.DEFAULT_MORNING_END) parsed.config.morningEnd = parseInt(process.env.DEFAULT_MORNING_END, 10);
    if (process.env.DEFAULT_NIGHT_START) parsed.config.nightStart = parseInt(process.env.DEFAULT_NIGHT_START, 10);
    if (process.env.DEFAULT_NIGHT_END) parsed.config.nightEnd = parseInt(process.env.DEFAULT_NIGHT_END, 10);
    if (process.env.DEFAULT_GRACE_PERIOD_SEC) parsed.config.gracePeriodSec = parseInt(process.env.DEFAULT_GRACE_PERIOD_SEC, 10);

    if (process.env.GOOGLE_SHEETS_URL) parsed.config.googleSheetsUrl = process.env.GOOGLE_SHEETS_URL;
    if (process.env.GOOGLE_SHEETS_ENABLED) parsed.config.googleSheetsEnabled = process.env.GOOGLE_SHEETS_ENABLED === 'true';

    if (process.env.JOURNAL_STORAGE) parsed.config.journalStorage = process.env.JOURNAL_STORAGE;
    if (process.env.OBSIDIAN_VAULT_PATH) parsed.config.obsidianVaultPath = process.env.OBSIDIAN_VAULT_PATH;
    if (process.env.OBSIDIAN_JOURNAL_FOLDER) parsed.config.obsidianJournalFolder = process.env.OBSIDIAN_JOURNAL_FOLDER;
    if (process.env.GOOGLE_DOC_ID) parsed.config.googleDocId = process.env.GOOGLE_DOC_ID;

    if (process.env.GYM_LOCK_ENABLED) parsed.config.gymLockEnabled = process.env.GYM_LOCK_ENABLED !== 'false';
    if (process.env.GYM_LOCK_START_HOUR) parsed.config.gymLockStartHour = parseInt(process.env.GYM_LOCK_START_HOUR, 10);
    if (process.env.GYM_MIN_DURATION_MINUTES) parsed.config.gymMinDurationMinutes = parseInt(process.env.GYM_MIN_DURATION_MINUTES, 10);
    if (process.env.GYM_ROUTINE_VERIFICATION_ENABLED) parsed.config.gymRoutineVerificationEnabled = process.env.GYM_ROUTINE_VERIFICATION_ENABLED !== 'false';
    if (process.env.GYM_MIN_TOTAL_SETS) parsed.config.gymMinTotalSets = parseInt(process.env.GYM_MIN_TOTAL_SETS, 10);
    if (process.env.GYM_WEEKLY_GOAL) parsed.config.gymWeeklyGoal = parseInt(process.env.GYM_WEEKLY_GOAL, 10);
    if (process.env.GYM_NO_CONSECUTIVE_REST) parsed.config.gymRequireNoConsecutiveRestDays = process.env.GYM_NO_CONSECUTIVE_REST !== 'false';
    if (process.env.GYM_MIN_STEPS) parsed.config.gymMinSteps = parseInt(process.env.GYM_MIN_STEPS, 10);

    if (process.env.WEEKLY_LOCK_ENABLED) parsed.config.weeklyLockEnabled = process.env.WEEKLY_LOCK_ENABLED !== 'false';
    if (process.env.WEEKLY_LOCK_DAY) parsed.config.weeklyLockDay = parseInt(process.env.WEEKLY_LOCK_DAY, 10);
    if (process.env.WEEKLY_LOCK_START_HOUR) parsed.config.weeklyLockStartHour = parseInt(process.env.WEEKLY_LOCK_START_HOUR, 10);
    if (process.env.WEEKLY_LOCK_END_HOUR) parsed.config.weeklyLockEndHour = parseInt(process.env.WEEKLY_LOCK_END_HOUR, 10);

    if (process.env.TARGET_WEIGHT) parsed.config.targetWeight = parseFloat(process.env.TARGET_WEIGHT);
    if (process.env.TARGET_PROTEIN) parsed.config.targetProtein = parseInt(process.env.TARGET_PROTEIN, 10);
    if (process.env.TARGET_STEPS) parsed.config.targetSteps = parseInt(process.env.TARGET_STEPS, 10);
    if (process.env.TARGET_CALORIES) parsed.config.targetCalories = parseInt(process.env.TARGET_CALORIES, 10);

    if (!parsed.config.supplementsList || !Array.isArray(parsed.config.supplementsList) || parsed.config.supplementsList.length === 0) {
      parsed.config.supplementsList = ['Vitamin D3', 'Vitamin K2', 'Omega-3', 'Creatine'];
    }
    if (parsed.config.enforceSupplementsBlocker === undefined) {
      parsed.config.enforceSupplementsBlocker = true;
    }
    if (parsed.config.enforceProteinShakeBlocker === undefined) {
      parsed.config.enforceProteinShakeBlocker = true;
    }
    if (process.env.ANKI_LOCK_ENABLED) parsed.config.ankiLockEnabled = process.env.ANKI_LOCK_ENABLED !== 'false';
    if (process.env.ANKI_LOCK_START_HOUR) parsed.config.ankiLockStartHour = parseInt(process.env.ANKI_LOCK_START_HOUR, 10);
    if (process.env.ANKI_CONNECT_URL) parsed.config.ankiConnectUrl = process.env.ANKI_CONNECT_URL;
    if (process.env.ANKI_IGNORED_DECKS) parsed.config.ankiIgnoredDecks = process.env.ANKI_IGNORED_DECKS.split(',').map(s => s.trim()).filter(Boolean);

    if (!Array.isArray(parsed.config.ankiIgnoredDecks)) {
      parsed.config.ankiIgnoredDecks = [];
    }

    if (process.env.PRACTICE_LOCK_ENABLED) parsed.config.practiceLockEnabled = process.env.PRACTICE_LOCK_ENABLED !== 'false';
    if (process.env.PRACTICE_LOCK_START_HOUR) parsed.config.practiceLockStartHour = parseInt(process.env.PRACTICE_LOCK_START_HOUR, 10);
    if (process.env.PRACTICE_MIN_DUE_TO_UNLOCK) parsed.config.practiceMinDueToUnlock = parseInt(process.env.PRACTICE_MIN_DUE_TO_UNLOCK, 10);

    return parsed;
  } catch (err) {
    console.error("Error reading database file, returning default", err);
    return { entries: {}, config: DEFAULT_CONFIG };
  }
}

export function writeDb(db) {
  const tmpFile = `${DB_FILE}.tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error("Failed to write database file:", err);
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
    }
  }
}
