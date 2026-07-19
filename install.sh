#!/bin/bash

# Habits and Lock installer for macOS (Habit Armour)
echo "Installing Habit Armour..."

# Determine repository directory
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$PLIST_DIR"

# 1. Check node binary path
NODE_PATH=$(which node)
if [ -z "$NODE_PATH" ]; then
  echo "Error: Node.js was not found in your PATH."
  echo "Please install Node.js (https://nodejs.org) and try again."
  exit 1
fi
echo "Using Node.js at: $NODE_PATH"

# 2. Load port configuration from .env if present
PORT=3000
if [ -f "$REPO_DIR/.env" ]; then
  ENV_PORT=$(grep -v '^#' "$REPO_DIR/.env" | grep -E '^PORT=' | cut -d= -f2- | tr -d '[:space:]')
  if [ ! -z "$ENV_PORT" ]; then
    PORT="$ENV_PORT"
  fi
fi
echo "Configured Port: $PORT"

# 3. Install dependencies and build client if needed
echo "Installing server dependencies..."
cd "$REPO_DIR"
npm install --no-audit --no-fund

if [ ! -d "$REPO_DIR/client/dist" ]; then
  echo "Building client assets..."
  cd "$REPO_DIR/client"
  npm install --no-audit --no-fund
  npm run build
  cd "$REPO_DIR"
fi

# 4. Unload existing agents if running
echo "Unloading old launchd plists if loaded..."
launchctl unload "$PLIST_DIR/com.user.habitserver.plist" 2>/dev/null
launchctl unload "$PLIST_DIR/com.user.habitlock.plist" 2>/dev/null

# 5. Create lock agent home directory and copy script
mkdir -p "$HOME/.habitlock"
cp "$REPO_DIR/lock_agent.sh" "$HOME/.habitlock/"
chmod +x "$HOME/.habitlock/lock_agent.sh"

# 6. Generate plist files from templates
echo "Generating launchd plist files..."
sed -e "s|{{NODE_PATH}}|$NODE_PATH|g" \
    -e "s|{{REPO_DIR}}|$REPO_DIR|g" \
    "$REPO_DIR/com.user.habitserver.plist.template" > "$PLIST_DIR/com.user.habitserver.plist"

sed -e "s|{{HOME_DIR}}|$HOME|g" \
    -e "s|{{PORT}}|$PORT|g" \
    "$REPO_DIR/com.user.habitlock.plist.template" > "$PLIST_DIR/com.user.habitlock.plist"

chmod 644 "$PLIST_DIR/com.user.habitserver.plist"
chmod 644 "$PLIST_DIR/com.user.habitlock.plist"

# 7. Load plists
echo "Loading launchd background agents..."
launchctl load "$PLIST_DIR/com.user.habitserver.plist"
launchctl load "$PLIST_DIR/com.user.habitlock.plist"

echo "Habit Armour services loaded and installed successfully!"
echo "The Express Server and macOS Locking Agent are now active in the background."
echo "Open http://localhost:$PORT in your browser to view and track your logs."
