import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import os from 'os';
import practiceRouter, { verifyPracticeStatus } from './practice.js';
import { readDb, writeDb, createDefaultEntry, getLocalDateString, DEFAULT_CONFIG, DB_FILE } from './db.js';

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

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/api/practice', practiceRouter);

// Helper to sanitize payload for logging to avoid dumping huge base64 strings into logfiles
function sanitizeBodyForLog(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const copy = Array.isArray(obj) ? [] : {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (key === 'dataUrl' && typeof val === 'string') {
      copy[key] = `[base64 image, length: ${val.length}]`;
    } else if (typeof val === 'string' && val.length > 200) {
      copy[key] = val.substring(0, 100) + `... [truncated ${val.length - 100} chars]`;
    } else if (typeof val === 'object' && val !== null) {
      copy[key] = sanitizeBodyForLog(val);
    } else {
      copy[key] = val;
    }
  }
  return copy;
}

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.method === 'POST') {
    console.log(`  Payload:`, JSON.stringify(sanitizeBodyForLog(req.body)));
  }
  next();
});

function isDayActive(entry, minSteps = 13000) {
  if (!entry) return false;
  if (entry.gymCompleted) return true;
  if (entry.nightData) {
    if (entry.nightData.trainingDay === 'Yes') return true;
    if (entry.nightData.cardioPerformed === 'Yes') return true;
    const steps = parseInt(entry.nightData.steps, 10);
    if (!isNaN(steps) && steps >= minSteps) return true;
  }
  return false;
}

