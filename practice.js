import express from 'express';
import fs from 'fs';
import path from 'path';
import { readDb, writeDb, createDefaultEntry, getLocalDateString } from './db.js';

const router = express.Router();

const STUDY_DB_FILE = path.join(process.cwd(), 'study_data.json');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// In-memory throttled cache for verifyPracticeStatus to avoid reading study_data.json on every 5s poll
let cachedStatus = null;
let lastStatusCacheTime = 0;
const STATUS_CACHE_TTL_MS = 15000; // 15 seconds

export function invalidatePracticeStatusCache() {
  cachedStatus = null;
  lastStatusCacheTime = 0;
}

// ---------------------------------------------------------
// Atomic Study DB Storage Helpers
// ---------------------------------------------------------

export function readStudyDb() {
  try {
    if (!fs.existsSync(STUDY_DB_FILE)) {
      return {
        items: {},
        questions: {},
        attempts: {},
        meta: { nextItemSeq: 1, nextQuestionSeq: 1, nextAttemptSeq: 1 }
      };
    }
    const raw = fs.readFileSync(STUDY_DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.items) parsed.items = {};
    if (!parsed.questions) parsed.questions = {};
    if (!parsed.attempts) parsed.attempts = {};
    if (!parsed.meta) parsed.meta = { nextItemSeq: 1, nextQuestionSeq: 1, nextAttemptSeq: 1 };
    return parsed;
  } catch (err) {
    console.error('[practice] Error reading study_data.json:', err);
    return {
      items: {},
      questions: {},
      attempts: {},
      meta: { nextItemSeq: 1, nextQuestionSeq: 1, nextAttemptSeq: 1 }
    };
  }
}

