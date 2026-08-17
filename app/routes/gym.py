from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from app.database import get_session
from app.config import get_local_date_string
from app.pillars.status import get_effective_config, get_or_create_today_entry
from app.pillars.gym import verify_hevy_workout_today

router = APIRouter(prefix="/api/hevy", tags=["Gym / Hevy"])

@router.get("/status")
async def get_hevy_status(session: Session = Depends(get_session)):
    config = get_effective_config(session)
    entry = get_or_create_today_entry(session)
    success, workout, err = await verify_hevy_workout_today(config.hevyApiKey if hasattr(config, "hevyApiKey") else None)
    return {
        "success": True,
        "verified": entry.gymCompleted,
        "workoutData": entry.gymWorkoutData,
        "error": entry.gymVerificationError or err,
        "config": {
            "enabled": config.gymLockEnabled,
            "startHour": config.gymLockStartHour,
            "weeklyGoal": config.gymWeeklyGoal
        }
    }

@router.post("/verify-today")
async def verify_hevy_today(session: Session = Depends(get_session)):
    config = get_effective_config(session)
    entry = get_or_create_today_entry(session)
    
    success, workout, err = await verify_hevy_workout_today(config.hevyApiKey if hasattr(config, "hevyApiKey") else None)
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
