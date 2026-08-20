from typing import Any

from sqlmodel import JSON, Field, SQLModel


class DailyEntry(SQLModel, table=True):
    __tablename__ = "daily_entries"

    date: str = Field(primary_key=True, index=True)  # "YYYY-MM-DD"

    # Morning
    morningCompleted: bool = Field(default=False)
    morningJournalCompleted: bool = Field(default=False)
    morningData: dict[str, Any] | None = Field(default=None, sa_type=JSON)
    morningJournalData: dict[str, Any] | None = Field(default=None, sa_type=JSON)

    # Night
    nightCompleted: bool = Field(default=False)
    nightJournalCompleted: bool = Field(default=False)
    nightData: dict[str, Any] | None = Field(default=None, sa_type=JSON)
    nightJournalData: dict[str, Any] | None = Field(default=None, sa_type=JSON)

    # Weekly
    weeklyCompleted: bool = Field(default=False)
    weeklyData: dict[str, Any] | None = Field(default=None, sa_type=JSON)

    # Gym
    gymCompleted: bool = Field(default=False)
    gymWorkoutData: dict[str, Any] | None = Field(default=None, sa_type=JSON)
    gymVerificationError: str | None = Field(default=None)

    # Anki
    ankiCompleted: bool = Field(default=False)
    ankiDecksData: dict[str, Any] | None = Field(default=None, sa_type=JSON)
    ankiVerificationError: str | None = Field(default=None)
    ankiManualOverride: bool = Field(default=False)
    ankiOverrideReason: str | None = Field(default=None)
    ankiTotalDue: int = Field(default=0)
    ankiReviewedToday: int = Field(default=0)

    # Consistent Practice
    practiceCompleted: bool = Field(default=False)
    practiceManualOverride: bool = Field(default=False)
    practiceOverrideReason: str | None = Field(default=None)
    practiceDueCount: int = Field(default=0)
    practiceCompletedCount: int = Field(default=0)
    practiceCompletedQuestionIds: list[str] = Field(default=[], sa_type=JSON)
