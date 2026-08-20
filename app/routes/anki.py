from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.database import get_session
from app.pillars.anki import check_anki_status, check_anki_status_cached, invalidate_anki_cache
from app.pillars.status import get_effective_config, get_or_create_today_entry
from app.schemas import OverrideRequest

router = APIRouter(prefix="/api/anki", tags=["Anki"])


@router.get("/status")
async def get_anki_status(session: Session = Depends(get_session)):
    config = get_effective_config(session)
    entry = get_or_create_today_entry(session)
    reachable, verified, total_due, rev_today, decks, err = await check_anki_status_cached(config)

    return {
        "success": True,
        "reachable": reachable,
        "verified": entry.ankiCompleted or entry.ankiManualOverride,
        "manualOverride": entry.ankiManualOverride,
        "overrideReason": entry.ankiOverrideReason,
        "reason": err or (f"{total_due} due cards remaining." if total_due > 0 else "All decks reviewed!"),
        "decks": decks,
        "totalDue": total_due,
        "reviewedToday": rev_today,
        "incompleteDecks": [d["name"] for d in decks if d["due"] > 0],
        "config": {
            "enabled": config.ankiLockEnabled,
            "startHour": config.ankiLockStartHour,
            "ankiConnectUrl": config.ankiConnectUrl,
            "ignoredDecks": config.ankiIgnoredDecks,
        },
    }


@router.post("/verify")
async def verify_anki_today(session: Session = Depends(get_session)):
    config = get_effective_config(session)
    entry = get_or_create_today_entry(session)

    # Explicit user action: always hit Anki, and refresh what polling reads next
    invalidate_anki_cache()
    reachable, verified, total_due, rev_today, decks, err = await check_anki_status(config)
    entry.ankiTotalDue = total_due
    entry.ankiReviewedToday = rev_today
    entry.ankiDecksData = {"decks": decks}
    entry.ankiVerificationError = err

    if verified:
        entry.ankiCompleted = True
    session.add(entry)
    session.commit()
    session.refresh(entry)

    return {
        "success": True,
        "reachable": reachable,
        "verified": entry.ankiCompleted,
        "totalDue": total_due,
        "reviewedToday": rev_today,
        "error": err,
    }


@router.post("/override")
def override_anki_today(payload: OverrideRequest, session: Session = Depends(get_session)):
    entry = get_or_create_today_entry(session)
    reason = payload.reason or "Manual Anki override applied"
    entry.ankiManualOverride = True
    entry.ankiCompleted = True
    entry.ankiOverrideReason = reason
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return {
        "success": True,
        "message": "Anki requirement manually marked complete for today.",
        "entry": entry.model_dump(),
    }


@router.post("/reset-override")
def reset_anki_override(session: Session = Depends(get_session)):
    entry = get_or_create_today_entry(session)
    entry.ankiManualOverride = False
    entry.ankiOverrideReason = None
    entry.ankiCompleted = entry.ankiTotalDue == 0 and entry.ankiVerificationError is None
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return {"success": True, "message": "Anki override reset."}
