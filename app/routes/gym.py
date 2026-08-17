import os
import httpx
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session
from app.database import get_session
from app.config import settings
from app.pillars.status import get_effective_config, get_or_create_today_entry
from app.pillars.gym import verify_hevy_workout_today

router = APIRouter(prefix="/api/hevy", tags=["Gym / Hevy"])

def get_hevy_key() -> Optional[str]:
    return settings.HEVY_API_KEY or os.environ.get("HEVY_API_KEY")

@router.get("/status")
async def get_hevy_status(session: Session = Depends(get_session)):
    config = get_effective_config(session)
    entry = get_or_create_today_entry(session)
    key = get_hevy_key()
    gemini_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    
    verified = entry.gymCompleted
    workout = entry.gymWorkoutData
    err = entry.gymVerificationError
    
    if key and not verified:
        success, w, error_msg = await verify_hevy_workout_today(key)
        if success:
            entry.gymCompleted = True
            entry.gymWorkoutData = w
            entry.gymVerificationError = None
            session.add(entry)
            session.commit()
            session.refresh(entry)
            verified = True
            workout = w
            err = None
        else:
            err = error_msg

    return {
        "success": True,
        "hevyApiKeyConfigured": bool(key),
        "geminiApiKeyConfigured": bool(gemini_key),
        "verified": verified,
        "workoutData": workout,
        "error": err,
        "config": {
            "enabled": config.gymLockEnabled,
            "startHour": config.gymLockStartHour,
            "weeklyGoal": config.gymWeeklyGoal
        }
    }

@router.get("/workouts")
async def get_hevy_workouts():
    key = get_hevy_key()
    if not key:
        raise HTTPException(status_code=400, detail="HEVY_API_KEY is not configured in .env")
    
    url = "https://api.hevyapp.com/v1/workouts?page=1&pageSize=10"
    headers = {"api-key": key, "Accept": "application/json"}
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.get(url, headers=headers)
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=f"Hevy API error: {res.text}")
        return res.json()

@router.get("/templates")
async def get_hevy_templates():
    key = get_hevy_key()
    if not key:
        raise HTTPException(status_code=400, detail="HEVY_API_KEY is not configured in .env")
    
    url = "https://api.hevyapp.com/v1/workout_templates"
    headers = {"api-key": key, "Accept": "application/json"}
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.get(url, headers=headers)
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=f"Hevy API error: {res.text}")
        return res.json()

@router.post("/upload-workout")
async def upload_hevy_workout(payload: Dict[str, Any], session: Session = Depends(get_session)):
    key = get_hevy_key()
    if not key:
        raise HTTPException(status_code=400, detail="HEVY_API_KEY is not configured in .env")
    
    url = "https://api.hevyapp.com/v1/workouts"
    headers = {"api-key": key, "Content-Type": "application/json"}
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(url, headers=headers, json=payload)
        if res.status_code not in (200, 201):
            raise HTTPException(status_code=res.status_code, detail=f"Failed to post workout: {res.text}")
        
        data = res.json()
        entry = get_or_create_today_entry(session)
        entry.gymCompleted = True
        entry.gymWorkoutData = data.get("workout") or payload
        entry.gymVerificationError = None
        session.add(entry)
        session.commit()
        return {"success": True, "workout": data}

@router.post("/verify-today")
async def verify_hevy_today(session: Session = Depends(get_session)):
    config = get_effective_config(session)
    entry = get_or_create_today_entry(session)
    
    success, workout, err = await verify_hevy_workout_today(get_hevy_key())
    if success and workout:
        entry.gymCompleted = True
        entry.gymWorkoutData = workout
        entry.gymVerificationError = None
    else:
        entry.gymVerificationError = err
        
    session.add(entry)
    session.commit()
    session.refresh(entry)
    
    return {
        "success": success,
        "verified": entry.gymCompleted,
        "workout": entry.gymWorkoutData,
        "error": entry.gymVerificationError
    }

@router.post("/override")
def override_gym_today(payload: Dict[str, Any], session: Session = Depends(get_session)):
    entry = get_or_create_today_entry(session)
    entry.gymCompleted = True
    entry.gymVerificationError = None
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return {"success": True, "message": "Gym workout manually marked complete for today.", "entry": entry.dict()}
