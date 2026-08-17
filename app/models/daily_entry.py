from typing import Optional, Dict, Any, List
from sqlmodel import SQLModel, Field, JSON

class DailyEntry(SQLModel, table=True):
    __tablename__ = "daily_entries"
    
    date: str = Field(primary_key=True, index=True) # "YYYY-MM-DD"
    
    # Morning
    morningCompleted: bool = Field(default=False)
    morningJournalCompleted: bool = Field(default=False)
    morningData: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON)
    morningJournalData: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON)
    
    # Night
    nightCompleted: bool = Field(default=False)
    nightJournalCompleted: bool = Field(default=False)
    nightData: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON)
    nightJournalData: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON)
    
    # Weekly
    weeklyCompleted: bool = Field(default=False)
    weeklyData: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON)
    
    # Gym
    gymCompleted: bool = Field(default=False)
    gymWorkoutData: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON)
    gymVerificationError: Optional[str] = Field(default=None)
    
    # Anki
    ankiCompleted: bool = Field(default=False)
    ankiDecksData: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON)
    ankiVerificationError: Optional[str] = Field(default=None)
    ankiManualOverride: bool = Field(default=False)
    ankiOverrideReason: Optional[str] = Field(default=None)
    ankiTotalDue: int = Field(default=0)
    ankiReviewedToday: int = Field(default=0)
    
    # Consistent Practice
    practiceCompleted: bool = Field(default=False)
    practiceManualOverride: bool = Field(default=False)
    practiceOverrideReason: Optional[str] = Field(default=None)
    practiceDueCount: int = Field(default=0)
    practiceCompletedCount: int = Field(default=0)
    practiceCompletedQuestionIds: List[str] = Field(default=[], sa_type=JSON)
