import base64
import json
import math
import os
import re
from datetime import datetime, timedelta
from typing import Any

import httpx
from sqlmodel import Session, select

from app.config import elapsed_logical_days, get_local_date_string, now_local, settings
from app.models.daily_entry import DailyEntry
from app.models.study import StudyAttempt, StudyItem, StudyQuestion

# FSRS v4.5 / v5 Default Canonical Parameters
FSRS_WEIGHTS = [
    0.40255,
    1.18385,
    3.173,
    15.69105,  # w0..w3: Initial stability for ratings 1, 2, 3, 4
    7.1949,
    0.5345,
    0.9388,
    0.0242,  # w4..w7: Difficulty parameters
    1.6247,
    0.1384,
    1.0125,  # w8..w10: Stability recall expansion
    2.1154,
    0.0848,
    0.3424,
    0.2831,  # w11..w14: Stability forgetting/lapse
    0.2863,
    2.2478,  # w15..w16: Hard penalty and Easy bonus
]
TARGET_RETENTION = 0.90  # 90% target retention rate


def add_days_to_date_string(date_str: str, days: int) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d") + timedelta(days=days)
    return dt.strftime("%Y-%m-%d")


def score_to_fsrs_grade(score: float) -> int:
    """
    Strictly calibrated academic mapping:
    - Grade 1 (Again / Lapse): Score < 5.0 (Incomplete / skipped algebraic identities / incorrect math / vague buzzwords)
    - Grade 2 (Hard): Score 5.0 - 6.9 (Noticeable algebraic gaps or missing intermediate steps)
    - Grade 3 (Good): Score 7.0 - 8.4 (Solid mathematical accuracy and clear derivations)
    - Grade 4 (Easy): Score 8.5 - 10.0 (Flawless, publication-grade master proof)
    """
    s = float(score)
    if s < 5.0:
        return 1
    if s < 7.0:
        return 2
    if s < 8.5:
        return 3
    return 4


def compute_retrievability(elapsed_days: float, stability: float) -> float:
    """
    FSRS Power-Law Retrievability equation:
    R(t, S) = (1 + t / (9 * S))^(-1)
    """
    if stability <= 0:
        return 0.0
    t = max(0.0, float(elapsed_days))
    return round(1.0 / (1.0 + (t / (9.0 * stability))), 4)


def compute_interval_for_retrievability(stability: float, desired_retention: float = TARGET_RETENTION) -> int:
    """
    Calculates next review interval in days given Stability and Target Retention:
    I = round(9 * S * (1/r - 1))
    """
    if stability <= 0:
        return 1
    interval = 9.0 * stability * ((1.0 / desired_retention) - 1.0)
    return max(1, round(interval))


def compute_next_fsrs(
    current_stability: float,
    current_difficulty: float,
    current_reps: int,
    current_lapses: int,
    current_state: int,
    last_reviewed_at: str | None,
    grade: int,
    today_str: str,
) -> dict[str, Any]:
    """
    Canonical FSRS (Free Spaced Repetition Scheduler - DSR Model) transition.
    Calculates next Difficulty (D), Stability (S), Retrievability (R), and Optimal Interval.
    """
    w = FSRS_WEIGHTS
    grade = max(1, min(4, int(grade)))

    elapsed_days = elapsed_logical_days(last_reviewed_at, today_str)

    is_new = current_reps == 0 or current_stability <= 0

    if is_new:
        # Initial review for a new item
        init_stability = w[grade - 1]
        raw_diff = w[4] - math.exp(w[5] * (grade - 1)) + 1.0
        init_difficulty = max(1.0, min(10.0, round(raw_diff, 2)))

        next_stability = round(init_stability, 2)
        next_difficulty = init_difficulty
        next_reps = 1
        next_lapses = 1 if grade == 1 else 0
        next_state = 2 if grade >= 3 else 1  # 2 = Review, 1 = Learning
        next_retrievability = 1.0
    else:
        # Subsequent review (Existing card)
        S = max(0.1, float(current_stability))
        D = max(1.0, min(10.0, float(current_difficulty)))

        # 1. Current Retrievability before review
        current_R = compute_retrievability(elapsed_days, S)
        next_retrievability = current_R

        # 2. Next Difficulty with Mean Reversion
        delta_d = -w[6] * (grade - 3)
        raw_d = D + delta_d
        d0_good = w[4] - math.exp(w[5] * 2) + 1.0  # D0 for Good rating
        next_d = w[7] * d0_good + (1.0 - w[7]) * raw_d
        next_difficulty = max(1.0, min(10.0, round(next_d, 2)))

        # 3. Next Stability
        if grade == 1:
            # Lapse / Forgetting (Rating 1: Again)
            s_lapse = (
                w[11]
                * (next_difficulty ** (-w[12]))
                * (((S + 1.0) ** w[13]) - 1.0)
                * math.exp(w[14] * (1.0 - current_R))
            )
            next_stability = max(0.1, round(min(s_lapse, S), 2))
            next_lapses = current_lapses + 1
            next_state = 3  # Relearning
        else:
            # Recall Success (Rating 2: Hard, 3: Good, 4: Easy)
            hard_penalty = w[15] if grade == 2 else 1.0
            easy_bonus = w[16] if grade == 4 else 1.0

            s_recall = S * (
                1.0
                + math.exp(w[8])
                * (11.0 - next_difficulty)
                * (S ** (-w[9]))
                * (math.exp(w[10] * (1.0 - current_R)) - 1.0)
                * hard_penalty
                * easy_bonus
            )

            if grade >= 3:
                next_stability = max(round(S, 2), round(s_recall, 2))
            else:
                next_stability = max(0.1, round(s_recall, 2))

            next_lapses = current_lapses
            next_state = 2  # Review

        next_reps = current_reps + 1

    # 4. Next Interval targeting 90% retention
    next_interval = compute_interval_for_retrievability(next_stability, TARGET_RETENTION)
    next_due = add_days_to_date_string(today_str, next_interval)

    # Legacy SM-2 compatibility ease factor approximation
    approx_ef = max(1.3, min(3.0, round(3.5 - 0.2 * next_difficulty, 2)))

    return {
        "stability": next_stability,
        "fsrsDifficulty": next_difficulty,
        "repetitions": next_reps,
        "lapses": next_lapses,
        "state": next_state,
        "intervalDays": next_interval,
        "dueDate": next_due,
        "retrievability": next_retrievability,
        "easeFactor": approx_ef,
        "grade": grade,
    }


