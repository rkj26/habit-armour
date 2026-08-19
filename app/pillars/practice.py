import os
import re
import json
import base64
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional, List
from app.config import settings, get_local_date_string
from app.models.study import StudyItem, StudyQuestion, StudyAttempt
from app.models.daily_entry import DailyEntry

import math

# FSRS v4.5 / v5 Default Canonical Parameters
FSRS_WEIGHTS = [
    0.40255, 1.18385, 3.173, 15.69105, # w0..w3: Initial stability for ratings 1, 2, 3, 4
    7.1949, 0.5345, 0.9388, 0.0242,     # w4..w7: Difficulty parameters
    1.6247, 0.1384, 1.0125,             # w8..w10: Stability recall expansion
    2.1154, 0.0848, 0.3424, 0.2831,     # w11..w14: Stability forgetting/lapse
    0.2863, 2.2478                      # w15..w16: Hard penalty and Easy bonus
]
TARGET_RETENTION = 0.90 # 90% target retention rate

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
    if s < 5.0: return 1
    if s < 7.0: return 2
    if s < 8.5: return 3
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
    last_reviewed_at: Optional[str],
    grade: int,
    today_str: str
) -> Dict[str, Any]:
    """
    Canonical FSRS (Free Spaced Repetition Scheduler - DSR Model) transition.
    Calculates next Difficulty (D), Stability (S), Retrievability (R), and Optimal Interval.
    """
    w = FSRS_WEIGHTS
    grade = max(1, min(4, int(grade)))
    
    # Calculate elapsed days since last review
    if last_reviewed_at:
        try:
            last_dt = datetime.fromisoformat(last_reviewed_at.replace("Z", "+00:00")).date()
            today_dt = datetime.strptime(today_str, "%Y-%m-%d").date()
            elapsed_days = max(0, (today_dt - last_dt).days)
        except Exception:
            elapsed_days = 0
    else:
        elapsed_days = 0

    is_new = (current_reps == 0 or current_stability <= 0)

    if is_new:
        # Initial review for a new item
        init_stability = w[grade - 1]
        raw_diff = w[4] - math.exp(w[5] * (grade - 1)) + 1.0
        init_difficulty = max(1.0, min(10.0, round(raw_diff, 2)))
        
        next_stability = round(init_stability, 2)
        next_difficulty = init_difficulty
        next_reps = 1
        next_lapses = 1 if grade == 1 else 0
        next_state = 2 if grade >= 3 else 1 # 2 = Review, 1 = Learning
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
        d0_good = w[4] - math.exp(w[5] * 2) + 1.0 # D0 for Good rating
        next_d = w[7] * d0_good + (1.0 - w[7]) * raw_d
        next_difficulty = max(1.0, min(10.0, round(next_d, 2)))

        # 3. Next Stability
        if grade == 1:
            # Lapse / Forgetting (Rating 1: Again)
            s_lapse = w[11] * (next_difficulty ** (-w[12])) * (((S + 1.0) ** w[13]) - 1.0) * math.exp(w[14] * (1.0 - current_R))
            next_stability = max(0.1, round(min(s_lapse, S), 2))
            next_lapses = current_lapses + 1
            next_state = 3 # Relearning
        else:
            # Recall Success (Rating 2: Hard, 3: Good, 4: Easy)
            hard_penalty = w[15] if grade == 2 else 1.0
            easy_bonus = w[16] if grade == 4 else 1.0
            
            s_recall = S * (1.0 + math.exp(w[8]) * (11.0 - next_difficulty) * (S ** (-w[9])) * (math.exp(w[10] * (1.0 - current_R)) - 1.0) * hard_penalty * easy_bonus)
            
            if grade >= 3:
                next_stability = max(round(S, 2), round(s_recall, 2))
            else:
                next_stability = max(0.1, round(s_recall, 2))
                
            next_lapses = current_lapses
            next_state = 2 # Review
            
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
        "grade": grade
    }

# Legacy SM-2 aliases for backward compatibility
def score_to_sm2_quality(score: float) -> int:
    g = score_to_fsrs_grade(score)
    return 5 if g == 4 else 4 if g == 3 else 2 if g == 2 else 0

def compute_next_sm2(current_ef: float, current_reps: int, current_interval: int, quality: int, today_str: str) -> Tuple[float, int, int, str]:
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
        today_str=today_str
    )
    return res["easeFactor"], res["repetitions"], res["intervalDays"], res["dueDate"]

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

