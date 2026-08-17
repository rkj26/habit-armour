import os
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional
from sqlmodel import Session, select
from app.config import settings
from app.models.daily_entry import DailyEntry
from app.models.config import AppConfigModel

def is_day_active(entry: Optional[DailyEntry], min_steps: int = 13000) -> bool:
    if not entry:
        return False
    if entry.gymCompleted:
        return True
    if entry.nightData:
        if entry.nightData.get("trainingDay") == "Yes":
            return True
        if entry.nightData.get("cardioPerformed") == "Yes":
            return True
        try:
            steps = int(entry.nightData.get("steps", 0))
            if steps >= min_steps:
                return True
        except (ValueError, TypeError):
            pass
    return False

def compute_weekly_activity(session: Session, today_str: str, config: AppConfigModel) -> Tuple[int, bool, bool]:
    """
    Returns (weekly_active_count, is_yesterday_active, is_today_mandatory).
    """
    today_dt = datetime.strptime(today_str, "%Y-%m-%d")
    day_idx = (today_dt.weekday()) # Monday = 0, Sunday = 6
    monday_dt = today_dt - timedelta(days=day_idx)
    min_steps = config.gymMinSteps or 13000

    weekly_active = 0
    for i in range(7):
        d_str = (monday_dt + timedelta(days=i)).strftime("%Y-%m-%d")
        entry = session.exec(select(DailyEntry).where(DailyEntry.date == d_str)).first()
        if is_day_active(entry, min_steps):
            weekly_active += 1

    yesterday_str = (today_dt - timedelta(days=1)).strftime("%Y-%m-%d")
    yesterday_entry = session.exec(select(DailyEntry).where(DailyEntry.date == yesterday_str)).first()
    is_yesterday_active = is_day_active(yesterday_entry, min_steps)

    days_remaining = 7 - day_idx # e.g. on Monday: 7 days remaining
    gym_goal = config.gymWeeklyGoal or 5
    is_mandatory = (weekly_active + days_remaining <= gym_goal) or (config.gymRequireNoConsecutiveRestDays and not is_yesterday_active)

    return weekly_active, is_yesterday_active, is_mandatory

async def verify_hevy_workout_today(api_key: Optional[str] = None) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    key = api_key or settings.HEVY_API_KEY or os.environ.get("HEVY_API_KEY")
    if not key:
        return False, None, "HEVY_API_KEY is not configured in .env"

    url = "https://api.hevyapp.com/v1/workouts"
    headers = {"api-key": key, "Accept": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url, headers=headers)
            if res.status_code != 200:
                return False, None, f"Hevy API Error: HTTP {res.status_code}"
            
            data = res.json()
            workouts = data.get("workouts", [])
            if not workouts:
                return False, None, "No workouts found on Hevy"

            # Check if latest workout is today
            today_str = datetime.utcnow().strftime("%Y-%m-%d")
            for w in workouts:
                start_time = w.get("start_time", "")
                if start_time.startswith(today_str):
                    return True, w, None

            return False, None, f"No workout found on Hevy for today ({today_str})"
    except Exception as e:
        return False, None, f"Hevy connection error: {str(e)}"
