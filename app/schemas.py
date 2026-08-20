"""
Request body models.

Every route that used to take `payload: dict[str, Any]` takes one of these
instead. The point is not tidiness: an unvalidated body is how `morningStart`
became the string "abc" and made every later /api/status raise a 500, which
silently killed lock enforcement. FastAPI rejects a bad body with a 422 naming
the offending field before the handler ever runs.

Free-form blobs (a habit log's `data`, a Hevy workout) stay `dict[str, Any]` on
purpose -- their shape is owned by the frontend or by Hevy, not by us.
"""

import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

HabitWindow = Literal["morning", "morningJournal", "night", "nightJournal", "weekly"]
JournalWindow = Literal["morningJournal", "nightJournal"]


def _validate_logical_date(value: str) -> str:
    """
    A date reaching this app is a primary key *and* an Obsidian filename, so
    '../../notes/x' would write outside the vault. Shared by every model with a
    date field so a new route cannot forget the check.
    """
    if not DATE_RE.match(value):
        raise ValueError("must be in YYYY-MM-DD format")
    return value


# -----------------------------------------------------------------------------
# Habits
# -----------------------------------------------------------------------------


class HabitLogRequest(BaseModel):
    window: HabitWindow
    # Omitted means "today" -- resolved by the handler against the 4 AM logical day.
    date: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)

    @field_validator("date")
    @classmethod
    def check_date(cls, v: str | None) -> str | None:
        return _validate_logical_date(v) if v is not None else None


class SyncEntryRequest(BaseModel):
    date: str
    window: JournalWindow

    @field_validator("date")
    @classmethod
    def check_date(cls, v: str) -> str:
        return _validate_logical_date(v)


class PhotoUploadRequest(BaseModel):
    date: str
    pose: str = Field(min_length=1)
    dataUrl: str = Field(min_length=1)

    @field_validator("date")
    @classmethod
    def check_date(cls, v: str) -> str:
        return _validate_logical_date(v)


# -----------------------------------------------------------------------------
# Shared
# -----------------------------------------------------------------------------


class OverrideRequest(BaseModel):
    """Manual "I did this, trust me" override. Reason is optional but logged."""

    reason: str | None = None


# -----------------------------------------------------------------------------
# Gym / Hevy
# -----------------------------------------------------------------------------


class HevyWorkoutUpload(BaseModel):
    """
    Proxied straight to api.hevyapp.com, so Hevy owns the schema. Only the
    fields their API rejects a request without are pinned; anything else is
    forwarded untouched.
    """

    model_config = ConfigDict(extra="allow")

    title: str = Field(min_length=1)
    start_time: str
    end_time: str
    exercises: list[dict[str, Any]]
    description: str | None = None


# -----------------------------------------------------------------------------
# Consistent Practice
# -----------------------------------------------------------------------------


class StudyItemCreate(BaseModel):
    title: str = Field(min_length=1)
    type: Literal["topic", "paper"] = "topic"
    # Accepts a list or a comma-separated string; normalised by the validator.
    tags: list[str] = Field(default_factory=list)
    notes: str = ""
    paper: dict[str, Any] | None = None

    @field_validator("tags", mode="before")
    @classmethod
    def split_tags(cls, v: Any) -> Any:
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v


class StudyItemUpdate(BaseModel):
    """Partial update: only the fields present in the body are written."""

    title: str | None = None
    type: Literal["topic", "paper"] | None = None
    tags: list[str] | None = None
    notes: str | None = None
    paper: dict[str, Any] | None = None

    @field_validator("tags", mode="before")
    @classmethod
    def split_tags(cls, v: Any) -> Any:
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v


class QuestionCreate(BaseModel):
    itemId: str = Field(min_length=1)
    prompt: str = Field(min_length=1)
    answerTemplate: Literal["topic", "paper"] | None = None
    difficulty: Literal["Easy", "Medium", "Hard"] = "Medium"
    modelSolution: str | None = None
    keyTakeaways: list[str] = Field(default_factory=list)


class QuestionUpdate(BaseModel):
    prompt: str | None = None
    answerTemplate: Literal["topic", "paper"] | None = None
    difficulty: Literal["Easy", "Medium", "Hard"] | None = None
    active: bool | None = None
    modelSolution: str | None = None
    keyTakeaways: list[str] | None = None


class GenerateQuestionsRequest(BaseModel):
    itemId: str = Field(min_length=1)
    # Bounded: this fans out into one Gemini call on a personal, small-quota key.
    count: int = Field(default=8, ge=1, le=30)
    atomic: bool = False


class BalanceBacklogRequest(BaseModel):
    cardsPerDay: int = Field(default=5, ge=1, le=100)


class AttemptSubmit(BaseModel):
    questionId: str = Field(min_length=1)
    answerMarkdown: str = Field(min_length=1)

    @field_validator("answerMarkdown")
    @classmethod
    def not_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("answer cannot be blank")
        return stripped


class PracticeImageUpload(BaseModel):
    dataUrl: str = Field(min_length=1)
    questionId: str = "diagram"