# Legacy SM-2 aliases for backward compatibility
def score_to_sm2_quality(score: float) -> int:
    g = score_to_fsrs_grade(score)
    return 5 if g == 4 else 4 if g == 3 else 2 if g == 2 else 0


def compute_next_sm2(
    current_ef: float, current_reps: int, current_interval: int, quality: int, today_str: str
) -> tuple[float, int, int, str]:
    # Bridges to FSRS
    grade = 4 if quality >= 5 else 3 if quality >= 4 else 2 if quality >= 2 else 1
    res = compute_next_fsrs(
        current_stability=float(current_interval),
        current_difficulty=5.0,
        current_reps=current_reps,
        current_lapses=0,
        current_state=2,
        last_reviewed_at=None,
        grade=grade,
        today_str=today_str,
    )
    return res["easeFactor"], res["repetitions"], res["intervalDays"], res["dueDate"]


def is_practice_satisfied(entry: DailyEntry | None, due_count: int, min_required: int) -> bool:
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


def clean_and_parse_gemini_json(raw_text: str) -> dict[str, Any]:
    """Safely parses JSON from Gemini responses, repairing unescaped LaTeX backslashes if present."""
    text = raw_text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    # Attempt 1: Direct JSON parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # Attempt 2: Escape invalid backslashes (anything not \", \\, \/, \b, \f, \n, \r, \t, \u)
    repaired_bs = re.sub(r"\\(?![/\"\\bfnrtu])", r"\\\\", text)
    # Handle \u followed by non-hex digits (e.g. \underline, \unit, \upsilon)
    repaired_u = re.sub(r"\\u(?![0-9a-fA-F]{4})", r"\\\\u", repaired_bs)
    try:
        return json.loads(repaired_u, strict=False)
    except Exception:
        pass

    # Attempt 3: Replace all backslashes except legitimate \"
    repaired_all_bs = text.replace("\\", "\\\\").replace('\\\\"', '\\"')
    try:
        return json.loads(repaired_all_bs, strict=False)
    except Exception:
        pass

    # Attempt 4: Fallback regex extractor for structured fields
    result: dict[str, Any] = {}
    score_match = re.search(r"\"score\"\s*:\s*([0-9.]+)", text)
    if score_match:
        result["score"] = float(score_match.group(1))

    critique_match = re.search(r"\"critique\"\s*:\s*\"(.*?)(?<!\\)\"", text, re.DOTALL)
    if critique_match:
        result["critique"] = critique_match.group(1)

    ideal_match = re.search(r"\"idealAnswer\"\s*:\s*\"(.*?)(?<!\\)\"", text, re.DOTALL)
    if ideal_match:
        result["idealAnswer"] = ideal_match.group(1)

    if result and ("score" in result or "idealAnswer" in result):
        return result

    # Final attempt: re-raise or parse with best effort
    return json.loads(repaired_u, strict=False)


