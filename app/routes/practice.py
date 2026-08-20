import base64
import json
import os
import re
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.config import elapsed_logical_days, get_local_date_string, settings
from app.database import get_session
from app.models.study import StudyAttempt, StudyItem, StudyQuestion
from app.pillars.practice import (
    balance_backlog_schedule,
    compute_retrievability,
    decompose_question_with_gemini,
    evaluate_answer_with_gemini,
    generate_model_solution_with_gemini,
    get_due_practice_queue,
    get_performance_analytics,
    is_practice_satisfied,
    record_practice_attempt,
)
from app.pillars.status import get_effective_config, get_or_create_today_entry
from app.schemas import (
    AttemptSubmit,
    BalanceBacklogRequest,
    GenerateQuestionsRequest,
    OverrideRequest,
    PracticeImageUpload,
    QuestionCreate,
    QuestionUpdate,
    StudyItemCreate,
    StudyItemUpdate,
)

router = APIRouter(prefix="/api/practice", tags=["Consistent Practice"])
UPLOADS_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)


def _next_order_for_item(session: Session, item_id: str) -> int:
    existing = session.exec(select(StudyQuestion.order).where(StudyQuestion.itemId == item_id)).all()
    orders = [o or 0 for o in existing]
    return (max(orders) + 1) if orders else 0


# -----------------------------------------------------------------------------
# Items (Topics / Papers)
# -----------------------------------------------------------------------------


@router.get("/items")
def get_study_items(session: Session = Depends(get_session)):
    items = session.exec(select(StudyItem)).all()
    return {"items": [i.model_dump() for i in items]}


@router.post("/items")
def create_study_item(payload: StudyItemCreate, session: Session = Depends(get_session)):
    item_type = payload.type
    item_id = f"{item_type}_{int(datetime.now().timestamp() * 1000)}"

    new_item = StudyItem(
        id=item_id,
        type=item_type,
        title=payload.title.strip(),
        tags=payload.tags,
        notes=payload.notes,
        paper=payload.paper if item_type == "paper" else None,
    )
    session.add(new_item)
    session.commit()
    session.refresh(new_item)
    return {"success": True, "item": new_item.model_dump()}


@router.put("/items/{item_id}")
def update_study_item(item_id: str, payload: StudyItemUpdate, session: Session = Depends(get_session)):
    item = session.exec(select(StudyItem).where(StudyItem.id == item_id)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    # exclude_unset so an omitted field is left alone rather than nulled
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value.strip() if field in {"title", "notes"} and value else value)
    session.add(item)
    session.commit()
    session.refresh(item)
    return {"success": True, "item": item.model_dump()}


