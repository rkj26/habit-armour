from typing import Any

from sqlmodel import Session, select

from app.config import get_local_date_string, now_local, settings
from app.models.config import AppConfigModel
from app.models.daily_entry import DailyEntry
from app.models.study import StudyQuestion
from app.pillars.anki import check_anki_status_cached
from app.pillars.gym import compute_weekly_activity
from app.pillars.practice import is_practice_satisfied

# In-memory test lock state
test_lock_active = False
test_lock_expires_at = 0.0


def set_test_lock(duration_sec: int = 15):
    global test_lock_active, test_lock_expires_at
    test_lock_active = True
    test_lock_expires_at = now_local().timestamp() + duration_sec


def get_effective_config(session: Session) -> AppConfigModel:
    cfg = session.exec(select(AppConfigModel).where(AppConfigModel.id == 1)).first()
    if not cfg:
        cfg = AppConfigModel(id=1)
        session.add(cfg)
        session.commit()
        session.refresh(cfg)
    return cfg


def get_or_create_today_entry(session: Session, today_str: str | None = None) -> DailyEntry:
    today = today_str or get_local_date_string()
    entry = session.exec(select(DailyEntry).where(DailyEntry.date == today)).first()
    if not entry:
        entry = DailyEntry(date=today)
        session.add(entry)
        session.commit()
        session.refresh(entry)
    return entry


async def compute_status(session: Session) -> dict[str, Any]:
    global test_lock_active, test_lock_expires_at

    # 1. Check test lock
    now_ts = now_local().timestamp()
    if test_lock_active:
        if now_ts < test_lock_expires_at:
            return {
                "locked": True,
                "isWarning": False,
                "secondsRemaining": 0,
                "window": "test",
                "reason": "Test lock active (15-second simulation)",
                "completed": False,
                "error": None,
            }
        else:
            test_lock_active = False
            test_lock_expires_at = 0.0

    config = get_effective_config(session)
    today = get_local_date_string()
    entry = get_or_create_today_entry(session, today)

    now = now_local()
    hour = now.hour
    day_of_week = now.weekday()  # 0 = Monday, 6 = Sunday

    pending_windows: list[str] = []
    entry_dirty = False

    # 1. Morning Window (e.g. 5 AM - 12 PM)
    if config.morningStart <= hour < config.morningEnd:
        if not entry.morningCompleted:
            pending_windows.append("morning")
        elif not entry.morningJournalCompleted:
            pending_windows.append("morningJournal")

    # 2. Night Window (e.g. 10 PM - 12 AM)
    if config.nightStart <= hour < config.nightEnd:
        if not entry.nightCompleted:
            pending_windows.append("night")
        elif not entry.nightJournalCompleted:
            pending_windows.append("nightJournal")

    # 3. Weekly Review (Sunday)
    weekly_day = 6 if config.weeklyLockDay == 0 else (config.weeklyLockDay - 1)
    if (
        config.weeklyLockEnabled
        and day_of_week == weekly_day
        and config.weeklyLockStartHour <= hour < config.weeklyLockEndHour
        and not entry.weeklyCompleted
    ):
        pending_windows.append("weekly")

    # 4. Gym & Steps Check
    weekly_active, is_yesterday_active, is_mandatory = compute_weekly_activity(session, today, config)
    if is_mandatory and not entry.gymCompleted and config.gymLockEnabled and hour >= config.gymLockStartHour:
        pending_windows.append("gym")

    # 5. Anki Flashcards Check
    if (
        config.ankiLockEnabled
        and hour >= config.ankiLockStartHour
        and not entry.ankiCompleted
        and not entry.ankiManualOverride
    ):
        # Cached poll: this runs on every status read, including the daemon's ~1.5s loop
        reachable, verified, total_due, rev_today, _, anki_err = await check_anki_status_cached(config)
        if (entry.ankiTotalDue, entry.ankiReviewedToday, entry.ankiVerificationError) != (
            total_due,
            rev_today,
            anki_err,
        ):
            entry.ankiTotalDue = total_due
            entry.ankiReviewedToday = rev_today
            entry.ankiVerificationError = anki_err
            entry_dirty = True

        if verified:
            entry.ankiCompleted = True
            entry_dirty = True
        else:
            pending_windows.append("anki")

    # 6. Consistent Practice Check
    if (
        config.practiceLockEnabled
        and hour >= config.practiceLockStartHour
        and not entry.practiceCompleted
        and not entry.practiceManualOverride
    ):
        due_count = len(
            session.exec(
                select(StudyQuestion.id).where(StudyQuestion.active == True, StudyQuestion.dueDate <= today)
            ).all()
        )
        if entry.practiceDueCount != due_count:
            entry.practiceDueCount = due_count
            entry_dirty = True

        if is_practice_satisfied(entry, due_count, config.practiceMinDueToUnlock):
            entry.practiceCompleted = True
            entry_dirty = True
        else:
            pending_windows.append("practice")

    # Single write per status read, and only when something actually changed
    if entry_dirty:
        session.add(entry)
        session.commit()
        session.refresh(entry)

    lock_count = len(pending_windows)
    locked = lock_count > 0
    active_window = pending_windows[0] if locked else None

    if locked:
        if active_window == "gym":
            reason = f"Physical activity goal unmet ({weekly_active}/{config.gymWeeklyGoal} active days). Complete workout or steps to unlock."
        elif active_window == "anki":
            reason = f"Anki flashcards incomplete ({entry.ankiTotalDue} due cards remaining). Complete reviews or submit manual override."
        elif active_window == "practice":
            reason = f"Consistent Practice incomplete ({entry.practiceDueCount} due questions remaining). Complete active recall review or submit override."
        else:
            reason = f"Device locked ({lock_count} active breach{'es' if lock_count > 1 else ''}). Complete your {active_window} log to unlock."

        return {
            "locked": True,
            "lockCount": lock_count,
            "pendingWindows": pending_windows,
            "weeklyActiveCount": weekly_active,
            "gymWeeklyGoal": config.gymWeeklyGoal,
            "isYesterdayActive": is_yesterday_active,
            "isTodayMandatory": is_mandatory,
            "isWarning": False,
            "secondsRemaining": 0,
            "window": active_window,
            "reason": reason,
            "completed": False,
            "error": (
                entry.ankiVerificationError
                if active_window == "anki"
                else (entry.gymVerificationError if active_window == "gym" else None)
            ),
            "allowedWebsites": getattr(config, "allowedWebsites", None) or list(settings.ALLOWED_WEBSITES),
            "entry": entry.model_dump(),
        }

    return {
        "locked": False,
        "lockCount": 0,
        "pendingWindows": [],
        "weeklyActiveCount": weekly_active,
        "gymWeeklyGoal": config.gymWeeklyGoal,
        "isYesterdayActive": is_yesterday_active,
        "isTodayMandatory": is_mandatory,
        "isWarning": False,
        "secondsRemaining": 0,
        "window": None,
        "reason": "Device usable. All logs for current period completed.",
        "completed": True,
        "error": None,
        "allowedWebsites": getattr(config, "allowedWebsites", None) or list(settings.ALLOWED_WEBSITES),
        "entry": entry.model_dump(),
    }
