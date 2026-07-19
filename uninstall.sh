#!/bin/bash

# Habits and Lock uninstaller for macOS (Habit Armour)
echo "Uninstalling Habit Armour..."

PLIST_DIR="$HOME/Library/LaunchAgents"

# Unload services
echo "Stopping background agents..."
launchctl unload "$PLIST_DIR/com.user.habitserver.plist" 2>/dev/null
launchctl unload "$PLIST_DIR/com.user.habitlock.plist" 2>/dev/null

# Clean up files
echo "Removing launchd plists and agent script..."
rm -f "$PLIST_DIR/com.user.habitserver.plist"
rm -f "$PLIST_DIR/com.user.habitlock.plist"
rm -rf "$HOME/.habitlock"

echo "Habit Armour background services have been successfully stopped and uninstalled."