@router.delete("/items/{item_id}")
def delete_study_item(item_id: str, session: Session = Depends(get_session)):
    item = session.exec(select(StudyItem).where(StudyItem.id == item_id)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    # Soft deactivate attached questions
    questions = session.exec(select(StudyQuestion).where(StudyQuestion.itemId == item_id)).all()
    for q in questions:
        q.active = False
        session.add(q)
    session.delete(item)
    session.commit()
    return {"success": True}


# -----------------------------------------------------------------------------
# Questions Bank
# -----------------------------------------------------------------------------


@router.get("/questions")
def get_questions(itemId: str | None = None, session: Session = Depends(get_session)):
    query = select(StudyQuestion).where(StudyQuestion.active == True)
    if itemId:
        query = query.where(StudyQuestion.itemId == itemId)
    questions = session.exec(query).all()

    today_str = get_local_date_string()
    items_map = {it.id: it for it in session.exec(select(StudyItem)).all()}

    result = []
    for q in questions:
        item = items_map.get(q.itemId)

        elapsed = elapsed_logical_days(q.lastReviewedAt, today_str)
        r_current = (
            compute_retrievability(elapsed, q.stability)
            if q.stability > 0
            else (1.0 if q.repetitions > 0 else 0.0)
        )

        result.append(
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
                "sm2": {
                    "easeFactor": q.easeFactor,
                    "repetitions": q.repetitions,
                    "intervalDays": q.intervalDays,
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
    return {"questions": result}


@router.post("/questions")
def create_question(payload: QuestionCreate, session: Session = Depends(get_session)):
    item_id = payload.itemId
    prompt = payload.prompt.strip()
    item = session.exec(select(StudyItem).where(StudyItem.id == item_id)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Parent study item not found")

    q_id = f"q_{int(datetime.now().timestamp() * 1000)}"
    today = get_local_date_string()
    next_order = _next_order_for_item(session, item_id)

    new_q = StudyQuestion(
        id=q_id,
        itemId=item_id,
        itemType=item.type,
        prompt=prompt,
        answerTemplate=payload.answerTemplate or ("paper" if item.type == "paper" else "topic"),
        difficulty=payload.difficulty,
        source="manual",
        active=True,
        order=next_order,
        easeFactor=2.5,
        repetitions=0,
        intervalDays=0,
        dueDate=today,
        modelSolution=payload.modelSolution,
        keyTakeaways=payload.keyTakeaways,
    )
    session.add(new_q)
    session.commit()
    session.refresh(new_q)
    return {"success": True, "question": new_q.model_dump()}


@router.put("/questions/{q_id}")
def update_question(q_id: str, payload: QuestionUpdate, session: Session = Depends(get_session)):
    q = session.exec(select(StudyQuestion).where(StudyQuestion.id == q_id)).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(q, field, value.strip() if field == "prompt" and value else value)
    session.add(q)
    session.commit()
    session.refresh(q)
    return {"success": True, "question": q.model_dump()}


@router.delete("/questions/{q_id}")
def delete_question(q_id: str, session: Session = Depends(get_session)):
    q = session.exec(select(StudyQuestion).where(StudyQuestion.id == q_id)).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    q.active = False
    session.add(q)
    session.commit()
    return {"success": True}


# -----------------------------------------------------------------------------
# AI Question Generator (Atomic / Bite-Sized Focus)
# -----------------------------------------------------------------------------


@router.post("/questions/generate")
async def generate_questions(payload: GenerateQuestionsRequest, session: Session = Depends(get_session)):
    api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="GEMINI_API_KEY is not configured in .env")

    item_id = payload.itemId
    count = payload.count
    is_atomic = payload.atomic

    item = session.exec(select(StudyItem).where(StudyItem.id == item_id)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if is_atomic:
        prompt_text = f"""You are a master educator and Principal ML Researcher creating crisp, atomic active-recall practice questions.
Item Title: "{item.title}"
Item Type: "{item.type}"
Item Notes: "{item.notes or "None"}"
{f"Paper Metadata: {json.dumps(item.paper)}" if item.paper else ""}

INSTRUCTIONS:
Generate {count} distinct, ATOMIC active-recall questions.
CRITICAL FORMAT RULES:
1. Each question MUST target ONE specific concept, mechanism, tensor transformation, equation, or theorem (e.g. "What is the shape transformation of Query/Key/Value in MHA?", "Why does Pre-LN prevent vanishing gradients compared to Post-LN?", "Derive the score function identity in policy gradients").
2. It should take 1 to 2 minutes for a student to write / sketch the answer. Avoid 5-part monolithic questions that cause burnout.
3. Provide a complete LaTeX model answer (`idealAnswer`) and 2 key takeaways so it can be cached in SQLite forever.

Respond with strict JSON matching:
{{
  "questions": [
    {{
      "prompt": "Specific, atomic question text (1-2 min target)...",
      "answerTemplate": "{"paper" if item.type == "paper" else "topic"}",
      "difficulty": "Medium",
      "idealAnswer": "Complete, pristine LaTeX model solution for this atomic question...",
      "keyTakeaways": ["Key point 1...", "Key point 2..."]
    }}
  ]
}}"""
    else:
        prompt_text = f"""You are a master educator and Principal ML Researcher building a SCAFFOLDED LADDER of active-recall questions for one topic.
Item Title: "{item.title}"
Item Type: "{item.type}"
Item Notes: "{item.notes or "None"}"
{f"Paper Metadata: {json.dumps(item.paper)}" if item.paper else ""}

GOAL:
Generate {count} questions that, taken together IN ORDER, let a student reconstruct the entire topic from first principles: every core definition, every equation, the intuition/"why" behind each design choice, and how the pieces compose. This is NOT a set of disconnected trivia questions — it is a deliberate ladder.

CRITICAL RULES:
1. ORDER & SCAFFOLDING: Question N may assume the student has already correctly answered questions 1..N-1. Reuse the same notation/symbols across the ladder (e.g. if Q1 defines V(s), Q3 can say "using V(s) from before, derive..."). Sequence from foundational/definitional (Easy) to derivation/synthesis (Hard). The LAST question(s) should require combining multiple earlier pieces (e.g. "derive the full update rule using the loss and target you defined above").
2. MIX THEORY WITH MATH: Do not make every question a derivation. Roughly half the ladder should be theory/intuition questions ("why does X exist", "what breaks if you remove X", "what is X actually trying to accomplish", "how does X differ from Y and when would you pick one over the other") and half should be precise math/derivation/mechanism questions (equations, algebra, tensor shapes, algorithm steps). Alternate or interleave them rather than clustering all the math at the end.
3. COVERAGE: Collectively the ladder must cover the full standard scope of the topic — all key formulas/objects a student would need in an interview or exam on "{item.title}" (e.g. for a Bellman/DP topic: reward function, state-value function, action-value function, Bellman expectation equation, Bellman optimality equation, advantage function, and the intuition behind bootstrapping/contraction — adapt this list to whatever "{item.title}" actually is).
4. Each individual question still takes only 1-3 minutes to answer (single focused prompt, not a multi-part essay) — the comprehensiveness comes from the LADDER as a whole, not from cramming everything into one question.
5. Provide a complete LaTeX model answer (`idealAnswer`) per question and 2 key takeaways, cached forever in SQLite.

Respond with strict JSON matching, with "questions" as an ARRAY IN THE INTENDED STUDY ORDER (index 0 = first/easiest):
{{
  "questions": [
    {{
      "prompt": "Question text (references earlier questions' notation where natural)...",
      "answerTemplate": "{"paper" if item.type == "paper" else "topic"}",
      "difficulty": "Easy | Medium | Hard",
      "questionMode": "intuition | math",
      "idealAnswer": "Complete, pristine LaTeX model solution for this question...",
      "keyTakeaways": ["Key point 1...", "Key point 2..."]
    }}
  ]
}}"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(
            url,
            json={
                "contents": [{"parts": [{"text": prompt_text}]}],
                "generationConfig": {"responseMimeType": "application/json"},
            },
        )
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=f"Gemini API Error: {res.text}")

        data = res.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(raw_text)
        candidate_qs = parsed.get("questions", [])

    today = get_local_date_string()
    next_order = _next_order_for_item(session, item_id)
    created = []
    for cq in candidate_qs:
        q_id = f"q_{int(datetime.now().timestamp() * 1000)}_{len(created)}"
        new_q = StudyQuestion(
            id=q_id,
            itemId=item_id,
            itemType=item.type,
            prompt=cq["prompt"],
            answerTemplate=cq.get("answerTemplate", "paper" if item.type == "paper" else "topic"),
            difficulty=cq.get("difficulty", "Medium"),
            source="gemini-generated",
            active=True,
            order=next_order + len(created),
            easeFactor=2.5,
            repetitions=0,
            intervalDays=0,
            dueDate=today,
            modelSolution=cq.get("idealAnswer"),
            keyTakeaways=cq.get("keyTakeaways", []),
        )
        session.add(new_q)
        created.append(new_q)

    session.commit()
    return {"success": True, "count": len(created), "questions": [q.model_dump() for q in created]}


# -----------------------------------------------------------------------------
# AI Question Decomposer (Split Monolithic Questions into Atomic Chunks)
# -----------------------------------------------------------------------------


@router.post("/questions/{q_id}/decompose")
async def decompose_question(q_id: str, session: Session = Depends(get_session)):
    q = session.exec(select(StudyQuestion).where(StudyQuestion.id == q_id)).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    item = session.exec(select(StudyItem).where(StudyItem.id == q.itemId)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Parent study item not found")

    atomic_list = await decompose_question_with_gemini(item, q)
    if not atomic_list:
        raise HTTPException(status_code=500, detail="Failed to decompose question into atomic parts")

    today = get_local_date_string()
    created_qs = []
    for idx, aq in enumerate(atomic_list):
        new_id = f"q_atomic_{int(datetime.now().timestamp() * 1000)}_{idx}"
        new_q = StudyQuestion(
            id=new_id,
            itemId=q.itemId,
            itemType=q.itemType,
            prompt=aq["prompt"],
            answerTemplate=aq.get("answerTemplate", q.answerTemplate),
            difficulty=aq.get("difficulty", "Medium"),
            source="gemini-decomposed",
            active=True,
            order=(q.order or 0) * 100 + idx,
            easeFactor=2.5,
            repetitions=0,
            intervalDays=0,
            dueDate=today,
            modelSolution=aq.get("idealAnswer"),
            keyTakeaways=aq.get("keyTakeaways", []),
        )
        session.add(new_q)
        created_qs.append(new_q)

    # Archive original monolithic question to prevent duplicate review
    q.active = False
    session.add(q)
    session.commit()

    return {
        "success": True,
        "originalQuestionId": q_id,
        "createdCount": len(created_qs),
        "atomicQuestions": [cq.model_dump() for cq in created_qs],
    }


# -----------------------------------------------------------------------------
# Due Queue & Practice Attempts (FSRS Powered)
# -----------------------------------------------------------------------------


@router.post("/balance-backlog")
def balance_backlog(payload: BalanceBacklogRequest | None = None, session: Session = Depends(get_session)):
    return balance_backlog_schedule(session, payload.cardsPerDay if payload else 5)


@router.get("/due")
def get_due_questions(session: Session = Depends(get_session)):
    return get_due_practice_queue(session)


@router.post("/attempts")
async def submit_practice_attempt(payload: AttemptSubmit, session: Session = Depends(get_session)):
    question_id = payload.questionId
    answer_markdown = payload.answerMarkdown

    q = session.exec(select(StudyQuestion).where(StudyQuestion.id == question_id)).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    item = session.exec(select(StudyItem).where(StudyItem.id == q.itemId)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Parent study item not found")

    eval_res = await evaluate_answer_with_gemini(item, q, answer_markdown)
    return record_practice_attempt(session, q, item, answer_markdown, eval_res)


# -----------------------------------------------------------------------------
# Instant Cached Model Solution Key
# -----------------------------------------------------------------------------


@router.post("/questions/{q_id}/model-solution")
async def get_question_model_solution(q_id: str, session: Session = Depends(get_session)):
    q = session.exec(select(StudyQuestion).where(StudyQuestion.id == q_id)).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    item = session.exec(select(StudyItem).where(StudyItem.id == q.itemId)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Parent study item not found")

    # Check if answer key is already stored in SQLite database
    if q.modelSolution and q.modelSolution.strip():
        return {
            "success": True,
            "questionId": q_id,
            "itemTitle": item.title,
            "idealAnswer": q.modelSolution,
            "keyTakeaways": q.keyTakeaways or [],
            "cached": True,
        }

    # Generate on demand via Gemini and cache forever in SQLite
    res = await generate_model_solution_with_gemini(item, q)
    ideal = res.get("idealAnswer", "")
    takeaways = res.get("keyTakeaways", [])
    if ideal:
        q.modelSolution = ideal
        q.keyTakeaways = takeaways
        session.add(q)
        session.commit()
        session.refresh(q)

    return {
        "success": True,
        "questionId": q_id,
        "itemTitle": item.title,
        "idealAnswer": ideal,
        "keyTakeaways": takeaways,
        "cached": False,
    }


# -----------------------------------------------------------------------------
# Performance & Mastery Analytics (FSRS DSR Model)
# -----------------------------------------------------------------------------


@router.get("/performance")
def get_performance(session: Session = Depends(get_session)):
    return get_performance_analytics(session)


@router.get("/attempts")
def get_attempts(
    questionId: str | None = None,
    itemId: str | None = None,
    limit: int = 50,
    session: Session = Depends(get_session),
):
    query = select(StudyAttempt).order_by(StudyAttempt.submittedAt.desc())
    if questionId:
        query = query.where(StudyAttempt.questionId == questionId)
    elif itemId:
        query = query.where(StudyAttempt.itemId == itemId)
    attempts = session.exec(query.limit(limit)).all()
    return {"attempts": [a.model_dump() for a in attempts]}


@router.post("/upload-image")
def upload_practice_image(payload: PracticeImageUpload):
    data_url = payload.dataUrl
    question_id = payload.questionId

    match = re.match(r"^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$", data_url, re.DOTALL)
    if not match:
        raise HTTPException(
            status_code=400, detail="Invalid base64 image format. Expected data:image/...;base64,..."
        )

    raw_sub = match.group(1).lower()
    ext = (
        "jpg"
        if raw_sub in ("jpeg", "jpg")
        else "png"
        if "png" in raw_sub
        else "webp"
        if "webp" in raw_sub
        else "jpg"
    )
    try:
        buffer = base64.b64decode(match.group(2).strip())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode base64 image: {e}") from e

    clean_qid = re.sub(r"[^a-zA-Z0-9_-]", "_", question_id)
    filename = f"practice_{clean_qid}_{int(datetime.now().timestamp() * 1000)}.{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(buffer)

    return {"success": True, "url": f"/uploads/{filename}", "filename": filename}


@router.get("/status")
def get_practice_status(session: Session = Depends(get_session)):
    today = get_local_date_string()
    entry = get_or_create_today_entry(session, today)
    config = get_effective_config(session)

    due_qs = session.exec(
        select(StudyQuestion).where(StudyQuestion.active == True, StudyQuestion.dueDate <= today)
    ).all()

    all_qs = session.exec(select(StudyQuestion).where(StudyQuestion.active == True)).all()
    all_items = session.exec(select(StudyItem)).all()
    all_attempts = session.exec(select(StudyAttempt)).all()

    is_comp = is_practice_satisfied(entry, len(due_qs), config.practiceMinDueToUnlock)

    return {
        "today": today,
        "dueCount": len(due_qs),
        "completedTodayCount": len(entry.practiceCompletedQuestionIds or []),
        "minRequired": config.practiceMinDueToUnlock,
        "isCompleted": is_comp,
        "isManualOverride": entry.practiceManualOverride,
        "overrideReason": entry.practiceOverrideReason,
        "totalQuestions": len(all_qs),
        "totalItems": len(all_items),
        "totalAttempts": len(all_attempts),
    }


@router.post("/override")
def override_practice_today(payload: OverrideRequest, session: Session = Depends(get_session)):
    entry = get_or_create_today_entry(session)
    reason = payload.reason or "Manual practice override applied"
    entry.practiceManualOverride = True
    entry.practiceCompleted = True
    entry.practiceOverrideReason = reason
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return {"success": True, "message": "Practice requirement overridden for today."}


@router.post("/reset-override")
def reset_practice_override(session: Session = Depends(get_session)):
    entry = get_or_create_today_entry(session)
    entry.practiceManualOverride = False
    entry.practiceOverrideReason = None

    today = get_local_date_string()
    due_qs = session.exec(
        select(StudyQuestion).where(StudyQuestion.active == True, StudyQuestion.dueDate <= today)
    ).all()

    config = get_effective_config(session)
    entry.practiceCompleted = is_practice_satisfied(entry, len(due_qs), config.practiceMinDueToUnlock)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return {"success": True, "message": "Practice override reset."}
