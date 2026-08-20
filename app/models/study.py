from typing import Any

from sqlmodel import JSON, Field, SQLModel

from app.config import now_local


class StudyItem(SQLModel, table=True):
    __tablename__ = "study_items"

    id: str = Field(primary_key=True, index=True)
    type: str = Field(default="topic")  # "topic" or "paper"
    title: str = Field(index=True)
    tags: list[str] = Field(default=[], sa_type=JSON)
    notes: str | None = Field(default="")
    createdAt: str = Field(default_factory=lambda: now_local().isoformat())
    paper: dict[str, Any] | None = Field(default=None, sa_type=JSON)


class StudyQuestion(SQLModel, table=True):
    __tablename__ = "study_questions"

    id: str = Field(primary_key=True, index=True)
    itemId: str = Field(index=True, foreign_key="study_items.id")
    itemType: str = Field(default="topic")
    prompt: str
    answerTemplate: str = Field(default="topic")  # "topic" or "paper"
    difficulty: str = Field(default="Medium")
    source: str = Field(default="manual")  # "manual" or "gemini-generated"
    order: int = Field(default=0, index=True)  # position within itemId's scaffolded ladder (0 = first)
    active: bool = Field(default=True)

    # SM-2 & FSRS Spaced Repetition Fields
    easeFactor: float = Field(default=2.5)
    repetitions: int = Field(default=0)
    intervalDays: int = Field(default=0)
    dueDate: str = Field(index=True)  # "YYYY-MM-DD"
    lastReviewedAt: str | None = Field(default=None)

    # FSRS (Free Spaced Repetition Scheduler) DSR Fields
    stability: float = Field(default=0.0)  # S: Memory stability in days
    fsrsDifficulty: float = Field(default=5.0)  # D: Inherent difficulty (1.0 to 10.0)
    lapses: int = Field(default=0)  # Count of lapses (Again)
    state: int = Field(default=0)  # 0=New, 1=Learning, 2=Review, 3=Relearning

    # Cached Model Solution & Takeaways (Stored in DB forever)
    modelSolution: str | None = Field(default=None)
    keyTakeaways: list[str] | None = Field(default=None, sa_type=JSON)


class StudyAttempt(SQLModel, table=True):
    __tablename__ = "study_attempts"

    id: str = Field(primary_key=True, index=True)
    questionId: str = Field(index=True, foreign_key="study_questions.id")
    itemId: str = Field(index=True, foreign_key="study_items.id")
    submittedAt: str = Field(default_factory=lambda: now_local().isoformat())
    answerMarkdown: str
    evaluation: dict[str, Any] = Field(default={}, sa_type=JSON)
    geminiModel: str = Field(default="gemini-2.5-flash")
    evaluatedAt: str = Field(default_factory=lambda: now_local().isoformat())
