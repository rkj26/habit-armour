import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Load environment variables from .env file if it exists
if (fs.existsSync(path.join(process.cwd(), '.env'))) {
  const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
}

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(process.cwd(), 'habits_data.json');

app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.method === 'POST') {
    console.log(`  Payload:`, JSON.stringify(req.body));
  }
  next();
});

// Initialize Database if it doesn't exist
const DEFAULT_CONFIG = {
  morningStart: process.env.DEFAULT_MORNING_START ? parseInt(process.env.DEFAULT_MORNING_START, 10) : 5,   // 5:00 AM
  morningEnd: process.env.DEFAULT_MORNING_END ? parseInt(process.env.DEFAULT_MORNING_END, 10) : 12,   // 12:00 PM
  nightStart: process.env.DEFAULT_NIGHT_START ? parseInt(process.env.DEFAULT_NIGHT_START, 10) : 20,    // 8:00 PM
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
  targetWeight: process.env.TARGET_WEIGHT ? parseFloat(process.env.TARGET_WEIGHT) : 75.0,
  targetProtein: process.env.TARGET_PROTEIN ? parseInt(process.env.TARGET_PROTEIN, 10) : 150,
  targetSteps: process.env.TARGET_STEPS ? parseInt(process.env.TARGET_STEPS, 10) : 10000,
  targetCalories: process.env.TARGET_CALORIES ? parseInt(process.env.TARGET_CALORIES, 10) : 2500
};

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return { entries: {}, config: DEFAULT_CONFIG };
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    // Ensure all config fields are populated
    parsed.config = { ...DEFAULT_CONFIG, ...parsed.config };
    
    // Environment overrides take precedence if defined
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

    if (process.env.TARGET_WEIGHT) parsed.config.targetWeight = parseFloat(process.env.TARGET_WEIGHT);
    if (process.env.TARGET_PROTEIN) parsed.config.targetProtein = parseInt(process.env.TARGET_PROTEIN, 10);
    if (process.env.TARGET_STEPS) parsed.config.targetSteps = parseInt(process.env.TARGET_STEPS, 10);
    if (process.env.TARGET_CALORIES) parsed.config.targetCalories = parseInt(process.env.TARGET_CALORIES, 10);

    return parsed;
  } catch (err) {
    console.error("Error reading database file, returning default", err);
    return { entries: {}, config: DEFAULT_CONFIG };
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Helper to perform HTTP POST while manually following redirects to keep POST method & body
async function fetchPostWithRedirect(url, body) {
  let currentUrl = url;
  let response;
  const maxRedirects = 5;
  let method = 'POST';
  let requestBody = JSON.stringify(body);

  console.log(`[fetchPostWithRedirect] Initial POST URL: ${url}`);

  for (let i = 0; i < maxRedirects; i++) {
    console.log(`[fetchPostWithRedirect] [Attempt ${i+1}] ${method}ing to: ${currentUrl}`);
    
    const fetchOptions = {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      redirect: 'manual'
    };
    if (method === 'POST') {
      fetchOptions.body = requestBody;
    }

    response = await fetch(currentUrl, fetchOptions);

    console.log(`[fetchPostWithRedirect] [Attempt ${i+1}] Status: ${response.status} (${response.statusText})`);

    if (response.status === 301 || response.status === 302 || response.status === 303 || response.status === 307 || response.status === 308) {
      const redirectUrl = response.headers.get('location');
      console.log(`[fetchPostWithRedirect] [Attempt ${i+1}] Redirect URL: ${redirectUrl}`);
      if (redirectUrl) {
        currentUrl = new URL(redirectUrl, currentUrl).toString();
        
        // For 301, 302, 303: Switch to GET and clear body for follow-up requests
        if (response.status === 301 || response.status === 302 || response.status === 303) {
          method = 'GET';
          requestBody = undefined;
        }
        
        continue;
      }
    }
    break;
  }

  return response;
}

// Helper to sync to Google Sheets via Web App URL
async function syncToGoogleSheets(type, date, data, config) {
  console.log(`[syncToGoogleSheets] Starting sync for [${type}] on ${date}`);
  if (!config.googleSheetsEnabled || !config.googleSheetsUrl) {
    console.log(`[syncToGoogleSheets] Sync skipped: Enabled=${config.googleSheetsEnabled}, URL=${config.googleSheetsUrl}`);
    return { success: false, error: "Sync disabled or URL not configured" };
  }
  try {
    const targetType = type.endsWith('Journal') ? type.replace('Journal', '') : type;
    const response = await fetchPostWithRedirect(config.googleSheetsUrl, {
      type: targetType,
      date: date,
      data: data,
      googleDocId: config.googleDocId
    });
    
    if (!response.ok) {
      const respText = await response.text().catch(() => "");
      console.log(`[syncToGoogleSheets] Server responded with error status. Body: ${respText}`);
      throw new Error(`HTTP ${response.status} Error: ${respText}`);
    }
    
    const result = await response.json();
    console.log(`[syncToGoogleSheets] Sync succeeded:`, JSON.stringify(result));
    return result;
  } catch (err) {
    console.error(`Google Sheet sync failed for [${type}] on ${date}:`, err.message);
    return { success: false, error: err.message };
  }
}

// Grace period state in-memory (resets on server restart, which is fine)
let gracePeriodStart = null;
let gracePeriodWindow = null;
let gracePeriodDate = null;
let testLockActive = false;
let testLockExpiresAt = null;
let lastGymCheckTime = 0;

function getLocalDateString(dateInput = new Date()) {
  const d = new Date(dateInput);
  // Subtract 4 hours to handle night owls (logical day transitions at 4 AM)
  d.setHours(d.getHours() - 4);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Get configurations
app.get('/api/config', (req, res) => {
  const db = readDb();
  res.json(db.config);
});

// Update configurations
app.post('/api/config', (req, res) => {
  const db = readDb();
  db.config = { ...db.config, ...req.body };
  writeDb(db);
  res.json({ success: true, config: db.config });
});

// Get local IP address (for phone integration)
app.get('/api/ip', (req, res) => {
  res.json({ ip: getLocalIP() });
});

// Trigger a short test lock (lasts 15 seconds)
app.post('/api/test-lock', (req, res) => {
  testLockActive = true;
  testLockExpiresAt = Date.now() + 15000; // 15 seconds
  res.json({ success: true, message: "Test lock triggered. It will lock the device for 15 seconds." });
});

// Test connection to Google Sheets
app.post('/api/test-sync', async (req, res) => {
  const { googleSheetsUrl } = req.body;
  if (!googleSheetsUrl) {
    return res.status(400).json({ success: false, error: "Google Sheets Web App URL is required" });
  }
  try {
    const response = await fetchPostWithRedirect(googleSheetsUrl, {
      type: 'test',
      date: '',
      data: {}
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} Error`);
    }
    
    const result = await response.json();
    res.json(result);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Manual sync trigger for a single log entry
app.post('/api/sync-entry', async (req, res) => {
  const { date, window } = req.body;
  if (!date || !['morning', 'night', 'weekly'].includes(window)) {
    return res.status(400).json({ error: "Missing or invalid parameters" });
  }
  
  const db = readDb();
  const entry = db.entries[date];
  if (!entry) {
    return res.status(404).json({ error: "Log entry not found" });
  }
  
  let data = null;
  if (window === 'morning') data = entry.morningData;
  else if (window === 'night') data = entry.nightData;
  else if (window === 'weekly') data = entry.weeklyData;
  
  if (!data) {
    return res.status(400).json({ error: `No ${window} log data available to sync for this date` });
  }
  
  const result = await syncToGoogleSheets(window, date, data, db.config);
  if (result.success) {
    entry[`${window}Synced`] = true;
    writeDb(db);
  }
  res.json(result);
});

// Batch sync all unsynced completed logs
app.post('/api/sync-all', async (req, res) => {
  const db = readDb();
  const config = db.config;
  if (!config.googleSheetsEnabled || !config.googleSheetsUrl) {
    return res.status(400).json({ success: false, error: "Google Sheets Sync is disabled or not configured" });
  }
  
  const dates = Object.keys(db.entries);
  let syncedCount = 0;
  let failedCount = 0;
  
  for (const date of dates) {
    const entry = db.entries[date];
    const types = ['morning', 'night', 'weekly'];
    
    for (const t of types) {
      const isCompleted = entry[`${t}Completed`] || (t === 'weekly' && entry.weeklyData);
      const isSynced = entry[`${t}Synced`];
      const data = t === 'morning' ? entry.morningData : t === 'night' ? entry.nightData : entry.weeklyData;
      
      if (isCompleted && !isSynced && data) {
        const result = await syncToGoogleSheets(t, date, data, config);
        if (result.success) {
          entry[`${t}Synced`] = true;
          syncedCount++;
        } else {
          failedCount++;
        }
      }
    }
  }
  
  if (syncedCount > 0) {
    writeDb(db);
  }
  
  res.json({ success: true, syncedCount, failedCount });
});

// Main status endpoint used by macOS and iOS clients to check locking
app.get('/api/status', (req, res) => {
  const db = readDb();
  const config = db.config;
  const today = getLocalDateString();
  const now = new Date();
  const hour = now.getHours();

  // 1. Check for test lock first
  if (testLockActive) {
    if (Date.now() < testLockExpiresAt) {
      return res.json({
        locked: true,
        isWarning: false,
        secondsRemaining: 0,
        window: "test",
        reason: "Test lock active",
        completed: false
      });
    } else {
      testLockActive = false;
      testLockExpiresAt = null;
    }
  }

  // Ensure entry exists for today
  if (!db.entries[today]) {
    db.entries[today] = {
      date: today,
      morningCompleted: false,
      morningJournalCompleted: false,
      nightCompleted: false,
      nightJournalCompleted: false,
      weeklyCompleted: false,
      gymCompleted: false,
      gymWorkoutData: null,
      gymVerificationError: null,
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
    writeDb(db);
  }

  const entry = db.entries[today];
  let activeWindow = null;

  // Determine if inside morning or night locking window
  const isMorningWindow = hour >= config.morningStart && hour < config.morningEnd;
  const isNightWindow = hour >= config.nightStart && hour < config.nightEnd;

  const dateObj = new Date(today + 'T00:00:00');
  const dayOfWeek = dateObj.getDay(); // 0 = Sunday

  if (isMorningWindow) {
    if (!entry.morningCompleted) {
      activeWindow = "morning";
    } else if (!entry.morningJournalCompleted) {
      activeWindow = "morningJournal";
    }
  } else if (isNightWindow) {
    if (!entry.nightCompleted) {
      activeWindow = "night";
    } else if (!entry.nightJournalCompleted) {
      activeWindow = "nightJournal";
    }
  } else if (dayOfWeek === 0 && !entry.weeklyCompleted) {
    activeWindow = "weekly";
  }

  // Gym lock check (takes effect starting at gymLockStartHour if morning/night/weekly locks are not active)
  if (!activeWindow && config.gymLockEnabled && hour >= config.gymLockStartHour) {
    if (!entry.gymCompleted) {
      // Throttle background Hevy API queries to once per 60 seconds
      if (Date.now() - lastGymCheckTime > 60000) {
        lastGymCheckTime = Date.now();
        console.log(`[status] Triggering throttled background Gym verification for ${today}...`);
        verifyGymWorkoutForDate(today, config).then(result => {
          // Read DB again to prevent overwrite race condition
          const currentDb = readDb();
          if (currentDb.entries[today]) {
            currentDb.entries[today].gymCompleted = result.verified;
            currentDb.entries[today].gymWorkoutData = result.workout || null;
            currentDb.entries[today].gymVerificationError = result.reason || null;
            writeDb(currentDb);
            console.log(`[status] Background gym verification result: ${result.verified}. Reason: ${result.reason}`);
          }
        }).catch(err => {
          console.error("[status] Background gym verification failed:", err);
        });
      }
      activeWindow = "gym";
    }
  }

  if (activeWindow) {
    const isGym = activeWindow === "gym";
    return res.json({
      locked: true,
      isWarning: false,
      secondsRemaining: 0,
      window: activeWindow,
      reason: isGym 
        ? "Gym workout not verified. Complete your routine and sync your Hevy data to unlock."
        : `Device locked. Fill your ${activeWindow} log to unlock.`,
      completed: false,
      error: isGym ? (entry.gymVerificationError || null) : null,
      entry
    });
  }

  // If we reach here, we are either outside windows, or logs are completed
  // Reset grace period memory
  gracePeriodStart = null;
  gracePeriodWindow = null;
  gracePeriodDate = null;

  res.json({
    locked: false,
    isWarning: false,
    secondsRemaining: 0,
    window: null,
    reason: "Device usable. All logs for current period completed.",
    completed: true,
    entry
  });
});

// Write Daily Journal Entry to local Obsidian Vault
function writeObsidianJournal(date, config) {
  if (!config.journalStorage || config.journalStorage === 'none') {
    return;
  }
  if (config.journalStorage !== 'obsidian' && config.journalStorage !== 'both') {
    return;
  }
  if (!config.obsidianVaultPath) {
    console.warn(`[writeObsidianJournal] Obsidian sync enabled but obsidianVaultPath is not configured.`);
    return;
  }

  try {
    const db = readDb();
    const entry = db.entries[date];
    if (!entry) return;

    let resolvedPath = config.obsidianVaultPath;
    if (resolvedPath.startsWith('~/')) {
      resolvedPath = path.join(os.homedir(), resolvedPath.slice(2));
    } else {
      resolvedPath = path.resolve(resolvedPath);
    }

    let targetFolder = resolvedPath;
    if (config.obsidianJournalFolder) {
      targetFolder = path.join(targetFolder, config.obsidianJournalFolder);
    }

    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const filePath = path.join(targetFolder, `${date}.md`);

    // Determine headings based on day of week
    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday

    let morningHeading = "☀️ Morning Log";
    let morningPrompt = "Morning Journal";
    let nightHeading = "🌙 Night Log";
    let nightPrompt = "Night Reflection";

    if (dayOfWeek === 6) { // Saturday (End of Week Retrospective)
      morningHeading = "☀️ Saturday Log — Weekend Recharge";
      morningPrompt = "Saturday Reflection & Rest";
      nightHeading = "🌙 Saturday Log — Weekly Retrospective";
      nightPrompt = "Weekly Retrospective";
    } else if (dayOfWeek === 0) { // Sunday (Start of Week Goal Setting)
      morningHeading = "☀️ Sunday Log — Start of Week Goals";
      morningPrompt = "Weekly Planning: Overall Broad Goals";
      nightHeading = "🌙 Sunday Log — Weekly Prep";
      nightPrompt = "Weekly Prep";
    } else { // Monday - Friday (Daily Goals)
      morningHeading = "☀️ Morning Log — Daily Goals & Intentions";
      morningPrompt = "Daily Goals & Intentions";
      nightHeading = "🌙 Night Log — Daily Review";
      nightPrompt = "Daily Progress & Execution";
    }

    let morningSection = "";
    if (entry.morningCompleted || entry.morningJournalCompleted) {
      const data = entry.morningData || {};
      const journalData = entry.morningJournalData || {};
      morningSection = `<!-- HABIT_ARMOR_MORNING_START -->
## ${morningHeading}
- **Weight**: ${data.wakingWeight || '-'} kg
- **Sleep**: ${data.sleepHours || '-'} hours (Self: ${data.sleepQualitySelf || '-'}/10, Device: ${data.sleepQualityDevice || '-'}/100)
- **Energy**: ${data.energyLevels || '-'}/10 | **Mood**: ${data.mood || '-'}/10 | **Stress**: ${data.stress || '-'}/10
- **Resting HR**: ${data.restingHR || '-'} BPM | **BP**: ${data.bloodPressure || '-'}

### ${morningPrompt}
${journalData.journalEntry || ''}
<!-- HABIT_ARMOR_MORNING_END -->`;
    } else {
      morningSection = `<!-- HABIT_ARMOR_MORNING_START -->\n<!-- HABIT_ARMOR_MORNING_END -->`;
    }

    let nightSection = "";
    if (entry.nightCompleted || entry.nightJournalCompleted) {
      const data = entry.nightData || {};
      const journalData = entry.nightJournalData || {};
      nightSection = `<!-- HABIT_ARMOR_NIGHT_START -->
## ${nightHeading}
- **Calories**: ${data.calories || '-'} kcal (P: ${data.protein || '-'}g, C: ${data.carbs || '-'}g, F: ${data.fats || '-'}g)
- **Steps**: ${data.steps || '-'} | **Water**: ${data.waterConsumed || '-'} L
- **Food Quality**: ${data.foodQuality || '-'}/10 | **Appetite**: ${data.hunger || '-'}/10

### ${nightPrompt}
${journalData.journalEntry || ''}
<!-- HABIT_ARMOR_NIGHT_END -->`;
    } else {
      nightSection = `<!-- HABIT_ARMOR_NIGHT_START -->\n<!-- HABIT_ARMOR_NIGHT_END -->`;
    }

    let fileContent = "";
    if (fs.existsSync(filePath)) {
      fileContent = fs.readFileSync(filePath, 'utf8');
    } else {
      fileContent = `# Journal - ${date}\n\n<!-- HABIT_ARMOR_MORNING_START -->\n<!-- HABIT_ARMOR_MORNING_END -->\n\n<!-- HABIT_ARMOR_NIGHT_START -->\n<!-- HABIT_ARMOR_NIGHT_END -->\n`;
    }

    // Replace morning section
    const morningRegex = /<!-- HABIT_ARMOR_MORNING_START -->[\s\S]*<!-- HABIT_ARMOR_MORNING_END -->/;
    if (morningRegex.test(fileContent)) {
      fileContent = fileContent.replace(morningRegex, morningSection);
    } else {
      fileContent += "\n\n" + morningSection;
    }

    // Replace night section
    const nightRegex = /<!-- HABIT_ARMOR_NIGHT_START -->[\s\S]*<!-- HABIT_ARMOR_NIGHT_END -->/;
    if (nightRegex.test(fileContent)) {
      fileContent = fileContent.replace(nightRegex, nightSection);
    } else {
      fileContent += "\n\n" + nightSection;
    }

    fs.writeFileSync(filePath, fileContent, 'utf8');
    console.log(`[writeObsidianJournal] Successfully updated journal for ${date} in ${filePath}`);
  } catch (err) {
    console.error(`[writeObsidianJournal] Error writing Obsidian file:`, err.message);
  }
}

// Save logs for a window (morning, morningJournal, night, nightJournal, weekly)
app.post('/api/submit', (req, res) => {
  const { window, data, date } = req.body;
  if (!['morning', 'morningJournal', 'night', 'nightJournal', 'weekly'].includes(window)) {
    return res.status(400).json({ error: "Invalid window type. Must be 'morning', 'morningJournal', 'night', 'nightJournal', or 'weekly'." });
  }

  // Validate that the journal entry has >= 100 words
  if (window === 'morningJournal' || window === 'nightJournal') {
    if (!data || !data.journalEntry) {
      return res.status(400).json({ error: "Journal entry is required." });
    }
    
    const entryText = data.journalEntry.trim();
    if (entryText === '') {
      return res.status(400).json({ error: "Journal entry cannot be empty." });
    }

    const words = entryText.split(/\s+/).filter(Boolean).length;
    if (words < 100) {
      return res.status(400).json({ error: `Journal entry only has ${words} words. A minimum of 100 words is required.` });
    }
  }

  const db = readDb();
  const today = getLocalDateString();
  const targetDate = date || today;

  if (!db.entries[targetDate]) {
    db.entries[targetDate] = {
      date: targetDate,
      morningCompleted: false,
      morningJournalCompleted: false,
      nightCompleted: false,
      nightJournalCompleted: false,
      weeklyCompleted: false,
      gymCompleted: false,
      gymWorkoutData: null,
      gymVerificationError: null,
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

  const entry = db.entries[targetDate];

  if (window === 'morning') {
    entry.morningData = data;
    entry.morningCompleted = true;
  } else if (window === 'morningJournal') {
    entry.morningJournalData = data;
    entry.morningJournalCompleted = true;
  } else if (window === 'night') {
    entry.nightData = data;
    entry.nightCompleted = true;
  } else if (window === 'nightJournal') {
    entry.nightJournalData = data;
    entry.nightJournalCompleted = true;
  } else if (window === 'weekly') {
    entry.weeklyData = data;
    entry.weeklyCompleted = true;
  }

  // Trigger background sync if enabled
  if (db.config.googleSheetsEnabled && db.config.googleSheetsUrl) {
    syncToGoogleSheets(window, targetDate, data, db.config).then(result => {
      // Re-read DB to avoid overwrite race condition
      const currentDb = readDb();
      if (currentDb.entries[targetDate]) {
        currentDb.entries[targetDate][`${window}Synced`] = result.success;
        writeDb(currentDb);
        console.log(`Background sheet sync finished for [${window}] on ${targetDate}. Success: ${result.success}`);
      }
    });
  } else {
    entry[`${window}Synced`] = false;
  }

  writeDb(db);

  // Write to Obsidian Journal if enabled
  if (window === 'morning' || window === 'morningJournal' || window === 'night' || window === 'nightJournal') {
    writeObsidianJournal(targetDate, db.config);
  }

  // Clear grace period state since form is submitted
  if (gracePeriodWindow === window && gracePeriodDate === targetDate) {
    gracePeriodStart = null;
    gracePeriodWindow = null;
    gracePeriodDate = null;
  }

  res.json({ success: true, entry });
});

// Get log history
app.get('/api/history', (req, res) => {
  const db = readDb();
  // Return entries sorted by date descending
  const sortedEntries = Object.values(db.entries).sort((a, b) => b.date.localeCompare(a.date));
  res.json(sortedEntries);
});

// Health check / general info
app.get('/api/info', (req, res) => {
  const db = readDb();
  const today = getLocalDateString();
  const entry = db.entries[today] || null;
  res.json({
    today,
    entry,
    localIP: getLocalIP(),
    time: new Date().toLocaleTimeString()
  });
});

// Helper to verify Hevy workout for a specific date YYYY-MM-DD
async function verifyGymWorkoutForDate(dateStr, config) {
  const apiKey = process.env.HEVY_API_KEY;
  if (!apiKey) {
    return { verified: false, reason: "HEVY_API_KEY is not configured in the .env file." };
  }

  try {
    // 1. Fetch workouts (recent 10)
    const workoutsResponse = await fetch('https://api.hevyapp.com/v1/workouts?page=1&page_size=10', {
      headers: {
        'api-key': apiKey,
        'Accept': 'application/json'
      }
    });
    if (!workoutsResponse.ok) {
      const errText = await workoutsResponse.text();
      return { verified: false, reason: `Failed to fetch workouts from Hevy: ${errText}` };
    }
    const workoutsData = await workoutsResponse.json();
    const workoutsList = workoutsData.workouts || [];

    // Filter workouts matching today's date in local time with logical day shift
    const todayWorkouts = workoutsList.filter(w => {
      if (!w.start_time) return false;
      const localDateStr = getLocalDateString(w.start_time);
      return localDateStr === dateStr;
    });

    if (todayWorkouts.length === 0) {
      return { verified: false, reason: "No workouts logged in Hevy for today." };
    }

    // Sort today's workouts by end_time descending (usually just one, but check best first)
    todayWorkouts.sort((a, b) => new Date(b.end_time || b.start_time) - new Date(a.end_time || a.start_time));
    const workout = todayWorkouts[0];

    // 2. Validate duration
    const startTime = new Date(workout.start_time);
    const endTime = workout.end_time ? new Date(workout.end_time) : new Date();
    const durationMinutes = Math.round((endTime - startTime) / 60000);

    if (durationMinutes < config.gymMinDurationMinutes) {
      return {
        verified: false,
        reason: `Workout duration (${durationMinutes} mins) is less than required (${config.gymMinDurationMinutes} mins).`,
        workout
      };
    }

    return {
      verified: true,
      reason: `Workout completed and verified. Duration: ${durationMinutes} mins.`,
      workout
    };
  } catch (err) {
    console.error("Hevy verification error:", err);
    return { verified: false, reason: `Verification threw an error: ${err.message}` };
  }
}

// Trigger Gym workout verification immediately
app.post('/api/hevy/verify-today', async (req, res) => {
  const db = readDb();
  const config = db.config;
  const today = getLocalDateString();

  // Ensure entry exists for today
  if (!db.entries[today]) {
    db.entries[today] = {
      date: today,
      morningCompleted: false,
      morningJournalCompleted: false,
      nightCompleted: false,
      nightJournalCompleted: false,
      weeklyCompleted: false,
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

  const entry = db.entries[today];
  
  // Call verification helper
  const result = await verifyGymWorkoutForDate(today, config);
  
  entry.gymCompleted = result.verified;
  entry.gymWorkoutData = result.workout || null;
  entry.gymVerificationError = result.reason || null;
  
  writeDb(db);
  
  res.json({
    success: result.verified,
    reason: result.reason,
    workout: result.workout
  });
});

// Hevy API & Gemini Gym Analysis Config Status
app.get('/api/hevy/status', (req, res) => {
  res.json({
    hevyApiKeyConfigured: !!process.env.HEVY_API_KEY,
    geminiApiKeyConfigured: !!process.env.GEMINI_API_KEY
  });
});

// Fetch recent workouts from Hevy API
app.get('/api/hevy/workouts', async (req, res) => {
  const apiKey = process.env.HEVY_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: "HEVY_API_KEY is not configured in the .env file." });
  }
  try {
    const response = await fetch('https://api.hevyapp.com/v1/workouts?page=1&page_size=10', {
      headers: {
        'api-key': apiKey,
        'Accept': 'application/json'
      }
    });
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Hevy API Error: ${errText}` });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Hevy workouts fetch failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// Generate training critiques from recent workouts using Gemini AI
app.post('/api/hevy/analyze', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return res.status(400).json({ error: "GEMINI_API_KEY is not configured in the .env file." });
  }
  
  const { workouts } = req.body;
  if (!workouts || !Array.isArray(workouts) || workouts.length === 0) {
    return res.status(400).json({ error: "No workout data provided for analysis." });
  }

  // Build a compact summary of workouts for the LLM
  let workoutSummary = "Here are my recent gym workouts:\n\n";
  workouts.forEach((w, idx) => {
    const dateStr = w.start_time ? w.start_time.split('T')[0] : 'Unknown date';
    workoutSummary += `Workout #${idx + 1}: ${w.title || 'Workout'} on ${dateStr}\n`;
    if (w.notes) {
      workoutSummary += `Notes: ${w.notes}\n`;
    }
    if (w.exercises && Array.isArray(w.exercises)) {
      w.exercises.forEach(e => {
        workoutSummary += `- Exercise: ${e.title}\n`;
        if (e.sets && Array.isArray(e.sets)) {
          const setStrings = e.sets.map(s => {
            const wt = s.weight_kg !== null && s.weight_kg !== undefined ? `${s.weight_kg}kg` : 'bodyweight';
            const reps = s.reps || 0;
            const rpe = s.rpe ? ` (RPE ${s.rpe})` : '';
            return `${reps} reps @ ${wt}${rpe}`;
          });
          workoutSummary += `  Sets: ${setStrings.join(', ')}\n`;
        }
      });
    }
    workoutSummary += "\n";
  });

  const prompt = `You are an elite strength & conditioning coach and fitness analyst.
Analyze the following recent workout log data for a client:

${workoutSummary}

Please provide a highly actionable coaching analysis. Structure your response in clean Markdown with the following sections:
1. **Overview & Consistency**: General summary of training frequency and workout volume.
2. **Key Insights**: Identify strength progressions, exercises where they are performing well, and potential plateaus or training imbalances.
3. **Coaching Recommendations**: Give exactly 3 concrete, specific suggestions on what they should do next to improve performance, progressive overload, or recovery.

Be encouraging, professional, and precise. Use weights and exercises referenced in their log.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Gemini API Error: ${errText}` });
    }

    const geminiRes = await response.json();
    const text = geminiRes.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(500).json({ error: "Failed to extract text analysis from Gemini API response." });
    }

    res.json({ analysis: text });
  } catch (err) {
    console.error("Gemini analysis failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// Serve GOOGLE_SHEET_SETUP.md locally
app.get('/GOOGLE_SHEET_SETUP.md', (req, res) => {
  res.setHeader('Content-Type', 'text/markdown; charset=UTF-8');
  res.sendFile(path.join(process.cwd(), 'GOOGLE_SHEET_SETUP.md'));
});

// Serve Static Frontend Assets (if compiled)
const clientDist = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Habit Armor API is running. Build the client using "npm run build" in the client folder to serve the UI.');
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Accessible on local network at http://${getLocalIP()}:${PORT}`);
});