function writeDb(data) {
  try {
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error("Error writing database file atomically:", err);
  }
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
let lastAnkiCheckTime = 0;



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
  try {
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
      db.entries[today] = createDefaultEntry(today);
      writeDb(db);
    }

    const entry = db.entries[today];
    const pendingWindows = [];

    // Determine if inside morning or night locking window
    const isMorningWindow = hour >= config.morningStart && hour < config.morningEnd;
    const isNightWindow = hour >= config.nightStart && hour < config.nightEnd;

    const dateObj = new Date(today + 'T00:00:00');
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday

    // 1. Check Morning Window
    if (isMorningWindow) {
      if (!entry.morningCompleted) {
        pendingWindows.push("morning");
      } else if (!entry.morningJournalCompleted) {
        pendingWindows.push("morningJournal");
      }
    }

    // 2. Check Night Window
    if (isNightWindow) {
      if (!entry.nightCompleted) {
        pendingWindows.push("night");
      } else if (!entry.nightJournalCompleted) {
        pendingWindows.push("nightJournal");
      }
    }

    // 3. Check Weekly Spec Lock Window
    const weeklyEnabled = config.weeklyLockEnabled !== false;
    const weeklyDay = config.weeklyLockDay !== undefined ? config.weeklyLockDay : 0;
    const weeklyStart = config.weeklyLockStartHour !== undefined ? config.weeklyLockStartHour : 0;
    const weeklyEnd = config.weeklyLockEndHour !== undefined ? config.weeklyLockEndHour : 24;
    const isWeeklyWindow = weeklyEnabled && dayOfWeek === weeklyDay && hour >= weeklyStart && hour < weeklyEnd;

    if (isWeeklyWindow && !entry.weeklyCompleted) {
      pendingWindows.push("weekly");
    }

    // 4. Gym & Physical Activity Lock Check
    const todayDate = new Date(today + 'T00:00:00');
    const dayIdx = (todayDate.getDay() + 6) % 7; // 0 = Monday, 6 = Sunday
    const mondayDate = new Date(todayDate);
    mondayDate.setDate(todayDate.getDate() - dayIdx);

    let weeklyActiveCount = 0;
    for (let i = 0; i < 7; i++) {
      const dObj = new Date(mondayDate);
      dObj.setDate(mondayDate.getDate() + i);
      const dStr = dObj.toISOString().split('T')[0];
      if (isDayActive(db.entries[dStr], config.gymMinSteps || 13000)) {
        weeklyActiveCount++;
      }
    }

    const yesterdayObj = new Date(todayDate);
    yesterdayObj.setDate(todayDate.getDate() - 1);
    const yesterdayStr = yesterdayObj.toISOString().split('T')[0];
    const isYesterdayActive = isDayActive(db.entries[yesterdayStr], config.gymMinSteps || 13000);
    const isTodayActive = isDayActive(entry, config.gymMinSteps || 13000);

    if (isTodayActive && !entry.gymCompleted) {
      entry.gymCompleted = true;
      writeDb(db);
    }

    const gymWeeklyGoal = config.gymWeeklyGoal || 5;
    const noConsecutiveRest = config.gymRequireNoConsecutiveRestDays !== false;
    const isWeeklyGoalReached = weeklyActiveCount >= gymWeeklyGoal;
    const isTodayMandatory = !isTodayActive && (!isYesterdayActive || (7 - dayIdx <= (gymWeeklyGoal - weeklyActiveCount)));

    if (config.gymLockEnabled && hour >= config.gymLockStartHour) {
      if (!isTodayActive && !isWeeklyGoalReached && (noConsecutiveRest && !isYesterdayActive || isTodayMandatory)) {
        // Throttle background Hevy API queries to once per 60 seconds
        if (Date.now() - lastGymCheckTime > 60000) {
          lastGymCheckTime = Date.now();
          console.log(`[status] Triggering throttled background Gym verification for ${today}...`);
          verifyGymWorkoutForDate(today, config).then(result => {
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
        pendingWindows.push("gym");
      }
    }

    // 5. Anki Flashcard Review Lock Check
    const ankiLockEnabled = config.ankiLockEnabled !== false;
    const ankiStartHour = config.ankiLockStartHour !== undefined ? config.ankiLockStartHour : 21;

    if (ankiLockEnabled && hour >= ankiStartHour) {
      if (!entry.ankiCompleted && !entry.ankiManualOverride) {
        // Throttle background Anki API queries to once per 30 seconds
        if (Date.now() - lastAnkiCheckTime > 30000) {
          lastAnkiCheckTime = Date.now();
          verifyAnkiStatus(config).then(result => {
            const currentDb = readDb();
            if (currentDb.entries[today]) {
              if (result.reachable) {
                currentDb.entries[today].ankiCompleted = result.verified;
                currentDb.entries[today].ankiDecksData = result.decks || null;
                currentDb.entries[today].ankiVerificationError = result.verified ? null : result.reason;
                currentDb.entries[today].ankiTotalDue = result.totalDue || 0;
                currentDb.entries[today].ankiReviewedToday = result.reviewedToday || 0;
              } else {
                currentDb.entries[today].ankiVerificationError = result.reason;
              }
              writeDb(currentDb);
            }
          }).catch(err => {
            console.error("[status] Background Anki verification failed:", err);
          });
        }
        pendingWindows.push("anki");
      }
    }

    // 6. Consistent Practice (Active Recall & Spaced Repetition) Lock Check
    const practiceLockEnabled = config.practiceLockEnabled !== false;
    const practiceStartHour = config.practiceLockStartHour !== undefined ? config.practiceLockStartHour : 21;

    if (practiceLockEnabled && hour >= practiceStartHour) {
      if (!entry.practiceCompleted && !entry.practiceManualOverride) {
        try {
          const { dueCount, minRequired } = verifyPracticeStatus(config);
          entry.practiceDueCount = dueCount;
          if (dueCount === 0 || (entry.practiceCompletedCount || 0) >= minRequired) {
            entry.practiceCompleted = true;
            writeDb(db);
          } else {
            pendingWindows.push("practice");
          }
        } catch (pracErr) {
          console.error("[status] Practice verification error:", pracErr);
        }
      }
    }

    const lockCount = pendingWindows.length;
    const locked = lockCount > 0;
    const activeWindow = pendingWindows[0] || null;

    if (locked) {
      const isGym = activeWindow === "gym";
      const isAnki = activeWindow === "anki";
      const isPractice = activeWindow === "practice";
      const gymReasonText = !isYesterdayActive
        ? `Yesterday was a rest day (No consecutive rest days allowed!). Complete a workout, cardio, or 10k steps to clear.`
        : `Weekly Activity Goal: ${weeklyActiveCount}/${gymWeeklyGoal} active days completed.`;

      let lockReason = `Device locked (${lockCount} active ${lockCount === 1 ? 'breach' : 'breaches'}). Fill your ${activeWindow} log to clear.`;
      if (isGym) {
        lockReason = `Physical activity requirement not met. ${gymReasonText}`;
      } else if (isAnki) {
        lockReason = `Anki flashcards incomplete (${entry.ankiTotalDue || 'pending'} due cards remaining). Open Anki to complete reviews, or submit manual override.`;
      } else if (isPractice) {
        lockReason = `Consistent Practice requirement incomplete (${entry.practiceDueCount || 'pending'} due questions remaining). Complete an active recall proof/paper review, or submit manual override.`;
      }

      return res.json({
        locked: true,
        lockCount,
        pendingWindows,
        weeklyActiveCount,
        gymWeeklyGoal,
        isYesterdayActive,
        isTodayMandatory,
        isWarning: false,
        secondsRemaining: 0,
        window: activeWindow,
        reason: lockReason,
        completed: false,
        error: isGym ? (entry.gymVerificationError || null) : isAnki ? (entry.ankiVerificationError || null) : null,
        entry
      });
    }

    // If we reach here, lockCount is 0 and Mac is unlocked
    gracePeriodStart = null;
    gracePeriodWindow = null;
    gracePeriodDate = null;

    res.json({
      locked: false,
      lockCount: 0,
      pendingWindows: [],
      weeklyActiveCount,
      gymWeeklyGoal,
      isYesterdayActive,
      isTodayMandatory,
      isWarning: false,
      secondsRemaining: 0,
      window: null,
      reason: "Device usable. All logs for current period completed.",
      completed: true,
      entry
    });
  } catch (err) {
    console.error("[status] Exception thrown calculating status:", err);
    // Fail-safe unlock: Never lock device if status calculation encounters an error/throw
    return res.json({
      locked: false,
      lockCount: 0,
      pendingWindows: [],
      isWarning: false,
      secondsRemaining: 0,
      window: null,
      reason: `Fail-safe unlock due to status calculation error: ${err.message}`,
      completed: true,
      error: err.message
    });
  }
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
      let suppText = '-';
      if (typeof data.supplements === 'object' && data.supplements !== null && !Array.isArray(data.supplements)) {
        const checked = Object.entries(data.supplements).filter(([_, v]) => Boolean(v)).map(([k]) => k);
        suppText = checked.length > 0 ? checked.join(', ') : 'None';
      } else if (data.supplements !== undefined && data.supplements !== null) {
        suppText = `${data.supplements}/10`;
      }
      nightSection = `<!-- HABIT_ARMOR_NIGHT_START -->
## ${nightHeading}
- **Calories**: ${data.calories || '-'} kcal (P: ${data.protein || '-'}g, C: ${data.carbs || '-'}g, F: ${data.fats || '-'}g)
- **Steps**: ${data.steps || '-'} | **Water**: ${data.waterConsumed || '-'} L
- **Food Quality**: ${data.foodQuality || '-'}/10 | **Appetite**: ${data.hunger || '-'}/10
- **Supplements**: ${suppText}

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

// Upload Weekly Progress Photo
app.post('/api/upload-photo', (req, res) => {
  try {
    const { date, pose, dataUrl } = req.body;
    if (!date || !pose || !dataUrl) {
      return res.status(400).json({ error: "date, pose, and dataUrl are required." });
    }

    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: "Invalid image base64 format." });
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    const safeDate = date.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `weekly_${safeDate}_${pose}_${Date.now()}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    const photoUrl = `/uploads/${filename}`;
    console.log(`[upload-photo] Saved photo for ${date} [${pose}] -> ${filePath}`);

    return res.json({ success: true, url: photoUrl });
  } catch (err) {
    console.error("[upload-photo] Error saving photo:", err);
    return res.status(500).json({ error: "Failed to upload photo." });
  }
});

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

  // Validate weekly progress photos if required
  if (window === 'weekly' && db.config.weeklyPhotosRequired !== false) {
    const photos = data?.photos || {};
    const missing = [];
    if (!photos.front) missing.push('Front Pose');
    if (!photos.back) missing.push('Back Pose');
    if (!photos.sideLeft) missing.push('Left Side Pose');
    if (!photos.sideRight) missing.push('Right Side Pose');

    if (missing.length > 0) {
      return res.status(400).json({ error: `All 4 weekly progress photos (Front, Back, Left Side, Right Side) are required to clear Weekly Lock. Missing: ${missing.join(', ')}` });
    }
  }

  // Validate supplement checklist if night log submission
  if (window === 'night' && db.config.enforceSupplementsBlocker !== false) {
    const suppList = db.config.supplementsList || ['Vitamin D3', 'Vitamin K2', 'Omega-3', 'Creatine'];
    const userSupps = data?.supplements || {};
    let missing = [];

    if (typeof userSupps === 'object' && userSupps !== null && !Array.isArray(userSupps)) {
      for (const supp of suppList) {
        if (!userSupps[supp]) {
          missing.push(supp);
        }
      }
    } else if (typeof userSupps === 'number') {
      if (userSupps < 10 && suppList.length > 0) {
        missing = suppList;
      }
    } else {
      missing = suppList;
    }

    if (missing.length > 0) {
      return res.status(400).json({ error: `All required supplements must be taken & checked to clear Night Lock. Missing: ${missing.join(', ')}` });
    }
  }

  // Validate Protein Shake & Proof Photo if night log submission
  if (window === 'night' && db.config.enforceProteinShakeBlocker !== false) {
    const ps = data?.proteinShake;
    if (!ps || !ps.taken) {
      return res.status(400).json({ error: "Protein Shake confirmation is required to clear Night Lock." });
    }
    if (!ps.photoUrl) {
      return res.status(400).json({ error: "A proof photo of your Protein Shake is required to clear Night Lock." });
    }
  }

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

