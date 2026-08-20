import os
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PORT: int = 3000
    DATABASE_URL: str = "sqlite:///habit_armour.db"
    
    # Defaults for habits & locking windows
    DEFAULT_MORNING_START: int = 5    # 5:00 AM
    DEFAULT_MORNING_END: int = 12     # 12:00 PM
    DEFAULT_NIGHT_START: int = 22     # 10:00 PM
    DEFAULT_NIGHT_END: int = 24       # 12:00 AM (midnight)
    DEFAULT_GRACE_PERIOD_SEC: int = 120
    
    # Obsidian Journaling
    JOURNAL_STORAGE: str = "obsidian" # "obsidian", "none"
    OBSIDIAN_VAULT_PATH: str = ""
    OBSIDIAN_JOURNAL_FOLDER: str = "Journal"
    
    # Gym & Activity
    GYM_LOCK_ENABLED: bool = True
    GYM_LOCK_START_HOUR: int = 21
    GYM_MIN_DURATION_MINUTES: int = 30
    GYM_ROUTINE_VERIFICATION_ENABLED: bool = True
    GYM_MIN_TOTAL_SETS: int = 12
    GYM_WEEKLY_GOAL: int = 5
    GYM_REQUIRE_NO_CONSECUTIVE_REST_DAYS: bool = True
    GYM_MIN_STEPS: int = 13000
    HEVY_API_KEY: Optional[str] = None
    
    # Weekly Review
    WEEKLY_LOCK_ENABLED: bool = True
    WEEKLY_LOCK_DAY: int = 0          # 0 = Sunday
    WEEKLY_LOCK_START_HOUR: int = 0
    WEEKLY_LOCK_END_HOUR: int = 24
    
    # Targets
    TARGET_WEIGHT: float = 75.0
    TARGET_PROTEIN: int = 150
    TARGET_STEPS: int = 13000
    TARGET_CALORIES: int = 2500
    
    # Anki
    ANKI_LOCK_ENABLED: bool = True
    ANKI_LOCK_START_HOUR: int = 21
    ANKI_CONNECT_URL: str = "http://localhost:8765"
    ANKI_IGNORED_DECKS: List[str] = []
    
    # Consistent Practice
    PRACTICE_LOCK_ENABLED: bool = True
    PRACTICE_LOCK_START_HOUR: int = 21
    PRACTICE_MIN_DUE_TO_UNLOCK: int = 1
    PRACTICE_DAILY_TARGET: int = 5
    PRACTICE_NEW_CARDS_PER_DAY: int = 1  # new TOPIC AREAS introduced per day (repurposed from raw card count)
    PRACTICE_REVIEW_TOPICS_PER_DAY: int = 1  # in-progress topic AREAS surfaced per day (most urgent first)
    GEMINI_API_KEY: Optional[str] = None
    
    # Allowed Website Hosts during Hardware Lock
    ALLOWED_WEBSITES: List[str] = [
        "myfitnesspal.com",
        "gemini.google.com",
        "claude.ai",
        "chatgpt.com",
        "chat.openai.com",
        "anthropic.com",
        "arxiv.org"
    ]
    
    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()

def get_local_date_string(dt: Optional[datetime] = None) -> str:
    """Logical day transitions at 4:00 AM (subtract 4 hours for night owls)."""
    if dt is None:
        dt = datetime.now()
    logical_dt = dt - timedelta(hours=4)
    return logical_dt.strftime("%Y-%m-%d")