def extract_images_for_gemini(answer_markdown: str, uploads_dir: str | None = None) -> list[dict[str, Any]]:
    """
    Extracts image data (base64 data URLs or local files in uploads/) from answer_markdown
    and returns Gemini inlineData parts.
    """
    if not answer_markdown:
        return []

    if uploads_dir is None:
        uploads_dir = os.path.join(os.getcwd(), "uploads")

    # Match markdown images ![alt](url) and HTML <img src="url">
    md_matches = re.findall(r"!\[.*?\]\((.+?)\)", answer_markdown)
    html_matches = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', answer_markdown, re.IGNORECASE)
    all_sources = list(dict.fromkeys(md_matches + html_matches))  # preserve order & deduplicate

    parts = []
    for src in all_sources:
        src = src.strip()
        # Case 1: Base64 data URL
        data_url_match = re.match(r"^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$", src, re.DOTALL)
        if data_url_match:
            sub_type = data_url_match.group(1).lower()
            mime_type = "image/jpeg" if sub_type in ("jpg", "jpeg") else f"image/{sub_type}"
            b64_str = data_url_match.group(2).strip()
            parts.append({"inlineData": {"mimeType": mime_type, "data": b64_str}})
            continue

        # Case 2: Local uploaded file path (e.g. /uploads/filename.jpg or http://.../uploads/filename.jpg)
        if "uploads/" in src:
            # basename keeps a crafted src like /uploads/../.env from reaching
            # outside the uploads dir and being shipped to Gemini
            filename = os.path.basename(src.split("uploads/")[-1].split("?")[0].strip())
            if not filename:
                continue
            filepath = os.path.join(uploads_dir, filename)
            if os.path.isfile(filepath):
                try:
                    ext = os.path.splitext(filename)[1].lower().lstrip(".")
                    mime_type = (
                        "image/jpeg"
                        if ext in ("jpg", "jpeg")
                        else f"image/{ext}"
                        if ext in ("png", "webp", "gif")
                        else "image/jpeg"
                    )
                    with open(filepath, "rb") as f:
                        b64_str = base64.b64encode(f.read()).decode("utf-8")
                    parts.append({"inlineData": {"mimeType": mime_type, "data": b64_str}})
                except Exception as e:
                    print(f"[practice] Error loading image {filepath}: {e}")

    return parts


async def evaluate_answer_with_gemini(
    item: StudyItem, question: StudyQuestion, answer_markdown: str
) -> dict[str, Any]:
    api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured in .env")

    # Extract all attached visual diagram/handwriting parts
    image_parts = extract_images_for_gemini(answer_markdown)
    has_images = len(image_parts) > 0

    prompt = f"""You are an expert Theoretical Machine Learning Professor, Principal AI Safety Scientist, and Senior Reviewer.
Your goal is to conduct an accurate, encouraging, and technically rigorous evaluation of the user's active recall submission.

CRITICAL DIRECTIVES:
1. NOTATION & FORMAT AGNOSTICISM (DO NOT REQUIRE FORMAL LATEX PROOFS):
   - The user is NOT required to write formal, line-by-line LaTeX mathematical proofs.
   - Any format is completely acceptable: plain text bullet points, intuitive prose explanations, PyTorch/code shorthand (e.g. `(b, nh, p, dh)`, `(batch, sen_len, d_model)`), ASCII diagrams, or handwritten notes.
   - DO NOT penalize or deduct points for informal syntax, conversational tone, or lack of LaTeX formatting.
   - If the user provides a sound architectural or mechanical walkthrough (e.g. tracing tensor shapes, explaining Pre-LN gradient stability, explaining softmax scaling), reward their genuine technical understanding.
   - If the user has a minor typographical slip in one equation (e.g. typing `d_head` instead of `sqrt(d_head)`) but explains the correct intuition/concept in their text, give them full credit for that concept.

2. FAIR TECHNICAL & CAUSAL ASSESSMENT:
   - Zero empty sycophancy, but evaluate fairly based on actual understanding.
   - Focus on correctness: Did the user correctly capture the core ideas, transformations, or causal mechanisms ("why" things exist, e.g. gradient highways, variance scaling, autoregressive masks)?
   - Only penalize if an answer is fundamentally wrong, contains severe factual misconceptions, or leaves out major parts of what was asked.

EXPLICIT EVALUATION CRITERIA:
1. Concept & Transformation Accuracy:
   - Are the mechanics, transformations, or equations sound and logically ordered?
   - Tensor dimensions (whether in LaTeX or shorthand like `(b, p, d_model)`) should accurately track through layers.
2. Causal Depth & Intuition ("Why" vs "What"):
   - Did the user explain the causal reasons behind design choices (e.g. why Pre-LN over Post-LN, why causal masking is needed, why scaling by $\\sqrt{{d_k}}$ prevents softmax saturation, why multi-head attention learns distinct subspaces)?
3. Completeness:
   - Did the user address the core parts of the question prompt?

CALIBRATED SCORING SCALE:
- 8.5 – 10.0 (Mastery): Thorough, accurate explanation of all major mechanics and clear causal reasons.
- 7.0 – 8.4 (Solid / Proficient): Strong understanding of all core components and mechanisms; minor non-critical omissions or informal shorthand that does not impair technical validity.
- 5.0 – 6.9 (Developing): Captures some concepts but misses major architectural steps or key causal reasons.
- 0.0 – 4.9 (Incorrect / Misconception): Factually or mathematically wrong, or superficial buzzwords without real mechanical understanding.

STUDY ITEM: "{item.title}" ({item.type.upper()})
{f'ITEM NOTES / CONTEXT: "{item.notes}"' if item.notes else ""}
{f"PAPER METADATA: {json.dumps(item.paper)}" if item.paper else ""}

QUESTION PROMPT:
{question.prompt}

USER'S SUBMITTED ANSWER:
{answer_markdown}

{
        f'''VISUAL ATTACHMENTS DETECTED:
The user has attached {len(image_parts)} visual image(s) (handwritten proofs, whiteboard derivations, diagrams).
You MUST rigorously OCR, transcribe, and mathematically verify all equations, graphs, tensor traces, and steps within the image(s) as an integral part of their answer.'''
        if has_images
        else ""
    }

OUTPUT FORMAT:
Respond with strict JSON matching this exact structure:
{{
  "score": 4.5,
  "rubric": {{
    "correctness": {{ "score": 4, "feedback": "Uncompromising audit of algebraic correctness, validity, and exact identities used..." }},
    "technicalRigor": {{ "score": 4, "feedback": "Evaluation of intermediate algebraic steps, skipped leaps, and tensor dimensions..." }},
    "intuitionDepth": {{ "score": 5, "feedback": "Evaluation of causal mechanisms, failure modes prevented, and 'why' depth..." }},
    "clarity": {{ "score": 6, "feedback": "Evaluation of mathematical precision, conciseness, and rigor." }}
  }},
  "critique": "Uncompromising, direct, rigorous academic critique exposing every single flaw, hand-waving leap, omitted algebraic step, and exact error...",
  "flaggedIssues": [
    {{
      "type": "unsupported-leap",
      "quote": "exact phrase from user text or diagram step",
      "note": "precise mathematical breakdown of why this step is incomplete or what exact algebraic identity was skipped"
    }}
  ],
  "idealAnswer": "Exemplary, definitive gold-standard master proof and derivation written in beautiful LaTeX ($...$ and $$...$$) and Markdown. Provide formal problem formulation, rigorous line-by-line derivations with algebraic justifications for every step, causal mechanism breakdown, failure modes, edge cases, and high-yield takeaways.",
  "keyImprovements": [
    "Concrete, high-yield technical takeaway 1 on what exact derivation step was missing...",
    "Concrete, high-yield technical takeaway 2 on how to elevate the proof to publication-ready rigor..."
  ]
}}"""

    # Build Gemini multimodal parts (text prompt + all extracted image inlineData parts)
    contents_parts: list[dict[str, Any]] = [{"text": prompt}]
    for img_part in image_parts:
        contents_parts.append(img_part)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": contents_parts}],
        "generationConfig": {"responseMimeType": "application/json"},
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        res = await client.post(url, json=payload)
        if res.status_code != 200:
            raise Exception(f"Gemini API Error {res.status_code}: {res.text}")

        data = res.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        return clean_and_parse_gemini_json(raw_text)


