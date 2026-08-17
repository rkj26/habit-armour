import os
import json
from sqlmodel import Session, select
from app.database import engine, init_db
from app.models.config import AppConfigModel
from app.models.daily_entry import DailyEntry
from app.models.study import StudyItem, StudyQuestion, StudyAttempt

def migrate():
    init_db()
    with Session(engine) as session:
        # 1. Migrate Habits & Config from habits_data.json
        habits_file = "habits_data.json"
        if os.path.exists(habits_file):
            print(f"[migration] Found {habits_file}, importing data...")
            try:
                with open(habits_file, "r", encoding="utf-8") as f:
                    habits_data = json.load(f)
                
                # Import Config
                config_data = habits_data.get("config", {})
                existing_cfg = session.exec(select(AppConfigModel).where(AppConfigModel.id == 1)).first()
                if not existing_cfg:
                    cfg_obj = AppConfigModel(id=1, **{k: v for k, v in config_data.items() if hasattr(AppConfigModel, k)})
                    session.add(cfg_obj)
                
                # Import Daily Entries
                entries_data = habits_data.get("entries", {})
                for date_str, entry_dict in entries_data.items():
                    existing_entry = session.exec(select(DailyEntry).where(DailyEntry.date == date_str)).first()
                    if not existing_entry:
                        clean_entry = {k: v for k, v in entry_dict.items() if hasattr(DailyEntry, k)}
                        session.add(DailyEntry(**clean_entry))
                
                session.commit()
                print(f"[migration] Successfully migrated {len(entries_data)} daily entries.")
            except Exception as e:
                print(f"[migration] Error importing habits_data.json: {e}")

        # 2. Migrate Study Data from study_data.json
        study_file = "study_data.json"
        if os.path.exists(study_file):
            print(f"[migration] Found {study_file}, importing data...")
            try:
                with open(study_file, "r", encoding="utf-8") as f:
                    study_data = json.load(f)
                
                # Items
                items_dict = study_data.get("items", {})
                for item_id, item in items_dict.items():
                    if not session.exec(select(StudyItem).where(StudyItem.id == item_id)).first():
                        session.add(StudyItem(**item))
                
                # Questions
                questions_dict = study_data.get("questions", {})
                for q_id, q in questions_dict.items():
                    if not session.exec(select(StudyQuestion).where(StudyQuestion.id == q_id)).first():
                        sm2 = q.get("sm2", {})
                        q_data = {
                            "id": q["id"],
                            "itemId": q["itemId"],
                            "itemType": q.get("itemType", "topic"),
                            "prompt": q["prompt"],
                            "answerTemplate": q.get("answerTemplate", "topic"),
                            "difficulty": q.get("difficulty", "Medium"),
                            "source": q.get("source", "manual"),
                            "active": q.get("active", True),
                            "easeFactor": sm2.get("easeFactor", 2.5),
                            "repetitions": sm2.get("repetitions", 0),
                            "intervalDays": sm2.get("intervalDays", 0),
                            "dueDate": sm2.get("dueDate", "2026-08-17"),
                            "lastReviewedAt": sm2.get("lastReviewedAt")
                        }
                        session.add(StudyQuestion(**q_data))
                
                # Attempts
                attempts_dict = study_data.get("attempts", {})
                for att_id, att in attempts_dict.items():
                    if not session.exec(select(StudyAttempt).where(StudyAttempt.id == att_id)).first():
                        session.add(StudyAttempt(**att))
                
                session.commit()
                print(f"[migration] Successfully migrated {len(items_dict)} study items, {len(questions_dict)} questions, {len(attempts_dict)} attempts.")
            except Exception as e:
                print(f"[migration] Error importing study_data.json: {e}")

if __name__ == "__main__":
    migrate()
