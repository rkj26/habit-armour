import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.migrate_json import migrate
from app.routes import anki, config, gym, habits, practice, status


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
    lifespan=lifespan,
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
CLIENT_DIST = os.path.realpath(os.path.join(os.getcwd(), "client", "dist"))


def resolve_static_file(full_path: str, root: str = CLIENT_DIST) -> str | None:
    """
    Maps a request path to an existing file inside `root`, or None if it escapes.
    Percent-encoded traversal (`/%2e%2e%2f.env`) survives URL parsing and arrives
    here as `../.env`, so containment is checked after resolving symlinks.
    """
    root = os.path.realpath(root)
    candidate = os.path.realpath(os.path.join(root, full_path))
    if candidate != root and not candidate.startswith(root + os.sep):
        return None
    return candidate if os.path.isfile(candidate) else None


if os.path.exists(CLIENT_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(CLIENT_DIST, "assets")), name="static_assets")

    INDEX_FILE = os.path.join(CLIENT_DIST, "index.html")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # The SPA fallback must not swallow unmatched API routes into a 200 index.html
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        return FileResponse(resolve_static_file(full_path) or INDEX_FILE)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