async def generate_model_solution_with_gemini(item: StudyItem, question: StudyQuestion) -> dict[str, Any]:
    """Generates an exemplary model solution on demand for active-recall study mode."""
    api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured in .env")

    prompt = f"""You are a world-class Theoretical ML Professor and Principal Research Scientist.
Provide an exemplary, definitive master model solution and mathematical proof for this active-recall practice question.

STANDARDS FOR THE MASTER SOLUTION:
- Publication-grade mathematical rigor using clean LaTeX formatting ($...$ and $$...$$).
- Every single algebraic step must be explicitly derived without skipping intermediate identities (e.g. log-derivative trick, score function, change of variables, expectation expansions).
- State all assumptions, notation, tensor dimensions, and boundary conditions upfront.
- Provide a deep causal breakdown: explain WHY each mathematical term exists and what concrete failure mode it prevents.
- Highlight common misconceptions, subtle traps, and pitfalls that students and researchers frequently make.
- Include 3-5 high-yield key takeaways formatted for rapid spaced-repetition active recall.

STUDY ITEM: "{item.title}" ({item.type.upper()})
{f'ITEM NOTES: "{item.notes}"' if item.notes else ""}
{f"PAPER METADATA: {json.dumps(item.paper)}" if item.paper else ""}

QUESTION PROMPT:
{question.prompt}

Respond with strict JSON matching this structure:
{{
  "idealAnswer": "Comprehensive, definitive master solution with complete LaTeX derivations ($...$, $$...$$), structured headings, intuition, and edge cases...",
  "keyTakeaways": [
    "High-yield takeaway 1...",
    "High-yield takeaway 2...",
    "High-yield takeaway 3..."
  ]
}}"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        res = await client.post(url, json=payload)
        if res.status_code != 200:
            raise Exception(f"Gemini API Error {res.status_code}: {res.text}")
        data = res.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        return clean_and_parse_gemini_json(raw_text)


async def decompose_question_with_gemini(item: StudyItem, question: StudyQuestion) -> list[dict[str, Any]]:
    """
    Decomposes a large, monolithic, or multi-part study question into 2 to 4 atomic, bite-sized
    active recall questions that take 1-2 minutes each to answer.
    Each atomic question comes with its own pre-computed modelSolution and keyTakeaways.
    """
    api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured in .env")

    prompt = f"""You are a master educator and Principal ML Researcher specializing in high-yield deliberate practice and spaced repetition.
The user has a long, monolithic active-recall question that takes 5+ minutes to write and causes burnout.

