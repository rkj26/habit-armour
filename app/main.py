import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.database import init_db
from app.migrate_json import migrate
from app.routes import status, config, habits, gym, anki, practice

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB & auto-migrate JSON on startup
    init_db()
    try:
        migrate()
    except Exception as e:
        print(f"[lifespan] Migration notice: {e}")
    yield

app = FastAPI(
    title="Habit Armour API",
    description="Python FastAPI backend with SQLite and PyObjC Lock Enforcer",
    version="2.0.0",
    lifespan=lifespan
)

# CORS - local-only app, no cookies/auth in use. In practice the Vite dev
# server proxies /api and /uploads to port 3000 (see client/vite.config.js),
# and the deployed app serves client + API same-origin, so this mostly guards
# against a stray browser tab on another origin hitting the local API directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(status.router)
app.include_router(config.router)
app.include_router(habits.router)
app.include_router(gym.router)
app.include_router(anki.router)
app.include_router(practice.router)

# Mount Uploads directory
UPLOADS_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# Serve React frontend if dist exists
CLIENT_DIST = os.path.join(os.getcwd(), "client", "dist")
if os.path.exists(CLIENT_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(CLIENT_DIST, "assets")), name="static_assets")
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(CLIENT_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(CLIENT_DIST, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=3000, reload=True)