export function writeStudyDb(db) {
  const tmpFile = `${STUDY_DB_FILE}.tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmpFile, STUDY_DB_FILE);
    invalidatePracticeStatusCache();
  } catch (err) {
    console.error('[practice] Error writing study_data.json:', err);
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
    }
    throw err;
  }
}

function addDaysToDateString(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  const nextY = date.getUTCFullYear();
  const nextM = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextD = String(date.getUTCDate()).padStart(2, '0');
  return `${nextY}-${nextM}-${nextD}`;
}

// ---------------------------------------------------------
// SM-2 Spaced Repetition Logic (Pure Functions)
// ---------------------------------------------------------

/**
 * Maps Gemini 0-10 score to SM-2 quality (0-5)
 * Strict cutoff: scores <= 5 are considered non-mastery (quality < 3) and reset repetitions.
 */
export function scoreToSm2Quality(score) {
  const s = Number(score);
  if (isNaN(s) || s <= 1) return 0;
  if (s <= 3) return 1;
  if (s <= 5) return 2; // Failure/developing - resets interval
  if (s <= 6) return 3; // Bare pass
  if (s <= 8) return 4; // Good recall
  return 5;             // Mastered (9-10)
}

/**
 * Computes next SM-2 state from current state and quality (0-5)
 */
export function computeNextSm2(currentSm2 = {}, quality = 0, todayStr = getLocalDateString()) {
  let easeFactor = typeof currentSm2.easeFactor === 'number' ? currentSm2.easeFactor : 2.5;
  let repetitions = typeof currentSm2.repetitions === 'number' ? currentSm2.repetitions : 0;
  let intervalDays = typeof currentSm2.intervalDays === 'number' ? currentSm2.intervalDays : 0;

  // Standard SM-2 Ease Factor adjustment formula
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  easeFactor = Math.max(1.3, easeFactor + delta);
  easeFactor = Math.round(easeFactor * 100) / 100;

  if (quality < 3) {
    // Failed recall: reset repetitions and schedule for immediate review tomorrow
    repetitions = 0;
    intervalDays = 1;
  } else {
    // Successful recall
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
    }
    repetitions += 1;
  }

  const nextDueDate = addDaysToDateString(todayStr, intervalDays);

  return {
    easeFactor,
    repetitions,
    intervalDays,
    dueDate: nextDueDate,
    lastReviewedAt: new Date().toISOString()
  };
}

/**
 * Helper to determine if practice requirement is satisfied for today.
 * If minRequired === 0 -> Requires clearing all due questions (dueCount === 0).
 * If minRequired > 0 -> Requires at least minRequired distinct questions answered today OR dueCount === 0.
 */
export function isPracticeRequirementSatisfied(entry, dueCount, minRequired) {
  if (!entry) return dueCount === 0;
  if (entry.practiceManualOverride) return true;
  if (dueCount === 0) return true;

  if (minRequired === 0) {
    // 0 explicitly means "clear entire due queue"
    return dueCount === 0;
  }

  // Count distinct questions answered today
  const distinctCount = Array.isArray(entry.practiceCompletedQuestionIds)
    ? entry.practiceCompletedQuestionIds.length
    : (entry.practiceCompletedCount || 0);

  return distinctCount >= minRequired;
}

// ---------------------------------------------------------
// Lock Verification Helper (Used by server.js status check)
// ---------------------------------------------------------

export function verifyPracticeStatus(config = {}) {
  const now = Date.now();
  const minRequired = typeof config.practiceMinDueToUnlock === 'number'
    ? config.practiceMinDueToUnlock
    : 1;

  if (cachedStatus && (now - lastStatusCacheTime) < STATUS_CACHE_TTL_MS) {
    return { ...cachedStatus, minRequired };
  }

  try {
    const db = readStudyDb();
    const today = getLocalDateString();
    const activeQuestions = Object.values(db.questions).filter(q => q.active !== false);
    const dueQuestions = activeQuestions.filter(q => !q.sm2 || !q.sm2.dueDate || q.sm2.dueDate <= today);

    cachedStatus = {
      dueCount: dueQuestions.length,
      minRequired,
      activeCount: activeQuestions.length
    };
    lastStatusCacheTime = now;

    return cachedStatus;
  } catch (err) {
    console.error('[practice] verifyPracticeStatus error:', err);
    return { dueCount: 0, minRequired, activeCount: 0 };
  }
}

// ---------------------------------------------------------
// Question Bank CRUD Endpoints
// ---------------------------------------------------------

// GET all study items (Topics & Papers)
router.get('/items', (req, res) => {
  const db = readStudyDb();
  res.json({ items: Object.values(db.items) });
});

// POST create study item
router.post('/items', (req, res) => {
  try {
    const { type, title, tags, notes, paper } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const itemType = type === 'paper' ? 'paper' : 'topic';
    const db = readStudyDb();
    const seq = db.meta.nextItemSeq || 1;
    db.meta.nextItemSeq = seq + 1;
    const id = `${itemType}_${Date.now()}_${seq}`;

    const newItem = {
      id,
      type: itemType,
      title: title.trim(),
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(s => s.trim()).filter(Boolean) : []),
      createdAt: new Date().toISOString(),
      notes: notes ? notes.trim() : '',
      paper: itemType === 'paper' ? (paper || { arxivId: '', url: '', authors: [], year: new Date().getFullYear() }) : null
    };

    db.items[id] = newItem;
    writeStudyDb(db);
    res.json({ success: true, item: newItem });
  } catch (err) {
    console.error('[practice] Error creating item:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update study item
router.put('/items/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readStudyDb();
    if (!db.items[id]) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const { title, tags, notes, paper, type } = req.body;
    if (title) db.items[id].title = title.trim();
    if (tags !== undefined) {
      db.items[id].tags = Array.isArray(tags) ? tags : tags.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (notes !== undefined) db.items[id].notes = notes.trim();
    if (paper !== undefined && db.items[id].type === 'paper') {
      db.items[id].paper = { ...db.items[id].paper, ...paper };
    }
    if (type && (type === 'topic' || type === 'paper')) {
      db.items[id].type = type;
    }

    writeStudyDb(db);
    res.json({ success: true, item: db.items[id] });
  } catch (err) {
    console.error('[practice] Error updating item:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE study item (soft deactivates questions to preserve historical attempts)
router.delete('/items/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readStudyDb();
    if (!db.items[id]) {
      return res.status(404).json({ error: 'Item not found' });
    }

    for (const q of Object.values(db.questions)) {
      if (q.itemId === id) {
        q.active = false;
      }
    }
    delete db.items[id];
    writeStudyDb(db);
    res.json({ success: true });
  } catch (err) {
    console.error('[practice] Error deleting item:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET questions
router.get('/questions', (req, res) => {
  const { itemId } = req.query;
  const db = readStudyDb();
  let questions = Object.values(db.questions).filter(q => q.active !== false);
  if (itemId) {
    questions = questions.filter(q => q.itemId === itemId);
  }
  res.json({ questions });
});

// POST create question manually
router.post('/questions', (req, res) => {
  try {
    const { itemId, prompt, answerTemplate, difficulty } = req.body;
    if (!itemId || !prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'itemId and prompt are required' });
    }
    const db = readStudyDb();
    const item = db.items[itemId];
    if (!item) {
      return res.status(404).json({ error: 'Parent study item not found' });
    }

    const seq = db.meta.nextQuestionSeq || 1;
    db.meta.nextQuestionSeq = seq + 1;
    const id = `q_${Date.now()}_${seq}`;
    const today = getLocalDateString();

    const newQuestion = {
      id,
      itemId,
      itemType: item.type,
      prompt: prompt.trim(),
      answerTemplate: answerTemplate || (item.type === 'paper' ? 'paper' : 'topic'),
      difficulty: difficulty || 'Medium',
      source: 'manual',
      active: true,
      sm2: {
        easeFactor: 2.5,
        repetitions: 0,
        intervalDays: 0,
        dueDate: today,
        lastReviewedAt: null
      }
    };

    db.questions[id] = newQuestion;
    writeStudyDb(db);
    res.json({ success: true, question: newQuestion });
  } catch (err) {
    console.error('[practice] Error creating question:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update question
router.put('/questions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readStudyDb();
    if (!db.questions[id]) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const { prompt, answerTemplate, difficulty, active } = req.body;
    if (prompt !== undefined) db.questions[id].prompt = prompt.trim();
    if (answerTemplate !== undefined) db.questions[id].answerTemplate = answerTemplate;
    if (difficulty !== undefined) db.questions[id].difficulty = difficulty;
    if (active !== undefined) db.questions[id].active = !!active;

    writeStudyDb(db);
    res.json({ success: true, question: db.questions[id] });
  } catch (err) {
    console.error('[practice] Error updating question:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE question
router.delete('/questions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readStudyDb();
    if (!db.questions[id]) {
      return res.status(404).json({ error: 'Question not found' });
    }
    db.questions[id].active = false;
    writeStudyDb(db);
    res.json({ success: true });
  } catch (err) {
    console.error('[practice] Error deactivating question:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------
// Gemini Automatic Question Generator
// ---------------------------------------------------------

router.post('/questions/generate', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return res.status(400).json({ error: 'GEMINI_API_KEY is not configured in .env' });
  }

  const { itemId, count = 3 } = req.body;
  if (!itemId) {
    return res.status(400).json({ error: 'itemId is required' });
  }

  const db = readStudyDb();
  const item = db.items[itemId];
  if (!item) {
    return res.status(404).json({ error: 'Study item not found' });
  }

  const promptText = `You are a strict, world-class ML researcher creating rigorous active-recall practice questions for an advanced practitioner.

Item Title: "${item.title}"
Item Type: "${item.type}"
Item Notes: "${item.notes || 'None'}"
${item.paper ? `Paper Metadata: ${JSON.stringify(item.paper)}` : ''}

Generate ${count} distinct, challenging active-recall questions designed to test mathematical mastery, mechanism intuition, and conceptual depth.
- For Topics: questions requiring mathematical proof/derivation from first principles, causal/mechanistic "why" intuition, and intuitive ELI5 explanations.
- For Papers: questions testing core claims, mathematical methodology, key ablations, limitations, and intuitive analogies.

Respond with strict JSON matching this schema:
{
  "questions": [
    {
      "prompt": "Detailed question text...",
      "answerTemplate": "${item.type === 'paper' ? 'paper' : 'topic'}",
      "difficulty": "Hard"
    }
  ]
}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Gemini API Error: ${errText}` });
    }

    const geminiRes = await response.json();
    const rawText = geminiRes.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return res.status(500).json({ error: 'Empty response from Gemini API' });
    }

    const parsed = JSON.parse(rawText);
    const candidateQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const today = getLocalDateString();
    const createdQuestions = [];

    for (const q of candidateQuestions) {
      const seq = db.meta.nextQuestionSeq || 1;
      db.meta.nextQuestionSeq = seq + 1;
      const id = `q_${Date.now()}_${seq}`;

      const newQ = {
        id,
        itemId,
        itemType: item.type,
        prompt: q.prompt,
        answerTemplate: q.answerTemplate || (item.type === 'paper' ? 'paper' : 'topic'),
        difficulty: q.difficulty || 'Hard',
        source: 'gemini-generated',
        active: true,
        sm2: {
          easeFactor: 2.5,
          repetitions: 0,
          intervalDays: 0,
          dueDate: today,
          lastReviewedAt: null
        }
      };

      db.questions[id] = newQ;
      createdQuestions.push(newQ);
    }

    writeStudyDb(db);
    res.json({ success: true, count: createdQuestions.length, questions: createdQuestions });
  } catch (err) {
    console.error('[practice] Error generating questions:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------
// Practice Loop & Strict Evaluation Endpoints
// ---------------------------------------------------------

// GET due questions joined with parent item metadata
router.get('/due', (req, res) => {
  const db = readStudyDb();
  const today = getLocalDateString();
  const activeQuestions = Object.values(db.questions).filter(q => q.active !== false);

  const dueList = activeQuestions
    .filter(q => !q.sm2 || !q.sm2.dueDate || q.sm2.dueDate <= today)
    .map(q => {
      const item = db.items[q.itemId] || { title: 'Unknown Topic', type: q.itemType, tags: [] };
      return {
        ...q,
        itemTitle: item.title,
        itemType: item.type,
        itemTags: item.tags || [],
        itemNotes: item.notes || '',
        itemPaper: item.paper || null
      };
    });

  res.json({
    today,
    dueCount: dueList.length,
    dueQuestions: dueList
  });
});

// POST submit answer for strict Gemini AI evaluation & SM-2 update
router.post('/attempts', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return res.status(400).json({ error: 'GEMINI_API_KEY is not configured in .env' });
  }

  const { questionId, answerMarkdown } = req.body;
  if (!questionId || !answerMarkdown || !answerMarkdown.trim()) {
    return res.status(400).json({ error: 'questionId and answerMarkdown are required.' });
  }

  const db = readStudyDb();
  const question = db.questions[questionId];
  if (!question) {
    return res.status(404).json({ error: 'Question not found' });
  }
  const item = db.items[question.itemId] || { title: 'Unknown Study Item', type: question.itemType };

  const isTopic = question.answerTemplate === 'topic';

  const evaluationPrompt = `You are a demanding, top-tier Machine Learning / AI Safety Professor and strict academic reviewer.
Your objective is to thoroughly audit the user's active-recall answer against highest technical and mathematical standards.
Do NOT cheerlead or soften criticism. Actively identify hand-waving, vague explanations, or incorrect mathematical leaps.

STUDY ITEM: "${item.title}" (${item.type.toUpperCase()})
QUESTION PROMPT:
${question.prompt}

MANDATORY COMPLETENESS CRITERIA:
${isTopic ? `
1. Mathematical Derivation / Proof: Rigorous equations, valid algebraic steps, clearly stated assumptions, boundary conditions.
2. Intuition & "Why" Breakdown: Must explain the causal reason for each term/constant/mechanism (e.g. why subtract the baseline? why clip the ratio? why divide by sqrt(d_k)? what failure mode does this prevent?).
3. ELI5 (Explain Like I'm 5): A crisp, intuitive metaphor that captures the core mechanism without jargon.
` : `
1. Core Claims & Problem: Exactly what problem does the paper solve and what are its primary claims?
2. Methodology & Architecture: Concrete mathematical formulations, network architecture, and training details.
3. Key Empirical Results & Ablations: What evidence supports the claims?
4. Limitations & Failure Modes: When does the approach fail or degrade?
5. ELI5 Summary: An accessible, intuitive analogy explaining the paper's essence.
`}

USER'S SUBMITTED ANSWER:
${answerMarkdown}

EVALUATION INSTRUCTIONS:
- Evaluate the submission strictly.
- Grade on a 0 to 10 scale (where 10 is flawless academic mastery, 8 is solid, 6 is bare minimum pass, and <=5 is a failure requiring repetition).
- For each rubric dimension, provide both a numeric score (0 to 10) and concise qualitative feedback.
- Identify concrete flagged issues. Every flag MUST quote the exact offending phrase from the user's text and provide a concise note explaining why it is problematic.
- Flag Types: "misused-term" | "vague" | "hand-wavy" | "unsupported-leap".

Respond with strict JSON matching this exact structure:
{
  "score": 7.5,
  "rubric": {
    "correctness": { "score": 8, "feedback": "Assessment of mathematical & factual correctness..." },
    "precisionRigor": { "score": 7, "feedback": "Assessment of mathematical rigor & notation..." },
    "intuitionQuality": { "score": 8, "feedback": "Assessment of the 'why' and causal explanations..." },
    "eli5Clarity": { "score": 8, "feedback": "Assessment of the ELI5 section..." },
    "completeness": { "score": 7, "feedback": "Assessment of whether all required sections were provided..." }
  },
  "critique": "Comprehensive, direct, constructive academic critique summarizing what was strong and exactly what needs improvement...",
  "flaggedIssues": [
    {
      "type": "vague",
      "quote": "exact phrase from user text",
      "note": "precise explanation of why this is problematic..."
    }
  ]
}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: evaluationPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Gemini Evaluation API Error: ${errText}` });
    }

    const geminiRes = await response.json();
    const rawText = geminiRes.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return res.status(500).json({ error: 'Failed to extract evaluation from Gemini response' });
    }

    let parsedEval;
    try {
      parsedEval = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('[practice] JSON parse error on Gemini output:', rawText);
      return res.status(500).json({ error: 'Failed to parse Gemini evaluation JSON.' });
    }

    const score = Math.max(0, Math.min(10, Number(parsedEval.score) || 0));
    const quality = scoreToSm2Quality(score);
    const today = getLocalDateString();

    // Compute updated SM-2 schedule
    const updatedSm2 = computeNextSm2(question.sm2, quality, today);
    question.sm2 = updatedSm2;

    // Create attempt record
    const seq = db.meta.nextAttemptSeq || 1;
    db.meta.nextAttemptSeq = seq + 1;
    const attemptId = `att_${Date.now()}_${seq}`;

    const attempt = {
      id: attemptId,
      questionId,
      itemId: question.itemId,
      submittedAt: new Date().toISOString(),
      answerMarkdown,
      evaluation: {
        score,
        quality,
        rubric: parsedEval.rubric || {},
        critique: parsedEval.critique || '',
        flaggedIssues: Array.isArray(parsedEval.flaggedIssues) ? parsedEval.flaggedIssues : []
      },
      geminiModel: 'gemini-2.5-flash',
      evaluatedAt: new Date().toISOString()
    };

    db.attempts[attemptId] = attempt;
    writeStudyDb(db);

    // Update today's cached counts in habits_data.json via shared db.js
    const habitsDb = readDb();
    if (!habitsDb.entries[today]) {
      habitsDb.entries[today] = createDefaultEntry(today);
    }
    const todayEntry = habitsDb.entries[today];

    if (!Array.isArray(todayEntry.practiceCompletedQuestionIds)) {
      todayEntry.practiceCompletedQuestionIds = [];
    }
    if (!todayEntry.practiceCompletedQuestionIds.includes(questionId)) {
      todayEntry.practiceCompletedQuestionIds.push(questionId);
    }
    todayEntry.practiceCompletedCount = todayEntry.practiceCompletedQuestionIds.length;

    const remainingDue = Object.values(db.questions)
      .filter(q => q.active !== false && (!q.sm2?.dueDate || q.sm2.dueDate <= today)).length;
    todayEntry.practiceDueCount = remainingDue;

    const minRequired = typeof habitsDb.config?.practiceMinDueToUnlock === 'number'
      ? habitsDb.config.practiceMinDueToUnlock
      : 1;

    todayEntry.practiceCompleted = isPracticeRequirementSatisfied(todayEntry, remainingDue, minRequired);
    writeDb(habitsDb);

    res.json({
      success: true,
      attempt,
      updatedQuestion: question,
      item,
      sm2: updatedSm2,
      practiceCompletedToday: todayEntry.practiceCompleted,
      remainingDueCount: remainingDue,
      distinctCompletedToday: todayEntry.practiceCompletedCount
    });
  } catch (err) {
    console.error('[practice] Error evaluating attempt:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET attempt history
router.get('/attempts', (req, res) => {
  const { questionId, itemId, limit = 50 } = req.query;
  const db = readStudyDb();
  let attempts = Object.values(db.attempts);
  if (questionId) {
    attempts = attempts.filter(a => a.questionId === questionId);
  } else if (itemId) {
    attempts = attempts.filter(a => a.itemId === itemId);
  }
  attempts.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json({ attempts: attempts.slice(0, Number(limit)) });
});

// POST diagram image upload
router.post('/upload-image', (req, res) => {
  try {
    const { questionId = 'diagram', dataUrl } = req.body;
    if (!dataUrl) {
      return res.status(400).json({ error: 'dataUrl is required' });
    }

    const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid base64 image data' });
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    const filename = `practice_${questionId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(filePath, buffer);
    const url = `/uploads/${filename}`;

    res.json({ success: true, url, filename });
  } catch (err) {
    console.error('[practice] Image upload failed:', err);
    res.status(500).json({ error: 'Failed to upload practice image' });
  }
});