// Fetch exercise templates from Hevy API for template matching / searching
let cachedTemplates = null;
let templatesCacheTime = 0;

app.get('/api/hevy/templates', async (req, res) => {
  const apiKey = process.env.HEVY_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: "HEVY_API_KEY is not configured in the .env file." });
  }

  // Return cached templates if fetched within the last 10 minutes
  if (cachedTemplates && (Date.now() - templatesCacheTime < 600000)) {
    return res.json(cachedTemplates);
  }

  try {
    const response = await fetch('https://api.hevyapp.com/v1/exercise_templates?page=1&page_size=100', {
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
    cachedTemplates = data;
    templatesCacheTime = Date.now();
    res.json(data);
  } catch (err) {
    console.error("Hevy exercise templates fetch failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// Post a new workout to Hevy API
app.post('/api/hevy/upload-workout', async (req, res) => {
  const apiKey = process.env.HEVY_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: "HEVY_API_KEY is not configured in the .env file." });
  }

  const { title, description, start_time, end_time, exercises } = req.body;
  if (!title || !exercises || !Array.isArray(exercises) || exercises.length === 0) {
    return res.status(400).json({ error: "Workout title and at least one exercise are required." });
  }

  const payload = {
    workout: {
      title,
      description: description || "",
      start_time: start_time || new Date().toISOString(),
      end_time: end_time || new Date(Date.now() + 1800000).toISOString(),
      exercises: exercises.map((e, idx) => ({
        index: idx,
        exercise_template_id: e.exercise_template_id,
        notes: e.notes || "",
        sets: (e.sets || []).map((s, sIdx) => ({
          index: sIdx,
          type: s.type || "normal",
          weight_kg: s.weight_kg !== undefined && s.weight_kg !== null ? Number(s.weight_kg) : null,
          reps: s.reps !== undefined && s.reps !== null ? Number(s.reps) : null,
          duration_seconds: s.duration_seconds !== undefined && s.duration_seconds !== null ? Number(s.duration_seconds) : null,
          distance_meters: s.distance_meters !== undefined && s.distance_meters !== null ? Number(s.distance_meters) : null
        }))
      }))
    }
  };

  try {
    const response = await fetch('https://api.hevyapp.com/v1/workouts', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Hevy API Error: ${errText}` });
    }

    const data = await response.json();
    console.log(`[hevy-upload] Successfully uploaded workout "${title}" to Hevy.`);
    res.json({ success: true, workout: data });
  } catch (err) {
    console.error("Hevy upload workout failed:", err);
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

// Helper to verify Anki flashcard status via AnkiConnect
async function verifyAnkiStatus(config) {
  const ankiUrl = config.ankiConnectUrl || 'http://localhost:8765';
  const ignoredDecks = Array.isArray(config.ankiIgnoredDecks) ? config.ankiIgnoredDecks : [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    // 1. Check AnkiConnect connectivity / version
    const versionRes = await fetch(ankiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'version', version: 6 }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!versionRes.ok) {
      return {
        reachable: false,
        verified: false,
        reason: `AnkiConnect returned HTTP ${versionRes.status}. Make sure Anki Desktop is running.`
      };
    }

    // 2. Fetch deck names
    const deckRes = await fetch(ankiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deckNames', version: 6 })
    });
    const deckData = await deckRes.json();
    if (deckData.error) {
      return { reachable: true, verified: false, reason: `Anki error: ${deckData.error}` };
    }
    const deckNames = deckData.result || [];

    // Filter out ignored decks (case-insensitive, and child sub-decks)
    const activeDeckNames = deckNames.filter(name => 
      !ignoredDecks.some(ign => name.toLowerCase() === ign.toLowerCase() || name.toLowerCase().startsWith(ign.toLowerCase() + '::'))
    );

    if (activeDeckNames.length === 0) {
      return {
        reachable: true,
        verified: true,
        reason: 'No active decks configured or all decks are in ignored list.',
        decks: [],
        totalDue: 0,
        reviewedToday: 0,
        incompleteDecks: []
      };
    }

    // 3. Fetch Deck Stats
    const statsRes = await fetch(ankiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getDeckStats',
        version: 6,
        params: { decks: activeDeckNames }
      })
    });
    const statsData = await statsRes.json();
    const statsMap = statsData.result || {};

    // 4. Fetch Reviewed Today Count
    let reviewedToday = 0;
    try {
      const revRes = await fetch(ankiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getNumCardsReviewedToday', version: 6 })
      });
      const revData = await revRes.json();
      if (revData.result !== undefined && revData.result !== null) {
        reviewedToday = revData.result;
      }
    } catch (e) {
      console.warn("[anki] Could not get reviewed count today:", e.message);
    }

    let totalDue = 0;
    let incompleteDecks = [];
    const formattedDecks = [];

    for (const [deckId, stat] of Object.entries(statsMap)) {
      const dueCount = (stat.review_count || 0) + (stat.learn_count || 0);
      const isComplete = dueCount === 0;
      totalDue += dueCount;
      if (!isComplete) {
        incompleteDecks.push(`${stat.name} (${dueCount} due)`);
      }
      formattedDecks.push({
        deck_id: stat.deck_id || deckId,
        name: stat.name,
        new_count: stat.new_count || 0,
        learn_count: stat.learn_count || 0,
        review_count: stat.review_count || 0,
        total_in_deck: stat.total_in_deck || 0,
        due_count: dueCount,
        completed: isComplete
      });
    }

    // Sort decks by due_count descending, then by name
    formattedDecks.sort((a, b) => b.due_count - a.due_count || a.name.localeCompare(b.name));

    const verified = totalDue === 0;
    const reason = verified 
      ? `All ${formattedDecks.length} active decks cleared (0 due cards). Reviewed today: ${reviewedToday}.`
      : `${totalDue} due card${totalDue === 1 ? '' : 's'} remaining across ${incompleteDecks.length} deck${incompleteDecks.length === 1 ? '' : 's'}: ${incompleteDecks.join(', ')}`;

    return {
      reachable: true,
      verified,
      reason,
      decks: formattedDecks,
      totalDue,
      reviewedToday,
      incompleteDecks
    };
  } catch (err) {
    return {
      reachable: false,
      verified: false,
      reason: `Anki Desktop is not reachable on ${ankiUrl}. Please ensure Anki is open with AnkiConnect installed. (${err.message})`
    };
  }
}

// Get Anki status, review statistics, and current completion state
app.get('/api/anki/status', async (req, res) => {
  try {
    const db = readDb();
    const config = db.config;
    const today = getLocalDateString();
    const entry = db.entries[today] || null;

    const result = await verifyAnkiStatus(config);
    
    // If Anki is reachable, update today's entry cache
    if (entry && result.reachable) {
      if (!entry.ankiManualOverride) {
        entry.ankiCompleted = result.verified;
      }
      entry.ankiDecksData = result.decks || null;
      entry.ankiTotalDue = result.totalDue || 0;
      entry.ankiReviewedToday = result.reviewedToday || 0;
      entry.ankiVerificationError = result.verified ? null : result.reason;
      writeDb(db);
    }

    res.json({
      success: true,
      reachable: result.reachable,
      verified: entry ? (entry.ankiCompleted || entry.ankiManualOverride) : result.verified,
      manualOverride: entry ? !!entry.ankiManualOverride : false,
      overrideReason: entry ? entry.ankiOverrideReason : null,
      reason: result.reason,
      decks: result.decks || (entry ? entry.ankiDecksData : []) || [],
      totalDue: result.totalDue !== undefined ? result.totalDue : (entry ? entry.ankiTotalDue : 0),
      reviewedToday: result.reviewedToday !== undefined ? result.reviewedToday : (entry ? entry.ankiReviewedToday : 0),
      incompleteDecks: result.incompleteDecks || [],
      config: {
        enabled: config.ankiLockEnabled !== false,
        startHour: config.ankiLockStartHour !== undefined ? config.ankiLockStartHour : 21,
        ankiConnectUrl: config.ankiConnectUrl || 'http://localhost:8765',
        ignoredDecks: config.ankiIgnoredDecks || []
      }
    });
  } catch (err) {
    console.error("[anki-status] Route error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Force-verify Anki status immediately
app.post('/api/anki/verify', async (req, res) => {
  try {
    const db = readDb();
    const config = db.config;
    const today = getLocalDateString();

    if (!db.entries[today]) {
      db.entries[today] = createDefaultEntry(today);
    }

    const entry = db.entries[today];
    const result = await verifyAnkiStatus(config);

    if (result.reachable) {
      if (!entry.ankiManualOverride) {
        entry.ankiCompleted = result.verified;
      }
      entry.ankiDecksData = result.decks || null;
      entry.ankiTotalDue = result.totalDue || 0;
      entry.ankiReviewedToday = result.reviewedToday || 0;
      entry.ankiVerificationError = result.verified ? null : result.reason;
    } else {
      entry.ankiVerificationError = result.reason;
    }

    writeDb(db);

    res.json({
      success: result.verified || entry.ankiManualOverride,
      reachable: result.reachable,
      verified: entry.ankiCompleted || entry.ankiManualOverride,
      reason: result.reason,
      decks: result.decks || [],
      totalDue: result.totalDue || 0,
      reviewedToday: result.reviewedToday || 0
    });
  } catch (err) {
    console.error("[anki-verify] Route error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Submit manual override for Anki (e.g. reviewed on mobile AnkiWeb)
app.post('/api/anki/override', (req, res) => {
  try {
    const db = readDb();
    const today = getLocalDateString();
    const { reason } = req.body;

    if (!db.entries[today]) {
      db.entries[today] = createDefaultEntry(today);
    }

    const entry = db.entries[today];
    entry.ankiManualOverride = true;
    entry.ankiCompleted = true;
    entry.ankiOverrideReason = reason || "Manual override submitted (e.g. mobile review)";
    entry.ankiVerificationError = null;

    writeDb(db);

    res.json({
      success: true,
      message: "Anki requirement manually marked complete for today.",
      entry
    });
  } catch (err) {
    console.error("[anki-override] Route error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Reset manual override
app.post('/api/anki/reset-override', (req, res) => {
  try {
    const db = readDb();
    const today = getLocalDateString();
    const entry = db.entries[today];

    if (entry) {
      entry.ankiManualOverride = false;
      entry.ankiOverrideReason = null;
      entry.ankiCompleted = false;
      writeDb(db);
    }

    res.json({ success: true, message: "Anki override reset." });
  } catch (err) {
    console.error("[anki-reset-override] Route error:", err);
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

// Global Express Error Handler
app.use((err, req, res, next) => {
  console.error('[express-error]', err);
  if (req.path === '/api/status') {
    return res.json({
      locked: false,
      lockCount: 0,
      pendingWindows: [],
      isWarning: false,
      secondsRemaining: 0,
      window: null,
      reason: `Fail-safe unlock due to Express route error: ${err.message}`,
      completed: true,
      error: err.message
    });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large. Please select a smaller photo.' });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }
  return res.status(500).json({ error: err.message || 'Internal server error' });
});

// Process-level uncaught Exception & Rejection Handlers (Fail-Safe)
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception caught by server fail-safe:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection caught by server fail-safe:', reason);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Accessible on local network at http://${getLocalIP()}:${PORT}`);
});
