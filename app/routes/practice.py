import os
import re
import base64
import json
import httpx
from datetime import datetime
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from app.database import get_session
from app.config import settings, get_local_date_string
from app.models.study import StudyItem, StudyQuestion, StudyAttempt
from app.models.daily_entry import DailyEntry
from app.pillars.status import get_effective_config, get_or_create_today_entry
from app.pillars.practice import (
    add_days_to_date_string,
    score_to_fsrs_grade,
    compute_next_fsrs,
    compute_retrievability,
    compute_interval_for_retrievability,
    score_to_sm2_quality,
    compute_next_sm2,
    is_practice_satisfied,
    evaluate_answer_with_gemini,
    generate_model_solution_with_gemini,
    decompose_question_with_gemini
)

router = APIRouter(prefix="/api/practice", tags=["Consistent Practice"])
UPLOADS_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

# -----------------------------------------------------------------------------
# Items (Topics / Papers)
# -----------------------------------------------------------------------------

@router.get("/items")
def get_study_items(session: Session = Depends(get_session)):
    items = session.exec(select(StudyItem)).all()
    return {"items": [i.dict() for i in items]}

@router.post("/items")
def create_study_item(payload: Dict[str, Any], session: Session = Depends(get_session)):
    title = payload.get("title", "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    item_type = payload.get("type", "topic")
    tags = payload.get("tags", [])
    if isinstance(tags, str):
        tags = [s.strip() for s in tags.split(",") if s.strip()]
    item_id = f"{item_type}_{int(datetime.now().timestamp() * 1000)}"
    
    new_item = StudyItem(
        id=item_id,
        type=item_type,
        title=title,
        tags=tags,
        notes=payload.get("notes", ""),
        paper=payload.get("paper") if item_type == "paper" else None
    )
    session.add(new_item)
    session.commit()
    session.refresh(new_item)
    return {"success": True, "item": new_item.dict()}

@router.put("/items/{item_id}")
def update_study_item(item_id: str, payload: Dict[str, Any], session: Session = Depends(get_session)):
    item = session.exec(select(StudyItem).where(StudyItem.id == item_id)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if "title" in payload: item.title = payload["title"].strip()
    if "tags" in payload:
        tags = payload["tags"]
        item.tags = [s.strip() for s in tags.split(",") if s.strip()] if isinstance(tags, str) else tags
    if "notes" in payload: item.notes = payload["notes"].strip()
    if "paper" in payload: item.paper = payload["paper"]
    if "type" in payload: item.type = payload["type"]
    session.add(item)
    session.commit()
    session.refresh(item)
    return {"success": True, "item": item.dict()}

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
def get_questions(itemId: Optional[str] = None, session: Session = Depends(get_session)):
    query = select(StudyQuestion).where(StudyQuestion.active == True)
    if itemId:
        query = query.where(StudyQuestion.itemId == itemId)
    questions = session.exec(query).all()
    
    today_str = get_local_date_string()
    result = []
    for q in questions:
        item = session.exec(select(StudyItem).where(StudyItem.id == q.itemId)).first()
        
        # Calculate current elapsed days and retrievability
        elapsed = 0
        if q.lastReviewedAt:
            try:
                last_d = datetime.fromisoformat(q.lastReviewedAt.replace("Z", "+00:00")).date()
                today_d = datetime.strptime(today_str, "%Y-%m-%d").date()
                elapsed = max(0, (today_d - last_d).days)
            except Exception:
                elapsed = 0
        r_current = compute_retrievability(elapsed, q.stability) if q.stability > 0 else (1.0 if q.repetitions > 0 else 0.0)

        result.append({
            "id": q.id,
            "itemId": q.itemId,
            "itemType": q.itemType,
            "prompt": q.prompt,
            "answerTemplate": q.answerTemplate,
            "difficulty": q.difficulty,
            "source": q.source,
            "active": q.active,
            "fsrs": {
                "stability": q.stability,
                "difficulty": q.fsrsDifficulty or 5.0,
                "retrievability": r_current,
                "lapses": q.lapses or 0,
                "state": q.state or 0,
                "repetitions": q.repetitions,
                "intervalDays": q.intervalDays,
                "dueDate": q.dueDate,
                "lastReviewedAt": q.lastReviewedAt
            },
            "sm2": {
                "easeFactor": q.easeFactor,
                "repetitions": q.repetitions,
                "intervalDays": q.intervalDays,
                "dueDate": q.dueDate,
                "lastReviewedAt": q.lastReviewedAt
            },
            "itemTitle": item.title if item else "Unknown",
            "itemTags": item.tags if item else [],
            "itemNotes": item.notes if item else "",
            "itemPaper": item.paper if item else None,
            "hasModelSolution": bool(q.modelSolution),
            "modelSolution": q.modelSolution,
            "keyTakeaways": q.keyTakeaways or []
        })
    return {"questions": result}

@router.post("/questions")
def create_question(payload: Dict[str, Any], session: Session = Depends(get_session)):
    item_id = payload.get("itemId")
    prompt = payload.get("prompt", "").strip()
    if not item_id or not prompt:
        raise HTTPException(status_code=400, detail="itemId and prompt are required")
    item = session.exec(select(StudyItem).where(StudyItem.id == item_id)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Parent study item not found")
        
    q_id = f"q_{int(datetime.now().timestamp() * 1000)}"
    today = get_local_date_string()
    
    new_q = StudyQuestion(
        id=q_id,
        itemId=item_id,
        itemType=item.type,
        prompt=prompt,
        answerTemplate=payload.get("answerTemplate", "paper" if item.type == "paper" else "topic"),
        difficulty=payload.get("difficulty", "Medium"),
        source="manual",
        active=True,
        easeFactor=2.5,
        repetitions=0,
        intervalDays=0,
        dueDate=today,
        modelSolution=payload.get("modelSolution"),
        keyTakeaways=payload.get("keyTakeaways", [])
    )
    session.add(new_q)
    session.commit()
    session.refresh(new_q)
    return {"success": True, "question": new_q.dict()}

@router.put("/questions/{q_id}")
def update_question(q_id: str, payload: Dict[str, Any], session: Session = Depends(get_session)):
    q = session.exec(select(StudyQuestion).where(StudyQuestion.id == q_id)).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    if "prompt" in payload: q.prompt = payload["prompt"].strip()
    if "answerTemplate" in payload: q.answerTemplate = payload["answerTemplate"]
    if "difficulty" in payload: q.difficulty = payload["difficulty"]
    if "active" in payload: q.active = bool(payload["active"])
    if "modelSolution" in payload: q.modelSolution = payload["modelSolution"]
    if "keyTakeaways" in payload: q.keyTakeaways = payload["keyTakeaways"]
    session.add(q)
    session.commit()
    session.refresh(q)
    return {"success": True, "question": q.dict()}

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
async def generate_questions(payload: Dict[str, Any], session: Session = Depends(get_session)):
    api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="GEMINI_API_KEY is not configured in .env")
        
    item_id = payload.get("itemId")
    count = payload.get("count", 3)
    is_atomic = payload.get("atomic", True)
    if not item_id:
        raise HTTPException(status_code=400, detail="itemId is required")
        
    item = session.exec(select(StudyItem).where(StudyItem.id == item_id)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    prompt_text = f"""You are a master educator and Principal ML Researcher creating crisp, atomic active-recall practice questions.
Item Title: "{item.title}"
Item Type: "{item.type}"
Item Notes: "{item.notes or 'None'}"
{f'Paper Metadata: {json.dumps(item.paper)}' if item.paper else ''}

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
      "answerTemplate": "{'paper' if item.type == 'paper' else 'topic'}",
      "difficulty": "Medium",
      "idealAnswer": "Complete, pristine LaTeX model solution for this atomic question...",
      "keyTakeaways": ["Key point 1...", "Key point 2..."]
    }}
  ]
}}"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(url, json={
            "contents": [{"parts": [{"text": prompt_text}]}],
            "generationConfig": {"responseMimeType": "application/json"}
        })
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=f"Gemini API Error: {res.text}")
            
        data = res.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(raw_text)
        candidate_qs = parsed.get("questions", [])
        
    today = get_local_date_string()
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
            easeFactor=2.5,
            repetitions=0,
            intervalDays=0,
            dueDate=today,
            modelSolution=cq.get("idealAnswer"),
            keyTakeaways=cq.get("keyTakeaways", [])
        )
        session.add(new_q)
        created.append(new_q)
        
    session.commit()
    return {"success": True, "count": len(created), "questions": [q.dict() for q in created]}

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
            easeFactor=2.5,
            repetitions=0,
            intervalDays=0,
            dueDate=today,
            modelSolution=aq.get("idealAnswer"),
            keyTakeaways=aq.get("keyTakeaways", [])
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
        "atomicQuestions": [cq.dict() for cq in created_qs]
    }

# -----------------------------------------------------------------------------
# Due Queue & Practice Attempts (FSRS Powered)
# -----------------------------------------------------------------------------

@router.post("/balance-backlog")
def balance_backlog(payload: Optional[Dict[str, Any]] = None, session: Session = Depends(get_session)):
    """
    FSRS Backlog Load Balancer:
    Staggers unreviewed new cards and overdue cards across upcoming days (e.g. 5 cards/day)
    grouped by topic so the user has a manageable daily study session without burnout.
    """
    payload = payload or {}
    cards_per_day = max(1, int(payload.get("cardsPerDay", 5)))
    today = get_local_date_string()
    
    # Fetch all active questions
    all_questions = session.exec(select(StudyQuestion).where(StudyQuestion.active == True)).all()
    if not all_questions:
        return {"success": True, "message": "No active questions found in bank.", "staggeredCount": 0}
        
    # Separate reviewed vs unreviewed cards
    reviewed_cards = [q for q in all_questions if (q.repetitions or 0) > 0]
    unreviewed_cards = [q for q in all_questions if (q.repetitions or 0) == 0]
    
    # Sort unreviewed cards by itemId (topic) then difficulty to keep topics grouped
    unreviewed_cards.sort(key=lambda q: (q.itemId, 0 if q.difficulty == "Easy" else 1 if q.difficulty == "Medium" else 2))
    
    # Stagger unreviewed cards starting today
    day_offset = 0
    assigned_today = 0
    
    # Check how many reviewed cards are already due today
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
        "todayDueCount": min(cards_per_day, len(all_questions))
    }

@router.get("/due")
def get_due_questions(session: Session = Depends(get_session)):
    today = get_local_date_string()
    config = get_effective_config(session)
    daily_target = getattr(config, "practiceDailyTarget", 5) or 5
    
    # Fetch today's entry to see completed count
    entry = session.exec(select(DailyEntry).where(DailyEntry.date == today)).first()
    completed_ids = (entry.practiceCompletedQuestionIds or []) if entry else []
    completed_today = len(completed_ids)
    
    all_active_count = len(session.exec(select(StudyQuestion.id).where(StudyQuestion.active == True)).all())
    
    questions = session.exec(
        select(StudyQuestion).where(
            StudyQuestion.active == True,
            StudyQuestion.dueDate <= today
        )
    ).all()
    
    due_list = []
    for q in questions:
        item = session.exec(select(StudyItem).where(StudyItem.id == q.itemId)).first()
        
        # Calculate current elapsed days and retrievability
        elapsed = 0
        if q.lastReviewedAt:
            try:
                last_d = datetime.fromisoformat(q.lastReviewedAt.replace("Z", "+00:00")).date()
                today_d = datetime.strptime(today, "%Y-%m-%d").date()
                elapsed = max(0, (today_d - last_d).days)
            except Exception:
                elapsed = 0
        r_current = compute_retrievability(elapsed, q.stability) if (q.stability and q.stability > 0) else (1.0 if (q.repetitions or 0) > 0 else 0.0)
        
        is_completed_today = q.id in completed_ids

        due_list.append({
            "id": q.id,
            "itemId": q.itemId,
            "itemType": q.itemType,
            "prompt": q.prompt,
            "answerTemplate": q.answerTemplate,
            "difficulty": q.difficulty,
            "source": q.source,
            "active": q.active,
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
                "lastReviewedAt": q.lastReviewedAt
            },
            "sm2": {
                "easeFactor": q.easeFactor or 2.5,
                "repetitions": q.repetitions or 0,
                "intervalDays": q.intervalDays or 0,
                "dueDate": q.dueDate,
                "lastReviewedAt": q.lastReviewedAt
            },
            "itemTitle": item.title if item else "Unknown",
            "itemTags": item.tags if item else [],
            "itemNotes": item.notes if item else "",
            "itemPaper": item.paper if item else None,
            "hasModelSolution": bool(q.modelSolution),
            "modelSolution": q.modelSolution,
            "keyTakeaways": q.keyTakeaways or []
        })
        
    # Sort due list:
    # 1. Uncompleted today first
    # 2. Previously reviewed cards (repetitions > 0) by lowest Retrievability R first (most urgent recall)
    # 3. New cards (repetitions == 0)
    due_list.sort(key=lambda x: (
        1 if x["completedToday"] else 0,
        0 if x["fsrs"]["repetitions"] > 0 else 1,
        x["fsrs"]["retrievability"]
    ))
    
    target_met = completed_today >= daily_target
        
    return {
        "today": today,
        "dueCount": len(due_list),
        "dailyTarget": daily_target,
        "completedToday": completed_today,
        "targetMet": target_met,
        "totalBankCount": all_active_count,
        "dueQuestions": due_list
    }

@router.post("/attempts")
async def submit_practice_attempt(payload: Dict[str, Any], session: Session = Depends(get_session)):
    question_id = payload.get("questionId")
    answer_markdown = payload.get("answerMarkdown", "").strip()
    if not question_id or not answer_markdown:
        raise HTTPException(status_code=400, detail="questionId and answerMarkdown are required")
        
    q = session.exec(select(StudyQuestion).where(StudyQuestion.id == question_id)).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    item = session.exec(select(StudyItem).where(StudyItem.id == q.itemId)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Parent study item not found")
        
    # Evaluate with Gemini 2.5 Flash
    eval_res = await evaluate_answer_with_gemini(item, q, answer_markdown)
    score = max(0.0, min(10.0, float(eval_res.get("score", 0.0))))
    grade = score_to_fsrs_grade(score)
    today = get_local_date_string()
    
    # Compute new FSRS state
    fsrs_res = compute_next_fsrs(
        current_stability=q.stability,
        current_difficulty=q.fsrsDifficulty or 5.0,
        current_reps=q.repetitions,
        current_lapses=q.lapses or 0,
        current_state=q.state or 0,
        last_reviewed_at=q.lastReviewedAt,
        grade=grade,
        today_str=today
    )
    
    q.stability = fsrs_res["stability"]
    q.fsrsDifficulty = fsrs_res["fsrsDifficulty"]
    q.repetitions = fsrs_res["repetitions"]
    q.lapses = fsrs_res["lapses"]
    q.state = fsrs_res["state"]
    q.intervalDays = fsrs_res["intervalDays"]
    q.dueDate = fsrs_res["dueDate"]
    q.easeFactor = fsrs_res["easeFactor"]
    q.lastReviewedAt = datetime.utcnow().isoformat()
    
    # Cache model solution in DB forever if not already present
    if not q.modelSolution and eval_res.get("idealAnswer"):
        q.modelSolution = eval_res.get("idealAnswer")
        q.keyTakeaways = eval_res.get("keyImprovements", [])
    session.add(q)
    
    # Save Attempt
    attempt_id = f"att_{int(datetime.now().timestamp() * 1000)}"
    attempt = StudyAttempt(
        id=attempt_id,
        questionId=question_id,
        itemId=q.itemId,
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
            "keyImprovements": eval_res.get("keyImprovements", [])
        },
        geminiModel="gemini-2.5-flash"
    )
    session.add(attempt)
    
    # Update Daily Entry
    entry = get_or_create_today_entry(session, today)
    answered_ids = list(entry.practiceCompletedQuestionIds or [])
    if question_id not in answered_ids:
        answered_ids.append(question_id)
    entry.practiceCompletedQuestionIds = answered_ids
    entry.practiceCompletedCount = len(answered_ids)
    
    # Calculate remaining due
    due_qs = session.exec(
        select(StudyQuestion).where(
            StudyQuestion.active == True,
            StudyQuestion.dueDate <= today
        )
    ).all()
    entry.practiceDueCount = len(due_qs)
    
    config = get_effective_config(session)
    entry.practiceCompleted = is_practice_satisfied(entry, len(due_qs), config.practiceMinDueToUnlock)
    session.add(entry)
    session.commit()
    session.refresh(attempt)
    session.refresh(q)
    
    return {
        "success": True,
        "attempt": attempt.dict(),
        "updatedQuestion": q.dict(),
        "item": item.dict(),
        "fsrs": fsrs_res,
        "sm2": {
            "easeFactor": q.easeFactor,
            "repetitions": q.repetitions,
            "intervalDays": q.intervalDays,
            "dueDate": q.dueDate,
            "lastReviewedAt": q.lastReviewedAt
        },
        "practiceCompletedToday": entry.practiceCompleted,
        "remainingDueCount": entry.practiceDueCount,
        "distinctCompletedToday": entry.practiceCompletedCount
    }

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
            "cached": True
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
        "cached": False
    }

# -----------------------------------------------------------------------------
# Performance & Mastery Analytics (FSRS DSR Model)
# -----------------------------------------------------------------------------

@router.get("/performance")
def get_performance_analytics(session: Session = Depends(get_session)):
    all_attempts = session.exec(select(StudyAttempt).order_by(StudyAttempt.submittedAt.asc())).all()
    all_questions = session.exec(select(StudyQuestion)).all()
    all_items = session.exec(select(StudyItem)).all()
    today_str = get_local_date_string()
    
    items_map = {it.id: it for it in all_items}
    
    # Group attempts by question
    question_attempts: Dict[str, List[StudyAttempt]] = {}
    for att in all_attempts:
        question_attempts.setdefault(att.questionId, []).append(att)
        
    question_metrics = []
    for q in all_questions:
        if not q.active and q.id not in question_attempts:
            continue
        atts = question_attempts.get(q.id, [])
        scores = [float(a.evaluation.get("score", 0.0)) for a in atts if a.evaluation and "score" in a.evaluation]
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
            
        # Calculate current elapsed days and retrievability
        elapsed = 0
        if q.lastReviewedAt:
            try:
                last_d = datetime.fromisoformat(q.lastReviewedAt.replace("Z", "+00:00")).date()
                today_d = datetime.strptime(today_str, "%Y-%m-%d").date()
                elapsed = max(0, (today_d - last_d).days)
            except Exception:
                elapsed = 0
        r_current = compute_retrievability(elapsed, q.stability) if q.stability > 0 else (1.0 if q.repetitions > 0 else 0.0)

        item = items_map.get(q.itemId)
        question_metrics.append({
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
                "lastReviewedAt": q.lastReviewedAt
            },
            "easeFactor": q.easeFactor,
            "repetitions": q.repetitions,
            "intervalDays": q.intervalDays,
            "dueDate": q.dueDate,
            "lastAttemptedAt": atts[-1].submittedAt if atts else None,
            "hasModelSolution": bool(q.modelSolution)
        })
        
    # Overall metrics
    all_scores = [float(a.evaluation.get("score", 0.0)) for a in all_attempts if a.evaluation and "score" in a.evaluation]
    overall_avg = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0.0
    mastered_count = sum(1 for qm in question_metrics if qm["statusTier"] == "Mastered")
    proficient_count = sum(1 for qm in question_metrics if qm["statusTier"] == "Proficient")
    developing_count = sum(1 for qm in question_metrics if qm["statusTier"] == "Developing")
    needs_work_count = sum(1 for qm in question_metrics if qm["statusTier"] == "Needs Work")
    
    stabilities = [qm["fsrs"]["stability"] for qm in question_metrics if qm["active"] and qm["fsrs"]["stability"] > 0]
    avg_stability = round(sum(stabilities) / len(stabilities), 1) if stabilities else 0.0

    # Topic level summaries
    topic_metrics = []
    for it in all_items:
        it_qs = [qm for qm in question_metrics if qm["itemId"] == it.id and qm["active"]]
        it_scores = [s for qm in it_qs for s in qm["scores"]]
        it_avg = round(sum(it_scores) / len(it_scores), 1) if it_scores else 0.0
        it_mastered = sum(1 for qm in it_qs if qm["statusTier"] == "Mastered")
        topic_metrics.append({
            "itemId": it.id,
            "title": it.title,
            "type": it.type,
            "tags": it.tags or [],
            "questionCount": len(it_qs),
            "attemptCount": len(it_scores),
            "averageScore": it_avg,
            "masteredCount": it_mastered,
            "masteryRate": round((it_mastered / len(it_qs) * 100), 1) if it_qs else 0.0
        })
        
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
            "needsWorkCount": needs_work_count
        },
        "questions": question_metrics,
        "topics": topic_metrics
    }

@router.get("/attempts")
def get_attempts(questionId: Optional[str] = None, itemId: Optional[str] = None, limit: int = 50, session: Session = Depends(get_session)):
    query = select(StudyAttempt).order_by(StudyAttempt.submittedAt.desc())
    if questionId: query = query.where(StudyAttempt.questionId == questionId)
    elif itemId: query = query.where(StudyAttempt.itemId == itemId)
    attempts = session.exec(query.limit(limit)).all()
    return {"attempts": [a.dict() for a in attempts]}

@router.post("/upload-image")
def upload_practice_image(payload: Dict[str, Any]):
    data_url = payload.get("dataUrl")
    question_id = payload.get("questionId", "diagram")
    if not data_url:
        raise HTTPException(status_code=400, detail="dataUrl is required")
        
    match = re.match(r"^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$", data_url, re.DOTALL)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid base64 image format. Expected data:image/...;base64,...")
        
    raw_sub = match.group(1).lower()
    ext = "jpg" if raw_sub in ("jpeg", "jpg") else "png" if "png" in raw_sub else "webp" if "webp" in raw_sub else "jpg"
    try:
        buffer = base64.b64decode(match.group(2).strip())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode base64 image: {e}")
        
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
        select(StudyQuestion).where(
            StudyQuestion.active == True,
            StudyQuestion.dueDate <= today
        )
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
        "totalAttempts": len(all_attempts)
    }

@router.post("/override")
def override_practice_today(payload: Dict[str, Any], session: Session = Depends(get_session)):
    entry = get_or_create_today_entry(session)
    reason = payload.get("reason", "Manual practice override applied")
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
        select(StudyQuestion).where(
            StudyQuestion.active == True,
            StudyQuestion.dueDate <= today
        )
    ).all()
    
    config = get_effective_config(session)
    entry.practiceCompleted = is_practice_satisfied(entry, len(due_qs), config.practiceMinDueToUnlock)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return {"success": True, "message": "Practice override reset."}