def clean_and_parse_gemini_json(raw_text: str) -> Dict[str, Any]:
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
    repaired_all_bs = text.replace("\\", "\\\\").replace("\\\\\"", "\\\"")
    try:
        return json.loads(repaired_all_bs, strict=False)
    except Exception:
        pass

    # Attempt 4: Fallback regex extractor for structured fields
    result: Dict[str, Any] = {}
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

def extract_images_for_gemini(answer_markdown: str, uploads_dir: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Extracts image data (base64 data URLs or local files in uploads/) from answer_markdown
    and returns Gemini inlineData parts.
    """
    if not answer_markdown:
        return []

    if uploads_dir is None:
        uploads_dir = os.path.join(os.getcwd(), "uploads")

    # Match markdown images ![alt](url) and HTML <img src="url">
    md_matches = re.findall(r'!\[.*?\]\((.+?)\)', answer_markdown)
    html_matches = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', answer_markdown, re.IGNORECASE)
    all_sources = list(dict.fromkeys(md_matches + html_matches)) # preserve order & deduplicate

    parts = []
    for src in all_sources:
        src = src.strip()
        # Case 1: Base64 data URL
        data_url_match = re.match(r'^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$', src, re.DOTALL)
        if data_url_match:
            sub_type = data_url_match.group(1).lower()
            mime_type = "image/jpeg" if sub_type in ("jpg", "jpeg") else f"image/{sub_type}"
            b64_str = data_url_match.group(2).strip()
            parts.append({
                "inlineData": {
                    "mimeType": mime_type,
                    "data": b64_str
                }
            })
            continue

        # Case 2: Local uploaded file path (e.g. /uploads/filename.jpg or http://.../uploads/filename.jpg)
        if "uploads/" in src:
            filename = src.split("uploads/")[-1].split("?")[0].strip()
            filepath = os.path.join(uploads_dir, filename)
            if os.path.isfile(filepath):
                try:
                    ext = os.path.splitext(filename)[1].lower().lstrip(".")
                    mime_type = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}" if ext in ("png", "webp", "gif") else "image/jpeg"
                    with open(filepath, "rb") as f:
                        b64_str = base64.b64encode(f.read()).decode("utf-8")
                    parts.append({
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": b64_str
                        }
                    })
                except Exception as e:
                    print(f"[practice] Error loading image {filepath}: {e}")

    return parts

async def evaluate_answer_with_gemini(item: StudyItem, question: StudyQuestion, answer_markdown: str) -> Dict[str, Any]:
    api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured in .env")

    # Extract all attached visual diagram/handwriting parts
    image_parts = extract_images_for_gemini(answer_markdown)
    has_images = len(image_parts) > 0

    prompt = f"""You are an exceptionally demanding, uncompromising Theoretical Machine Learning Professor, Principal AI Safety Scientist, and Senior NeurIPS/ICLR Reviewer.
Your goal is to conduct an ultra-rigorous, hyper-critical technical evaluation of the user's active recall submission.

CRITICAL DIRECTIVE: UNCOMPROMISING TECHNICAL RIGOR & ZERO SYCOPHANCY
- ABSOLUTELY ZERO SYCOPHANCY, GRADE INFLATION, OR EMPTY CHEERLEADING.
- NEVER give the user the benefit of the doubt. If a step is unproven, mathematically hand-wavy, ambiguous, or missing crucial intermediate algebraic manipulation, you MUST PENALIZE IT AGGRESSIVELY.
- High-level buzzwords and conceptual summaries without formal mathematical derivations or exact tensor shapes MUST BE SCORED BELOW 5.0.
- Treat every omission as a point of failure. The user is training for elite top-0.1% research mastery where mathematical precision and rigorous correctness are non-negotiable.

EXPLICIT AUDIT CHECKLIST:
1. Mathematical Derivation & Algebraic Integrity:
   - Are all mathematical transitions fully derived step-by-step from fundamental axioms / identities?
   - Did the user skip intermediate identities (e.g. log-derivative trick, expectation linearity, change of variables, product rule, matrix calculus Jacobian rules)? If any intermediate algebraic identity is omitted, penalize at least 2.0–3.0 points.
2. Tensor Dimensionality & Notation:
   - Are tensor dimensions (e.g. $(B, T, d_{{model}})$, $(B, H, T, d_k)$, $(B, T, d_{{ff}})$) explicitly and accurately specified at EVERY intermediate stage?
   - Is matrix / vector notation precise?
3. Causal Depth & Mechanism ("Why" vs "What"):
   - Did the user explain the EXACT mathematical mechanism (e.g. gradient path $\\frac{{\\partial x_L}}{{\\partial x_l}} = I + \\dots$, variance reduction identity, memory bandwidth arithmetic intensity $\\frac{{\\text{{FLOPs}}}}{{\\text{{Bytes}}}}$)?
   - If the user merely states high-level descriptions without underlying causal mechanisms, flag as "hand-wavy" and penalize heavily.
4. Edge Cases, Assumptions & Boundary Conditions:
   - Are critical boundary conditions, masks ($-\\infty$ vs $0$), scaling factors (e.g. $\\frac{{1}}{{\\sqrt{{d_k}}}}$ to prevent softmax gradient saturation), and assumptions explicitly stated?

STRICT CALIBRATED SCORING SCALE (BE HARSH):
- 9.5 – 10.0 (Gold Standard / Perfection): 100% complete, flawless line-by-line derivation with zero skipped steps, explicit tensor dimensions at every operation, and profound causal insight.
- 8.5 – 9.4 (Publication Grade): Fully sound and rigorous mathematical proof; at most one minor notation nitpick or slight formatting omission.
- 7.0 – 8.4 (Flawed / Intermediate Gaps): Mathematically headed in the right direction, but contains noticeable algebraic leaps, minor skipped identities, or incomplete tensor traces.
- 5.0 – 6.9 (Weak / Hand-Wavy): High-level buzzwords, hand-waving conceptual explanations without rigorous algebra, or missing major parts of the prompt.
- 0.0 – 4.9 (Definite Failure / Mathematical Breakdown): Mathematically incorrect, factually wrong, or superficial pseudo-explanations.

STUDY ITEM: "{item.title}" ({item.type.upper()})
{f'ITEM NOTES / CONTEXT: "{item.notes}"' if item.notes else ''}
{f'PAPER METADATA: {json.dumps(item.paper)}' if item.paper else ''}

QUESTION PROMPT:
{question.prompt}

USER'S SUBMITTED ANSWER:
{answer_markdown}

{f'''VISUAL ATTACHMENTS DETECTED:
The user has attached {len(image_parts)} visual image(s) (handwritten proofs, whiteboard derivations, diagrams).
You MUST rigorously OCR, transcribe, and mathematically verify all equations, graphs, tensor traces, and steps within the image(s) as an integral part of their answer.''' if has_images else ''}

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
    contents_parts: List[Dict[str, Any]] = [{"text": prompt}]
    for img_part in image_parts:
        contents_parts.append(img_part)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": contents_parts}],
        "generationConfig": {"responseMimeType": "application/json"}
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        res = await client.post(url, json=payload)
        if res.status_code != 200:
            raise Exception(f"Gemini API Error {res.status_code}: {res.text}")
        
        data = res.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        return clean_and_parse_gemini_json(raw_text)

async def generate_model_solution_with_gemini(item: StudyItem, question: StudyQuestion) -> Dict[str, Any]:
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
{f'ITEM NOTES: "{item.notes}"' if item.notes else ''}
{f'PAPER METADATA: {json.dumps(item.paper)}' if item.paper else ''}

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
        "generationConfig": {"responseMimeType": "application/json"}
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        res = await client.post(url, json=payload)
        if res.status_code != 200:
            raise Exception(f"Gemini API Error {res.status_code}: {res.text}")
        data = res.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        return clean_and_parse_gemini_json(raw_text)

async def decompose_question_with_gemini(item: StudyItem, question: StudyQuestion) -> List[Dict[str, Any]]:
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
{f'TOPIC NOTES: "{item.notes}"' if item.notes else ''}

ORIGINAL MONOLITHIC QUESTION:
{question.prompt}

Respond with strict JSON matching this exact structure:
{{
  "atomicQuestions": [
    {{
      "prompt": "Targeted, single-concept prompt that can be answered in 1-2 minutes...",
      "difficulty": "Medium",
      "answerTemplate": "{question.answerTemplate or 'topic'}",
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
        "generationConfig": {"responseMimeType": "application/json"}
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        res = await client.post(url, json=payload)
        if res.status_code != 200:
            raise Exception(f"Gemini API Error {res.status_code}: {res.text}")
        data = res.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = clean_and_parse_gemini_json(raw_text)
        return parsed.get("atomicQuestions", [])