YOUR GOAL:
Break down this large question into 2 to 4 independent, highly focused, ATOMIC questions.
Each atomic question MUST:
1. Target a single core concept, equation, mechanism, tensor transformation, or theorem (e.g. "What is the shape transformation of Query/Key/Value in MHA?", "Why does Pre-LN prevent vanishing gradients compared to Post-LN?", "Derive the score function identity in policy gradients").
2. Take a human student approximately 1 to 2 minutes to write / sketch.
3. Be accompanied by a complete, publication-grade master solution in LaTeX ($...$ and $$...$$) and 2 key takeaways so it can be stored directly in SQLite forever.

PARENT TOPIC: "{item.title}" ({item.type.upper()})
{f'TOPIC NOTES: "{item.notes}"' if item.notes else ""}

ORIGINAL MONOLITHIC QUESTION:
{question.prompt}

Respond with strict JSON matching this exact structure:
{{
  "atomicQuestions": [
    {{
      "prompt": "Targeted, single-concept prompt that can be answered in 1-2 minutes...",
      "difficulty": "Medium",
      "answerTemplate": "{question.answerTemplate or "topic"}",
      "idealAnswer": "Complete, pristine LaTeX derivation and explanation for this specific atomic question...",
      "keyTakeaways": [
        "Takeaway 1...",
        "Takeaway 2..."
      ]
    }}
  ]
}}"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        res = await client.post(url, json=payload)
        if res.status_code != 200:
            raise Exception(f"Gemini API Error {res.status_code}: {res.text}")
        data = res.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = clean_and_parse_gemini_json(raw_text)
        return parsed.get("atomicQuestions", [])


# -----------------------------------------------------------------------------
# Domain Business Logic: Due Queue Pacing, Performance Analytics, Attempts
# -----------------------------------------------------------------------------

SECTION_RANK = {
    "Section: Foundations": 0,
    "Section: Value Optimisation": 1,
    "Section: Policy Optimisation": 2,
    "Section: RLHF / RLAIF / RLVR": 3,
    "Section: Papers": 4,
}


