from sqlmodel import SQLModel, create_engine, Session
from app.config import settings

# SQLite connection with WAL mode and multi-thread support
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False
)

def init_db():
    # Enable WAL mode for high concurrency
    with engine.connect() as conn:
        conn.exec_driver_sql("PRAGMA journal_mode=WAL;")
        conn.exec_driver_sql("PRAGMA synchronous=NORMAL;")
    SQLModel.metadata.create_all(engine)
    
    # Safe SQLite column migrations
    with engine.connect() as conn:
        try:
            info = conn.exec_driver_sql("PRAGMA table_info(study_questions);").fetchall()
            existing_cols = [row[1] for row in info]
            if "modelSolution" not in existing_cols:
                conn.exec_driver_sql("ALTER TABLE study_questions ADD COLUMN modelSolution TEXT;")
            if "keyTakeaways" not in existing_cols:
                conn.exec_driver_sql("ALTER TABLE study_questions ADD COLUMN keyTakeaways JSON;")
            if "stability" not in existing_cols:
                conn.exec_driver_sql("ALTER TABLE study_questions ADD COLUMN stability REAL DEFAULT 0.0;")
            # App Config migrations
            cfg_info = conn.exec_driver_sql("PRAGMA table_info(app_config);").fetchall()
            cfg_cols = [row[1] for row in cfg_info]
            if "practiceDailyTarget" not in cfg_cols:
                conn.exec_driver_sql("ALTER TABLE app_config ADD COLUMN practiceDailyTarget INTEGER DEFAULT 5;")
            if "practiceNewCardsPerDay" not in cfg_cols:
                conn.exec_driver_sql("ALTER TABLE app_config ADD COLUMN practiceNewCardsPerDay INTEGER DEFAULT 5;")
            conn.commit()
        except Exception as e:
            print(f"[init_db] Column migration notice: {e}")

def get_session():
    with Session(engine) as session:
        yield session
