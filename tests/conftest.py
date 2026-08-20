"""
Shared pytest fixtures. Points the app at a throwaway SQLite file (never the
real ~/.habitarmour/habit_armour.db or the repo's own db) by setting
DATABASE_URL before any `app.*` module is imported -- app/config.py reads it
at import time via `settings = Settings()`.
"""
import os
import tempfile

_tmp_dir = tempfile.mkdtemp(prefix="habit_armour_test_")
_tmp_db_path = os.path.join(_tmp_dir, "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db_path}"
os.environ.setdefault("GEMINI_API_KEY", "test-key-not-real")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import Session, delete  # noqa: E402

from app.database import engine, init_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.config import AppConfigModel  # noqa: E402
from app.models.daily_entry import DailyEntry  # noqa: E402
from app.models.study import StudyAttempt, StudyItem, StudyQuestion  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _setup_db():
    init_db()
    yield


@pytest.fixture(autouse=True)
def _clean_tables(_setup_db):
    """Every test starts with empty practice/config/daily-entry tables."""
    with Session(engine) as session:
        for model in (StudyAttempt, StudyQuestion, StudyItem, DailyEntry, AppConfigModel):
            session.exec(delete(model))
        session.commit()
    yield


@pytest.fixture()
def client(_clean_tables):
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def db_session(_clean_tables):
    with Session(engine) as session:
        yield session
