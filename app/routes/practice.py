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
from app.pillars.practice import score_to_sm2_quality, compute_next_sm2, is_practice_satisfied, evaluate_answer_with_gemini

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
    return {"questions": [q.dict() for q in questions]}

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
        dueDate=today
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
# AI Question Generator
# -----------------------------------------------------------------------------

@router.post("/questions/generate")
async def generate_questions(payload: Dict[str, Any], session: Session = Depends(get_session)):
    api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="GEMINI_API_KEY is not configured in .env")
        
    item_id = payload.get("itemId")
    count = payload.get("count", 3)
    if not item_id:
        raise HTTPException(status_code=400, detail="itemId is required")
        
    item = session.exec(select(StudyItem).where(StudyItem.id == item_id)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    prompt_text = f"""You are a strict, world-class ML researcher creating rigorous active-recall practice questions.
Item Title: "{item.title}"
Item Type: "{item.type}"
Item Notes: "{item.notes or 'None'}"
{f'Paper Metadata: {json.dumps(item.paper)}' if item.paper else ''}

Generate {count} distinct active-recall questions designed to test mathematical mastery, mechanism intuition, and conceptual depth.
Respond with strict JSON matching:
{{
  "questions": [
    {{
      "prompt": "Detailed question text...",
      "answerTemplate": "{'paper' if item.type == 'paper' else 'topic'}",
      "difficulty": "Hard"
    }}
  ]
}}"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    async with httpx.AsyncClient(timeout=45.0) as client:
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
            difficulty=cq.get("difficulty", "Hard"),
            source="gemini-generated",
            active=True,
            easeFactor=2.5,
            repetitions=0,
            intervalDays=0,
            dueDate=today
        )
        session.add(new_q)
        created.append(new_q)
        
    session.commit()
    return {"success": True, "count": len(created), "questions": [q.dict() for q in created]}

# -----------------------------------------------------------------------------
# Due Queue & Practice Attempts
# -----------------------------------------------------------------------------

@router.get("/due")
def get_due_questions(session: Session = Depends(get_session)):
    today = get_local_date_string()
    questions = session.exec(
        select(StudyQuestion).where(
            StudyQuestion.active == True,
            StudyQuestion.dueDate <= today
        )
    ).all()
    
    due_list = []
    for q in questions:
        item = session.exec(select(StudyItem).where(StudyItem.id == q.itemId)).first()
        due_list.append({
            "id": q.id,
            "itemId": q.itemId,
            "itemType": q.itemType,
            "prompt": q.prompt,
            "answerTemplate": q.answerTemplate,
            "difficulty": q.difficulty,
            "source": q.source,
            "active": q.active,
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
            "itemPaper": item.paper if item else None
        })
        
    return {"today": today, "dueCount": len(due_list), "dueQuestions": due_list}

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
    quality = score_to_sm2_quality(score)
    today = get_local_date_string()
    
    # Compute new SM-2 state
    new_ef, new_reps, new_interval, next_due = compute_next_sm2(
        q.easeFactor, q.repetitions, q.intervalDays, quality, today
    )
    q.easeFactor = new_ef
    q.repetitions = new_reps
    q.intervalDays = new_interval
    q.dueDate = next_due
    q.lastReviewedAt = datetime.utcnow().isoformat()
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
            "quality": quality,
            "rubric": eval_res.get("rubric", {}),
            "critique": eval_res.get("critique", ""),
            "flaggedIssues": eval_res.get("flaggedIssues", [])
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
        "sm2": {
            "easeFactor": new_ef,
            "repetitions": new_reps,
            "intervalDays": new_interval,
            "dueDate": next_due,
            "lastReviewedAt": q.lastReviewedAt
        },
        "practiceCompletedToday": entry.practiceCompleted,
        "remainingDueCount": entry.practiceDueCount,
        "distinctCompletedToday": entry.practiceCompletedCount
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
        
    match = re.match(r"^data:image\/([a-zA-Z0-9]+);base64,(.+)$", data_url)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")
        
    ext = "jpg" if match.group(1) == "jpeg" else match.group(1)
    buffer = base64.b64decode(match.group(2))
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