// ---------------------------------------------------------
// Status & Override Routes
// ---------------------------------------------------------

router.get('/status', (req, res) => {
  try {
    const db = readStudyDb();
    const habitsDb = readDb();
    const today = getLocalDateString();
    const entry = habitsDb.entries[today] || {};

    const activeQuestions = Object.values(db.questions).filter(q => q.active !== false);
    const dueQuestions = activeQuestions.filter(q => !q.sm2?.dueDate || q.sm2.dueDate <= today);

    const config = habitsDb.config || {};
    const minRequired = typeof config.practiceMinDueToUnlock === 'number'
      ? config.practiceMinDueToUnlock
      : 1;

    const completedCount = Array.isArray(entry.practiceCompletedQuestionIds)
      ? entry.practiceCompletedQuestionIds.length
      : (entry.practiceCompletedCount || 0);

    const isCompleted = isPracticeRequirementSatisfied(entry, dueQuestions.length, minRequired);

    res.json({
      today,
      dueCount: dueQuestions.length,
      completedTodayCount: completedCount,
      minRequired,
      isCompleted,
      isManualOverride: !!entry.practiceManualOverride,
      overrideReason: entry.practiceOverrideReason || null,
      totalQuestions: activeQuestions.length,
      totalItems: Object.keys(db.items).length,
      totalAttempts: Object.keys(db.attempts).length
    });
  } catch (err) {
    console.error('[practice] /status error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/override', (req, res) => {
  try {
    const habitsDb = readDb();
    const today = getLocalDateString();
    const { reason } = req.body;

    if (!habitsDb.entries[today]) {
      habitsDb.entries[today] = createDefaultEntry(today);
    }

    const entry = habitsDb.entries[today];
    entry.practiceManualOverride = true;
    entry.practiceCompleted = true;
    entry.practiceOverrideReason = reason || 'Manual practice override applied';
    writeDb(habitsDb);

    res.json({ success: true, message: 'Practice requirement overridden for today.' });
  } catch (err) {
    console.error('[practice] /override error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/reset-override', (req, res) => {
  try {
    const habitsDb = readDb();
    const today = getLocalDateString();
    if (habitsDb.entries[today]) {
      const entry = habitsDb.entries[today];
      entry.practiceManualOverride = false;
      entry.practiceOverrideReason = null;

      const studyDb = readStudyDb();
      const dueCount = Object.values(studyDb.questions)
        .filter(q => q.active !== false && (!q.sm2?.dueDate || q.sm2.dueDate <= today)).length;
      entry.practiceDueCount = dueCount;

      const minRequired = typeof habitsDb.config?.practiceMinDueToUnlock === 'number'
        ? habitsDb.config.practiceMinDueToUnlock
        : 1;

      entry.practiceCompleted = isPracticeRequirementSatisfied(entry, dueCount, minRequired);
      writeDb(habitsDb);
    }
    res.json({ success: true, message: 'Practice override reset.' });
  } catch (err) {
    console.error('[practice] /reset-override error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
