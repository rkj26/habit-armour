#!/bin/bash

# ==============================================================================
# Habit Armour Installer for macOS (Python FastAPI + SQLite + PyObjC)
# Deploys runtime to ~/.habitarmour to bypass macOS ~/Documents TCC restrictions.
# ==============================================================================
echo "Installing Habit Armour 2.0..."

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$HOME/.habitarmour"
PLIST_DIR="$HOME/Library/LaunchAgents"

mkdir -p "$APP_DIR"
mkdir -p "$PLIST_DIR"

# 1. Check Python 3
PYTHON_BIN=$(which python3)
if [ -z "$PYTHON_BIN" ]; then
  echo "Error: Python 3 was not found in your PATH."
  echo "Please install Python 3 and try again."
  exit 1
fi
echo "Using Python: $PYTHON_BIN"

# 2. Load port and bind host from .env if present
PORT=3000
HOST=127.0.0.1
if [ -f "$REPO_DIR/.env" ]; then
  ENV_PORT=$(grep -v '^#' "$REPO_DIR/.env" | grep -E '^PORT=' | cut -d= -f2- | tr -d '[:space:]')
  if [ ! -z "$ENV_PORT" ]; then
    PORT="$ENV_PORT"
  fi
  ENV_HOST=$(grep -v '^#' "$REPO_DIR/.env" | grep -E '^HOST=' | cut -d= -f2- | tr -d '[:space:]')
  if [ ! -z "$ENV_HOST" ]; then
    HOST="$ENV_HOST"
  fi
fi
echo "Configured Port: $PORT"
echo "Bind Host: $HOST"
if [ "$HOST" != "127.0.0.1" ] && [ "$HOST" != "localhost" ]; then
  echo "  ⚠️  The API has no auth layer. Binding to $HOST exposes every endpoint to your network."
fi

# 3. Build React Client Assets
if [ -d "$REPO_DIR/client" ]; then
  echo "Building client assets..."
  cd "$REPO_DIR/client"
  npm install --no-audit --no-fund --quiet
  npm run build
  cd "$REPO_DIR"
fi

# 4. Sync Application Files to ~/.habitarmour (Preserving SQLite DB, uploads, and logs)
echo "Deploying files to $APP_DIR..."
rsync -av --delete \
  --exclude '.venv' \
  --exclude 'node_modules' \
  --exclude 'client/node_modules' \
  --exclude '.git' \
  --exclude 'habit_armour.db*' \
  --exclude '*.db' \
  --exclude '*.db-wal' \
  --exclude '*.db-shm' \
  --exclude 'uploads' \
  --exclude '*.log' \
  --exclude '*.err' \
  "$REPO_DIR/" "$APP_DIR/" >/dev/null

# Copy .env if present
if [ -f "$REPO_DIR/.env" ]; then
  cp "$REPO_DIR/.env" "$APP_DIR/.env"
fi

# 5. Create Virtual Environment in ~/.habitarmour & Install Dependencies
echo "Setting up Python virtual environment in $APP_DIR/.venv..."
if [ ! -d "$APP_DIR/.venv" ]; then
  python3 -m venv "$APP_DIR/.venv"
fi

"$APP_DIR/.venv/bin/pip" install --upgrade pip --quiet
# Prefer the pinned lockfile so deploys are reproducible; fall back to loose pins.
if [ -f "$APP_DIR/requirements.lock.txt" ]; then
  echo "Installing pinned dependencies from requirements.lock.txt..."
  "$APP_DIR/.venv/bin/pip" install -r "$APP_DIR/requirements.lock.txt" --quiet
else
  "$APP_DIR/.venv/bin/pip" install -r "$APP_DIR/requirements.txt" --quiet
fi

# 6. Run SQLite Migration
echo "Migrating data to SQLite in $APP_DIR..."
cd "$APP_DIR"
PYTHONPATH="$APP_DIR" "$APP_DIR/.venv/bin/python" "$APP_DIR/app/migrate_json.py"
cd "$REPO_DIR"

# 7. Unload existing launchd agents
echo "Unloading previous launchd agents..."
launchctl unload "$PLIST_DIR/com.user.habitserver.plist" 2>/dev/null
launchctl unload "$PLIST_DIR/com.user.habitlock.plist" 2>/dev/null

# 8. Generate plist files from templates
echo "Generating launchd plist files..."
sed -e "s|{{HOME_DIR}}|$HOME|g" \
    -e "s|{{PORT}}|$PORT|g" \
    -e "s|{{HOST}}|$HOST|g" \
    "$REPO_DIR/com.user.habitserver.plist.template" > "$PLIST_DIR/com.user.habitserver.plist"

sed -e "s|{{HOME_DIR}}|$HOME|g" \
    -e "s|{{PORT}}|$PORT|g" \
    "$REPO_DIR/com.user.habitlock.plist.template" > "$PLIST_DIR/com.user.habitlock.plist"

chmod 644 "$PLIST_DIR/com.user.habitserver.plist"
chmod 644 "$PLIST_DIR/com.user.habitlock.plist"

# 9. Load and start services
echo "Loading background launchd agents..."
launchctl load "$PLIST_DIR/com.user.habitserver.plist"
launchctl load "$PLIST_DIR/com.user.habitlock.plist"

echo "✅ Habit Armour 2.0 installed successfully!"
echo "🚀 Backend: FastAPI + SQLite running on http://localhost:$PORT"
echo "🔒 Lock Daemon: Native PyObjC agent active in background"
