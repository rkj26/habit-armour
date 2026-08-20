import base64
import os
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.config import get_local_date_string
from app.database import get_session
from app.models.daily_entry import DailyEntry
from app.pillars.obsidian import sync_to_obsidian
from app.pillars.status import get_effective_config
from app.schemas import HabitLogRequest, PhotoUploadRequest, SyncEntryRequest

router = APIRouter(prefix="/api", tags=["Habits"])

UPLOADS_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)


@router.post("/log")
@router.post("/submit")
def submit_habit_log(payload: HabitLogRequest, session: Session = Depends(get_session)):
    window = payload.window
    date_str = payload.date or get_local_date_string()
    data = payload.data

    entry = session.exec(select(DailyEntry).where(DailyEntry.date == date_str)).first()
    if not entry:
        entry = DailyEntry(date=date_str)

    config = get_effective_config(session)

    if window == "morning":
        entry.morningCompleted = True
        entry.morningData = data
    elif window == "morningJournal":
        entry.morningJournalCompleted = True
        entry.morningJournalData = data
        if config.journalStorage in ["obsidian", "both"]:
            sync_to_obsidian(
                "morning", date_str, data, config.obsidianVaultPath, config.obsidianJournalFolder
            )
    elif window == "night":
        entry.nightCompleted = True
        entry.nightData = data
    elif window == "nightJournal":
        entry.nightJournalCompleted = True
        entry.nightJournalData = data
        if config.journalStorage in ["obsidian", "both"]:
            sync_to_obsidian("night", date_str, data, config.obsidianVaultPath, config.obsidianJournalFolder)
    elif window == "weekly":
        entry.weeklyCompleted = True
        entry.weeklyData = data
    else:
        raise HTTPException(status_code=400, detail=f"Unknown window: {window}")

    session.add(entry)
    session.commit()
    session.refresh(entry)
    return {"success": True, "entry": entry.model_dump()}


@router.get("/history")
def get_habit_history(session: Session = Depends(get_session)):
    entries = session.exec(select(DailyEntry).order_by(DailyEntry.date.desc())).all()
    return [e.model_dump() for e in entries]


@router.post("/sync-entry")
def manual_sync_entry(payload: SyncEntryRequest, session: Session = Depends(get_session)):
    # Local sync (Obsidian)
    date_str = payload.date
    window = payload.window

    entry = session.exec(select(DailyEntry).where(DailyEntry.date == date_str)).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    config = get_effective_config(session)
    if window == "morningJournal" and entry.morningJournalData:
        sync_to_obsidian(
            "morning",
            date_str,
            entry.morningJournalData,
            config.obsidianVaultPath,
            config.obsidianJournalFolder,
        )
    elif window == "nightJournal" and entry.nightJournalData:
        sync_to_obsidian(
            "night", date_str, entry.nightJournalData, config.obsidianVaultPath, config.obsidianJournalFolder
        )

    return {"success": True, "message": "Obsidian sync executed."}


@router.post("/upload-photo")
def upload_habit_photo(payload: PhotoUploadRequest):
    date_str = payload.date
    pose = payload.pose
    data_url = payload.dataUrl

    match = re.match(r"^data:image\/([a-zA-Z0-9]+);base64,(.+)$", data_url)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")

    ext = "jpg" if match.group(1) == "jpeg" else match.group(1)
    try:
        buffer = base64.b64decode(match.group(2))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode base64: {e}") from e

    safe_date = re.sub(r"[^a-zA-Z0-9_-]", "_", str(date_str))
    safe_pose = re.sub(r"[^a-zA-Z0-9_-]", "_", str(pose))
    timestamp = int(datetime.now().timestamp() * 1000)
    filename = f"photo_{safe_date}_{safe_pose}_{timestamp}.{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)

    os.makedirs(UPLOADS_DIR, exist_ok=True)
    with open(filepath, "wb") as f:
        f.write(buffer)

    return {"success": True, "url": f"/uploads/{filename}", "filename": filename}
