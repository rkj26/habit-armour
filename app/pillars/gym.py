import os
from datetime import datetime, timedelta
from typing import Any

import httpx
from sqlmodel import Session, select

from app.config import get_local_date_string, logical_date_of, settings
from app.models.config import AppConfigModel
from app.models.daily_entry import DailyEntry


def is_day_active(entry: DailyEntry | None, min_steps: int = 13000) -> bool:
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


def compute_weekly_activity(
    session: Session, today_str: str, config: AppConfigModel
) -> tuple[int, bool, bool]:
    """
    Returns (weekly_active_count, is_yesterday_active, is_today_mandatory).
    """
    today_dt = datetime.strptime(today_str, "%Y-%m-%d")
    day_idx = today_dt.weekday()  # Monday = 0, Sunday = 6
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

    days_remaining = 7 - day_idx  # e.g. on Monday: 7 days remaining
    gym_goal = config.gymWeeklyGoal or 5
    is_mandatory = (weekly_active + days_remaining <= gym_goal) or (
        config.gymRequireNoConsecutiveRestDays and not is_yesterday_active
    )

    return weekly_active, is_yesterday_active, is_mandatory


async def verify_hevy_workout_today(
    api_key: str | None = None,
) -> tuple[bool, dict[str, Any] | None, str | None]:
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

            # "Today" must be the same logical 4 AM-rollover day the lock uses,
            # not the UTC calendar date -- Hevy returns UTC start times, so an
            # evening or post-midnight workout otherwise lands on the wrong day.
            today_str = get_local_date_string()
            for w in workouts:
                if logical_date_of(w.get("start_time", "")) == today_str:
                    return True, w, None

            return False, None, f"No workout found on Hevy for today ({today_str})"
    except Exception as e:
        return False, None, f"Hevy connection error: {str(e)}"