def get_due_practice_queue(
    session: Session, today: str | None = None, config: Any | None = None
) -> dict[str, Any]:
    """
    Computes the paced due queue grouped by topic ladder ('one box per topic').
    - Real-time retrievability R(t, S) is computed for all due cards.
    - In-progress topics (any prior attempt history) are always shown in full.
    - New topics (never attempted) are capped at practiceNewCardsPerDay and sorted in syllabus order.
    """
    from app.pillars.status import get_effective_config

    if today is None:
        today = get_local_date_string()
    if config is None:
        config = get_effective_config(session)

    daily_target = getattr(config, "practiceDailyTarget", 5) or 5
    new_topics_per_day = getattr(config, "practiceNewCardsPerDay", 1) or 1
    review_topics_per_day = getattr(config, "practiceReviewTopicsPerDay", 1) or 1

    # Fetch today's entry to determine completion status
    entry = session.exec(select(DailyEntry).where(DailyEntry.date == today)).first()
    completed_ids = (entry.practiceCompletedQuestionIds or []) if entry else []
    completed_today = len(completed_ids)

    all_active_count = len(session.exec(select(StudyQuestion.id).where(StudyQuestion.active == True)).all())

    questions = session.exec(
        select(StudyQuestion).where(StudyQuestion.active == True, StudyQuestion.dueDate <= today)
    ).all()

    items_map = {it.id: it for it in session.exec(select(StudyItem)).all()}

    due_list = []
    for q in questions:
        item = items_map.get(q.itemId)

        elapsed = elapsed_logical_days(q.lastReviewedAt, today)
        r_current = (
            compute_retrievability(elapsed, q.stability)
            if (q.stability and q.stability > 0)
            else (1.0 if (q.repetitions or 0) > 0 else 0.0)
        )

        is_completed_today = q.id in completed_ids

        due_list.append(
            {
                "id": q.id,
                "itemId": q.itemId,
                "itemType": q.itemType,
                "prompt": q.prompt,
                "answerTemplate": q.answerTemplate,
                "difficulty": q.difficulty,
                "source": q.source,
                "active": q.active,
                "order": q.order or 0,
                "completedToday": is_completed_today,
                "fsrs": {
                    "stability": q.stability or 0.0,
                    "difficulty": q.fsrsDifficulty or 5.0,
                    "retrievability": r_current,
                    "lapses": q.lapses or 0,
                    "state": q.state or 0,
                    "repetitions": q.repetitions or 0,
                    "intervalDays": q.intervalDays or 0,
                    "dueDate": q.dueDate,
                    "lastReviewedAt": q.lastReviewedAt,
                },
                "sm2": {
                    "easeFactor": q.easeFactor or 2.5,
                    "repetitions": q.repetitions or 0,
                    "intervalDays": q.intervalDays or 0,
                    "dueDate": q.dueDate,
                    "lastReviewedAt": q.lastReviewedAt,
                },
                "itemTitle": item.title if item else "Unknown",
                "itemTags": item.tags if item else [],
                "itemNotes": item.notes if item else "",
                "itemPaper": item.paper if item else None,
                "hasModelSolution": bool(q.modelSolution),
                "modelSolution": q.modelSolution,
                "keyTakeaways": q.keyTakeaways or [],
            }
        )

    # Sort due list:
    # 1. Uncompleted today first
    # 2. Previously reviewed cards (repetitions > 0) by lowest Retrievability R first
    # 3. New cards (repetitions == 0)
    due_list.sort(
        key=lambda x: (
            1 if x["completedToday"] else 0,
            0 if x["fsrs"]["repetitions"] > 0 else 1,
            x["fsrs"]["retrievability"],
            x["order"],
        )
    )

    # A topic counts as "in progress" if it has ANY real attempt history at all
    started_item_ids = {row for row in session.exec(select(StudyAttempt.itemId).distinct()).all()}

    groups_map: dict[str, dict[str, Any]] = {}
    group_order: list[str] = []
    for q in due_list:
        iid = q["itemId"]
        if iid not in groups_map:
            groups_map[iid] = {
                "itemId": iid,
                "itemTitle": q["itemTitle"],
                "itemTags": q["itemTags"],
                "itemType": q["itemType"],
                "answerTemplate": q["answerTemplate"],
                "questions": [],
            }
            group_order.append(iid)
        groups_map[iid]["questions"].append(q)

    review_groups = []
    new_groups = []
    for iid in group_order:
        g = groups_map[iid]
        g["questions"].sort(key=lambda x: x["order"])
        g["completedTodayCount"] = sum(1 for x in g["questions"] if x["completedToday"])
        g["dueCount"] = len(g["questions"])
        is_review = iid in started_item_ids
        g["isReview"] = is_review
        if is_review:
            reps_now = [x["fsrs"]["retrievability"] for x in g["questions"] if x["fsrs"]["repetitions"] > 0]
            g["mostUrgentRetrievability"] = min(reps_now) if reps_now else 0.0
            review_groups.append(g)
        else:
            g["sectionTag"] = next((t for t in (g["itemTags"] or []) if t.startswith("Section:")), None)
            new_groups.append(g)

    # Most urgent (lowest retrievability) reviews first -- only the top
    # `review_topics_per_day` in-progress topics are surfaced today, same
    # pacing philosophy as new topics. The rest stay queued; nothing here
    # touches actual FSRS due dates, only which groups are shown.
    review_groups.sort(key=lambda g: g["mostUrgentRetrievability"])
    new_groups.sort(key=lambda g: (SECTION_RANK.get(g["sectionTag"], 5), g["itemTitle"]))

    shown_review_groups = review_groups[:review_topics_per_day]
    queued_review_groups = review_groups[review_topics_per_day:]
    shown_new_groups = new_groups[:new_topics_per_day]
    queued_new_groups = new_groups[new_topics_per_day:]

    due_groups = shown_review_groups + shown_new_groups
    paced_due_list = [q for g in due_groups for q in g["questions"]]

    topics_target_today = review_topics_per_day + new_topics_per_day
    topics_shown_today = len(due_groups)
    topics_completed_today = sum(
        1 for g in due_groups if g["dueCount"] > 0 and g["completedTodayCount"] >= g["dueCount"]
    )
    # Vacuously true when nothing is shown today (fully caught up / bank exhausted).
    target_met = topics_completed_today >= topics_shown_today

    return {
        "today": today,
        "dueCount": len(paced_due_list),
        "totalDueBacklog": len(due_list),
        "queuedNewTopicsCount": len(queued_new_groups),
        "queuedReviewTopicsCount": len(queued_review_groups),
        "newTopicsPerDay": new_topics_per_day,
        "reviewTopicsPerDay": review_topics_per_day,
        "topicsTargetToday": topics_target_today,
        "topicsShownToday": topics_shown_today,
        "topicsCompletedToday": topics_completed_today,
        "dailyTarget": daily_target,
        "completedToday": completed_today,
        "targetMet": target_met,
        "totalBankCount": all_active_count,
        "dueQuestions": paced_due_list,
        "dueGroups": due_groups,
    }


