from datetime import UTC, datetime, timedelta

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PORT: int = 3000
    # Loopback by default: the API has no auth layer, so binding it to 0.0.0.0
    # publishes every write endpoint to the local network. Set HOST=0.0.0.0 in
    # .env to re-enable the iOS remote-status URL shown in the sidebar.
    HOST: str = "127.0.0.1"
    DATABASE_URL: str = "sqlite:///habit_armour.db"

    # Defaults for habits & locking windows
    DEFAULT_MORNING_START: int = 5  # 5:00 AM
    DEFAULT_MORNING_END: int = 12  # 12:00 PM
    DEFAULT_NIGHT_START: int = 22  # 10:00 PM
    DEFAULT_NIGHT_END: int = 24  # 12:00 AM (midnight)
    DEFAULT_GRACE_PERIOD_SEC: int = 120

    # Obsidian Journaling
    JOURNAL_STORAGE: str = "obsidian"  # "obsidian", "none"
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
    HEVY_API_KEY: str | None = None

    # Weekly Review
    WEEKLY_LOCK_ENABLED: bool = True
    WEEKLY_LOCK_DAY: int = 0  # 0 = Sunday
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
    ANKI_IGNORED_DECKS: list[str] = []

    # Consistent Practice
    PRACTICE_LOCK_ENABLED: bool = True
    PRACTICE_LOCK_START_HOUR: int = 21
    PRACTICE_MIN_DUE_TO_UNLOCK: int = 1
    PRACTICE_DAILY_TARGET: int = 5
    PRACTICE_NEW_CARDS_PER_DAY: int = 1  # new TOPIC AREAS introduced per day (repurposed from raw card count)
    PRACTICE_REVIEW_TOPICS_PER_DAY: int = 1  # in-progress topic AREAS surfaced per day (most urgent first)
    GEMINI_API_KEY: str | None = None

    # Allowed Website Hosts during Hardware Lock
    ALLOWED_WEBSITES: list[str] = [
        "myfitnesspal.com",
        "gemini.google.com",
        "claude.ai",
        "chatgpt.com",
        "chat.openai.com",
        "anthropic.com",
        "arxiv.org",
    ]

    model_config = SettingsConfigDict(env_file=".env", extra="allow")


settings = Settings()

LOGICAL_DAY_START_HOUR = 4


def now_local() -> datetime:
    """Timezone-aware 'now' in the machine's local zone."""
    return datetime.now().astimezone()


def get_local_date_string(dt: datetime | None = None) -> str:
    """Logical day transitions at 4:00 AM (subtract 4 hours for night owls)."""
    if dt is None:
        dt = now_local()
    logical_dt = dt - timedelta(hours=LOGICAL_DAY_START_HOUR)
    return logical_dt.strftime("%Y-%m-%d")


def parse_timestamp(iso_ts: str | None) -> datetime | None:
    """
    Parses a stored ISO timestamp into local time. Timestamps written before the
    clock was unified are naive UTC (datetime.utcnow), so naive values are read
    as UTC rather than as local wall-clock.
    """
    if not iso_ts:
        return None
    try:
        parsed = datetime.fromisoformat(str(iso_ts).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone()


def logical_date_of(iso_ts: str | None) -> str | None:
    """The logical (4 AM rollover) date a stored timestamp belongs to."""
    parsed = parse_timestamp(iso_ts)
    return get_local_date_string(parsed) if parsed else None


def elapsed_logical_days(last_iso: str | None, today_str: str) -> int:
    """Whole logical days between a stored timestamp and a logical date string."""
    last_date = logical_date_of(last_iso)
    if not last_date:
        return 0
    try:
        last_day = datetime.strptime(last_date, "%Y-%m-%d").date()
        today_day = datetime.strptime(today_str, "%Y-%m-%d").date()
    except ValueError:
        return 0
    return max(0, (today_day - last_day).days)
