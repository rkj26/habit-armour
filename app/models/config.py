from typing import Optional, List
from sqlmodel import SQLModel, Field, JSON
from app.config import settings

class AppConfigModel(SQLModel, table=True):
    __tablename__ = "app_config"
    id: int = Field(default=1, primary_key=True)
    
    morningStart: int = Field(default_factory=lambda: settings.DEFAULT_MORNING_START)
    morningEnd: int = Field(default_factory=lambda: settings.DEFAULT_MORNING_END)
    nightStart: int = Field(default_factory=lambda: settings.DEFAULT_NIGHT_START)
    nightEnd: int = Field(default_factory=lambda: settings.DEFAULT_NIGHT_END)
    gracePeriodSec: int = Field(default_factory=lambda: settings.DEFAULT_GRACE_PERIOD_SEC)
    
    journalStorage: str = Field(default_factory=lambda: settings.JOURNAL_STORAGE)
    obsidianVaultPath: str = Field(default_factory=lambda: settings.OBSIDIAN_VAULT_PATH)
    obsidianJournalFolder: str = Field(default_factory=lambda: settings.OBSIDIAN_JOURNAL_FOLDER)
    
    gymLockEnabled: bool = Field(default_factory=lambda: settings.GYM_LOCK_ENABLED)
    gymLockStartHour: int = Field(default_factory=lambda: settings.GYM_LOCK_START_HOUR)
    gymMinDurationMinutes: int = Field(default_factory=lambda: settings.GYM_MIN_DURATION_MINUTES)
    gymRoutineVerificationEnabled: bool = Field(default_factory=lambda: settings.GYM_ROUTINE_VERIFICATION_ENABLED)
    gymMinTotalSets: int = Field(default_factory=lambda: settings.GYM_MIN_TOTAL_SETS)
    gymWeeklyGoal: int = Field(default_factory=lambda: settings.GYM_WEEKLY_GOAL)
    gymRequireNoConsecutiveRestDays: bool = Field(default_factory=lambda: settings.GYM_REQUIRE_NO_CONSECUTIVE_REST_DAYS)
    gymMinSteps: int = Field(default_factory=lambda: settings.GYM_MIN_STEPS)
    
    weeklyLockEnabled: bool = Field(default_factory=lambda: settings.WEEKLY_LOCK_ENABLED)
    weeklyLockDay: int = Field(default_factory=lambda: settings.WEEKLY_LOCK_DAY)
    weeklyLockStartHour: int = Field(default_factory=lambda: settings.WEEKLY_LOCK_START_HOUR)
    weeklyLockEndHour: int = Field(default_factory=lambda: settings.WEEKLY_LOCK_END_HOUR)
    
    targetWeight: float = Field(default_factory=lambda: settings.TARGET_WEIGHT)
    targetProtein: int = Field(default_factory=lambda: settings.TARGET_PROTEIN)
    targetSteps: int = Field(default_factory=lambda: settings.TARGET_STEPS)
    targetCalories: int = Field(default_factory=lambda: settings.TARGET_CALORIES)
    
    supplementsList: List[str] = Field(default=["Vitamin D3", "Vitamin K2", "Omega-3", "Creatine"], sa_type=JSON)
    enforceSupplementsBlocker: bool = Field(default=True)
    enforceProteinShakeBlocker: bool = Field(default=True)
    weeklyPhotosRequired: bool = Field(default=True)
    
    ankiLockEnabled: bool = Field(default_factory=lambda: settings.ANKI_LOCK_ENABLED)
    ankiLockStartHour: int = Field(default_factory=lambda: settings.ANKI_LOCK_START_HOUR)
    ankiConnectUrl: str = Field(default_factory=lambda: settings.ANKI_CONNECT_URL)
    ankiIgnoredDecks: List[str] = Field(default=[], sa_type=JSON)
    
    practiceLockEnabled: bool = Field(default_factory=lambda: settings.PRACTICE_LOCK_ENABLED)
    practiceLockStartHour: int = Field(default_factory=lambda: settings.PRACTICE_LOCK_START_HOUR)
    practiceMinDueToUnlock: int = Field(default_factory=lambda: settings.PRACTICE_MIN_DUE_TO_UNLOCK)
    practiceDailyTarget: int = Field(default_factory=lambda: settings.PRACTICE_DAILY_TARGET)
    practiceNewCardsPerDay: int = Field(default_factory=lambda: settings.PRACTICE_NEW_CARDS_PER_DAY)