def record_practice_attempt(
    session: Session,
    question: StudyQuestion,
    item: StudyItem,
    answer_markdown: str,
    eval_res: dict[str, Any],
    today: str | None = None,
) -> dict[str, Any]:
    """
    Records an evaluation attempt, updates FSRS & SM-2 memory parameters,
    caches model solutions if needed, and marks DailyEntry practice progress.
    """
    from app.pillars.status import get_effective_config, get_or_create_today_entry

    if today is None:
        today = get_local_date_string()

    score = max(0.0, min(10.0, float(eval_res.get("score", 0.0))))
    grade = score_to_fsrs_grade(score)

    # Compute new FSRS state
    fsrs_res = compute_next_fsrs(
        current_stability=question.stability,
        current_difficulty=question.fsrsDifficulty or 5.0,
        current_reps=question.repetitions,
        current_lapses=question.lapses or 0,
        current_state=question.state or 0,
        last_reviewed_at=question.lastReviewedAt,
        grade=grade,
        today_str=today,
    )

    question.stability = fsrs_res["stability"]
    question.fsrsDifficulty = fsrs_res["fsrsDifficulty"]
    question.repetitions = fsrs_res["repetitions"]
    question.lapses = fsrs_res["lapses"]
    question.state = fsrs_res["state"]
    question.intervalDays = fsrs_res["intervalDays"]
    question.dueDate = fsrs_res["dueDate"]
    question.easeFactor = fsrs_res["easeFactor"]
    question.lastReviewedAt = now_local().isoformat()

    # Cache the model solution forever. keyTakeaways is deliberately not filled
    # from keyImprovements -- those critique *this* answer, whereas keyTakeaways
    # is served as the question's general answer key by /model-solution.
    if not question.modelSolution and eval_res.get("idealAnswer"):
        question.modelSolution = eval_res.get("idealAnswer")
    session.add(question)

    # Save Attempt log
    attempt_id = f"att_{int(now_local().timestamp() * 1000)}"
    attempt = StudyAttempt(
        id=attempt_id,
        questionId=question.id,
        itemId=question.itemId,
        answerMarkdown=answer_markdown,
        evaluation={
            "score": score,
            "grade": grade,
            "fsrs": fsrs_res,
            "quality": score_to_sm2_quality(score),
            "rubric": eval_res.get("rubric", {}),
            "critique": eval_res.get("critique", ""),
            "flaggedIssues": eval_res.get("flaggedIssues", []),
            "idealAnswer": eval_res.get("idealAnswer", ""),
            "keyImprovements": eval_res.get("keyImprovements", []),
        },
        geminiModel="gemini-2.5-flash",
    )
    session.add(attempt)

    # Update Daily Entry
    entry = get_or_create_today_entry(session, today)
    answered_ids = list(entry.practiceCompletedQuestionIds or [])
    if question.id not in answered_ids:
        answered_ids.append(question.id)
    entry.practiceCompletedQuestionIds = answered_ids
    entry.practiceCompletedCount = len(answered_ids)

    # Calculate remaining due
    due_qs = session.exec(
        select(StudyQuestion).where(StudyQuestion.active == True, StudyQuestion.dueDate <= today)
    ).all()
    entry.practiceDueCount = len(due_qs)

    config = get_effective_config(session)
    entry.practiceCompleted = is_practice_satisfied(entry, len(due_qs), config.practiceMinDueToUnlock)
    session.add(entry)
    session.commit()
    session.refresh(attempt)
    session.refresh(question)

    return {
        "success": True,
        "attempt": attempt.model_dump(),
        "updatedQuestion": question.model_dump(),
        "item": item.model_dump(),
        "fsrs": fsrs_res,
        "sm2": {
            "easeFactor": question.easeFactor,
            "repetitions": question.repetitions,
            "intervalDays": question.intervalDays,
            "dueDate": question.dueDate,
            "lastReviewedAt": question.lastReviewedAt,
        },
        "practiceCompletedToday": entry.practiceCompleted,
        "remainingDueCount": entry.practiceDueCount,
        "distinctCompletedToday": entry.practiceCompletedCount,
    }


