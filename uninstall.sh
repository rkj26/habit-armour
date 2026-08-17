#!/bin/bash

# ==============================================================================
# Habit Armour 2.0 Uninstaller for macOS
# ==============================================================================
echo "Uninstalling Habit Armour 2.0..."

PLIST_DIR="$HOME/Library/LaunchAgents"

# Unload services
echo "Stopping background agents..."
launchctl unload "$PLIST_DIR/com.user.habitserver.plist" 2>/dev/null
launchctl unload "$PLIST_DIR/com.user.habitlock.plist" 2>/dev/null

# Clean up files
echo "Removing launchd plists and ~/.habitarmour runtime..."
rm -f "$PLIST_DIR/com.user.habitserver.plist"
rm -f "$PLIST_DIR/com.user.habitlock.plist"
rm -rf "$HOME/.habitarmour"
rm -rf "$HOME/.habitlock"

echo "✅ Habit Armour 2.0 services stopped and uninstalled."
