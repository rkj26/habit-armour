import os
import json
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional, List
from app.config import settings, get_local_date_string
from app.models.study import StudyItem, StudyQuestion, StudyAttempt
from app.models.daily_entry import DailyEntry

def add_days_to_date_string(date_str: str, days: int) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d") + timedelta(days=days)
    return dt.strftime("%Y-%m-%d")

def score_to_sm2_quality(score: float) -> int:
    """Strict academic threshold: scores <= 5 fail and reset repetitions."""
    s = float(score)
    if s <= 1.0: return 0
    if s <= 3.0: return 1
    if s <= 5.0: return 2 # Fail - resets interval
    if s <= 6.0: return 3 # Bare pass
    if s <= 8.0: return 4 # Good recall
    return 5             # Flawless mastery (9-10)

def compute_next_sm2(current_ef: float, current_reps: int, current_interval: int, quality: int, today_str: str) -> Tuple[float, int, int, str]:
    """Pure SM-2 spaced repetition calculation."""
    delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    new_ef = max(1.3, round(current_ef + delta, 2))
    
    if quality < 3:
        new_reps = 0
        new_interval = 1
    else:
        if current_reps == 0:
            new_interval = 1
        elif current_reps == 1:
            new_interval = 6
        else:
            new_interval = max(1, round(current_interval * new_ef))
        new_reps = current_reps + 1
        
    next_due = add_days_to_date_string(today_str, new_interval)
    return new_ef, new_reps, new_interval, next_due

def is_practice_satisfied(entry: Optional[DailyEntry], due_count: int, min_required: int) -> bool:
    if not entry:
        return due_count == 0
    if entry.practiceManualOverride:
        return True
    if due_count == 0:
        return True
    if min_required == 0:
        return due_count == 0
    distinct_count = len(entry.practiceCompletedQuestionIds or [])
    return distinct_count >= min_required

async def evaluate_answer_with_gemini(item: StudyItem, question: StudyQuestion, answer_markdown: str) -> Dict[str, Any]:
    api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured in .env")

    is_topic = (question.answerTemplate == "topic")

    prompt = f"""You are a demanding, top-tier Machine Learning / AI Safety Professor and strict academic reviewer.
Your objective is to thoroughly audit the user's active-recall answer against highest technical and mathematical standards.
Do NOT cheerlead or soften criticism. Actively identify hand-waving, vague explanations, or incorrect mathematical leaps.

STUDY ITEM: "{item.title}" ({item.type.upper()})
QUESTION PROMPT:
{question.prompt}

MANDATORY COMPLETENESS CRITERIA:
{'''
1. Mathematical Derivation / Proof: Rigorous equations, valid algebraic steps, clearly stated assumptions, boundary conditions.
2. Intuition & "Why" Breakdown: Must explain the causal reason for each term/constant/mechanism (e.g. why subtract the baseline? why clip the ratio? why divide by sqrt(d_k)? what failure mode does this prevent?).
3. ELI5 (Explain Like I'm 5): A crisp, intuitive metaphor that captures the core mechanism without jargon.
''' if is_topic else '''
1. Core Claims & Problem: Exactly what problem does the paper solve and what are its primary claims?
2. Methodology & Architecture: Concrete mathematical formulations, network architecture, and training details.
3. Key Empirical Results & Ablations: What evidence supports the claims?
4. Limitations & Failure Modes: When does the approach fail or degrade?
5. ELI5 Summary: An accessible, intuitive analogy explaining the paper's essence.
'''}

USER'S SUBMITTED ANSWER:
{answer_markdown}

EVALUATION INSTRUCTIONS:
- Evaluate the submission strictly on a 0 to 10 scale (where 10 is flawless mastery, 8 is solid, 6 is bare pass, and <=5 is failure requiring repetition).
- For each rubric dimension, provide both a numeric score (0 to 10) and concise qualitative feedback.
- Identify concrete flagged issues. Every flag MUST quote the exact offending phrase and provide a concise note explaining why it is problematic.
- Flag Types: "misused-term" | "vague" | "hand-wavy" | "unsupported-leap".

Respond with strict JSON matching this exact structure:
{{
  "score": 7.5,
  "rubric": {{
    "correctness": {{ "score": 8, "feedback": "..." }},
    "precisionRigor": {{ "score": 7, "feedback": "..." }},
    "intuitionQuality": {{ "score": 8, "feedback": "..." }},
    "eli5Clarity": {{ "score": 8, "feedback": "..." }},
    "completeness": {{ "score": 7, "feedback": "..." }}
  }},
  "critique": "Comprehensive, direct, constructive academic critique...",
  "flaggedIssues": [
    {{
      "type": "vague",
      "quote": "exact phrase from user text",
      "note": "precise explanation of why this is problematic..."
    }}
  ]
}}"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"}
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(url, json=payload)
        if res.status_code != 200:
            raise Exception(f"Gemini API Error {res.status_code}: {res.text}")
        
        data = res.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(raw_text)