def get_performance_analytics(session: Session, today_str: str | None = None) -> dict[str, Any]:
    """
    Computes overall, topic-level, and question-level FSRS performance & mastery metrics.
    """
    if today_str is None:
        today_str = get_local_date_string()

    # Only the three columns the metrics need. answerMarkdown is skipped on
    # purpose: it holds the full written answer including inlined base64
    # diagrams, and loading every one of them just to count scores is the
    # single heaviest thing this endpoint could do.
    all_attempts = session.exec(
        select(StudyAttempt.questionId, StudyAttempt.evaluation, StudyAttempt.submittedAt).order_by(
            StudyAttempt.submittedAt.asc()
        )
    ).all()
    all_questions = session.exec(select(StudyQuestion)).all()
    all_items = session.exec(select(StudyItem)).all()

    items_map = {it.id: it for it in all_items}

    # Group attempts by question
    question_attempts: dict[str, list[Any]] = {}
    for att in all_attempts:
        question_attempts.setdefault(att.questionId, []).append(att)

    question_metrics = []
    for q in all_questions:
        if not q.active and q.id not in question_attempts:
            continue
        atts = question_attempts.get(q.id, [])
        scores = [
            float(a.evaluation.get("score", 0.0)) for a in atts if a.evaluation and "score" in a.evaluation
        ]
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
        latest_score = scores[-1] if scores else None

        # Mastery Status based on FSRS stability and academic score
        if not scores:
            status_tier = "Not Started"
        elif avg_score >= 8.5 and (latest_score is not None and latest_score >= 8.0):
            status_tier = "Mastered"
        elif avg_score >= 7.0:
            status_tier = "Proficient"
        elif avg_score >= 5.0:
            status_tier = "Developing"
        else:
            status_tier = "Needs Work"

        elapsed = elapsed_logical_days(q.lastReviewedAt, today_str)
        r_current = (
            compute_retrievability(elapsed, q.stability)
            if q.stability > 0
            else (1.0 if q.repetitions > 0 else 0.0)
        )

        item = items_map.get(q.itemId)
        question_metrics.append(
            {
                "questionId": q.id,
                "prompt": q.prompt,
                "itemId": q.itemId,
                "itemTitle": item.title if item else "Unknown",
                "itemType": q.itemType,
                "difficulty": q.difficulty,
                "source": q.source,
                "active": q.active,
                "totalAttempts": len(atts),
                "scores": scores,
                "recentScores": scores[-5:] if scores else [],
                "averageScore": avg_score,
                "latestScore": latest_score,
                "statusTier": status_tier,
                "fsrs": {
                    "stability": q.stability,
                    "difficulty": q.fsrsDifficulty or 5.0,
                    "retrievability": r_current,
                    "lapses": q.lapses or 0,
                    "state": q.state or 0,
                    "repetitions": q.repetitions,
                    "intervalDays": q.intervalDays,
                    "dueDate": q.dueDate,
                    "lastReviewedAt": q.lastReviewedAt,
                },
                "easeFactor": q.easeFactor,
                "repetitions": q.repetitions,
                "intervalDays": q.intervalDays,
                "dueDate": q.dueDate,
                "lastAttemptedAt": atts[-1].submittedAt if atts else None,
                "hasModelSolution": bool(q.modelSolution),
            }
        )

    # Overall metrics
    all_scores = [
        float(a.evaluation.get("score", 0.0))
        for a in all_attempts
        if a.evaluation and "score" in a.evaluation
    ]
    overall_avg = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0.0
    mastered_count = sum(1 for qm in question_metrics if qm["statusTier"] == "Mastered")
    proficient_count = sum(1 for qm in question_metrics if qm["statusTier"] == "Proficient")
    developing_count = sum(1 for qm in question_metrics if qm["statusTier"] == "Developing")
    needs_work_count = sum(1 for qm in question_metrics if qm["statusTier"] == "Needs Work")

    stabilities = [
        qm["fsrs"]["stability"] for qm in question_metrics if qm["active"] and qm["fsrs"]["stability"] > 0
    ]
    avg_stability = round(sum(stabilities) / len(stabilities), 1) if stabilities else 0.0

    # Topic level summaries
    topic_metrics = []
    for it in all_items:
        it_qs = [qm for qm in question_metrics if qm["itemId"] == it.id and qm["active"]]
        it_scores = [s for qm in it_qs for s in qm["scores"]]
        it_avg = round(sum(it_scores) / len(it_scores), 1) if it_scores else 0.0
        it_mastered = sum(1 for qm in it_qs if qm["statusTier"] == "Mastered")
        topic_metrics.append(
            {
                "itemId": it.id,
                "title": it.title,
                "type": it.type,
                "tags": it.tags or [],
                "questionCount": len(it_qs),
                "attemptCount": len(it_scores),
                "averageScore": it_avg,
                "masteredCount": it_mastered,
                "masteryRate": round((it_mastered / len(it_qs) * 100), 1) if it_qs else 0.0,
            }
        )

    return {
        "summary": {
            "totalQuestions": len([q for q in all_questions if q.active]),
            "totalAttempts": len(all_attempts),
            "overallAverageScore": overall_avg,
            "averageStabilityDays": avg_stability,
            "algorithm": "FSRS-5 (DSR Model)",
            "masteredCount": mastered_count,
            "proficientCount": proficient_count,
            "developingCount": developing_count,
            "needsWorkCount": needs_work_count,
        },
        "questions": question_metrics,
        "topics": topic_metrics,
    }


def balance_backlog_schedule(
    session: Session, cards_per_day: int = 5, today: str | None = None
) -> dict[str, Any]:
    """
    Distributes unreviewed cards across future days to balance study volume.
    """
    if today is None:
        today = get_local_date_string()

    all_questions = session.exec(select(StudyQuestion).where(StudyQuestion.active == True)).all()
    if not all_questions:
        return {"success": True, "message": "No active questions found in Study Bank.", "staggeredCount": 0}

    reviewed_cards = [q for q in all_questions if (q.repetitions or 0) > 0]
    unreviewed_cards = [q for q in all_questions if (q.repetitions or 0) == 0]

    unreviewed_cards.sort(
        key=lambda q: (q.itemId, 0 if q.difficulty == "Easy" else 1 if q.difficulty == "Medium" else 2)
    )

    day_offset = 0
    reviewed_due_today = [q for q in reviewed_cards if q.dueDate <= today]
    assigned_today = len(reviewed_due_today)

    staggered_count = 0
    for q in unreviewed_cards:
        if assigned_today >= cards_per_day:
            day_offset += 1
            assigned_today = 0

        target_date = add_days_to_date_string(today, day_offset)
        q.dueDate = target_date
        session.add(q)
        staggered_count += 1
        assigned_today += 1

    session.commit()
    days_span = day_offset + 1
    return {
        "success": True,
        "message": f"Successfully balanced {staggered_count} cards across {days_span} days ({cards_per_day} cards/day).",
        "staggeredCount": staggered_count,
        "daysSpan": days_span,
        "cardsPerDay": cards_per_day,
        "todayDueCount": min(cards_per_day, len(all_questions)),
    }
