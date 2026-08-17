#!/bin/bash

# ==============================================================================
# Habit Armour macOS Lock Agent
# Monitors local habit status and enforces kiosk / screen locking when overdue.
# ==============================================================================

PORT="${PORT:-3000}"
API_URL="${API_URL:-http://localhost:${PORT}/api/status}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5174}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Habit Armour Lock Agent started on port ${PORT}..."

# Helper to trigger macOS lock screen immediately
lock_mac_screen() {
  # Trigger native lock screen via AppleScript keystroke
  osascript -e 'tell application "System Events" to keystroke "q" using {control down, command down}' 2>/dev/null
  # Put display to sleep as immediate fallback
  pmset displaysleepnow 2>/dev/null
}

# Helper to check if macOS screen is currently locked
is_screen_locked() {
  if ioreg -n Root -d1 -a 2>/dev/null | grep -A 1 "IOConsoleLocked" | grep -q "<true/>"; then
    return 0
  fi
  return 1
}

# Helper to check if a browser URL points to the Habit Armour dashboard/form
is_habit_url() {
  local u="$1"
  if [[ "$u" == *"localhost:3000"* ]] || [[ "$u" == *"localhost:5173"* ]] || [[ "$u" == *"localhost:5174"* ]] || \
     [[ "$u" == *"127.0.0.1:3000"* ]] || [[ "$u" == *"127.0.0.1:5173"* ]] || [[ "$u" == *"127.0.0.1:5174"* ]] || \
     [[ "$u" == *":${PORT}"* ]]; then
    return 0
  fi
  return 1
}

# Helper to parse status JSON cleanly via Node.js
parse_status_json() {
  local json="$1"
  node -e '
    try {
      const d = JSON.parse(process.argv[1]);
      const locked = d.locked === true ? "true" : "false";
      const isWarning = d.isWarning === true ? "true" : "false";
      const remaining = Number(d.secondsRemaining) || 0;
      const window = d.window || "habits";
      const reason = d.reason || "";
      const hasError = (d.error && d.error !== "null" && typeof d.error === "string") ? "true" : "false";
      console.log(`${locked}|${isWarning}|${remaining}|${window}|${hasError}|${reason}`);
    } catch (e) {
      console.log("false|false|0|habits|true|parse_error");
    }
  ' "$json" 2>/dev/null
}

WAS_LOCKED=false

while true; do
  # Fetch status from local server
  RESPONSE=$(curl -s --max-time 3 "$API_URL")
  CURL_STATUS=$?

  if [ $CURL_STATUS -ne 0 ] || [ -z "$RESPONSE" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Local server unreachable (exit code: $CURL_STATUS). Retrying in 10s..."
    sleep 10
    continue
  fi

  PARSED=$(parse_status_json "$RESPONSE")
  IFS='|' read -r LOCKED WARNING REMAINING WINDOW HAS_ERROR REASON <<< "$PARSED"

  if [ "$HAS_ERROR" = "true" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server error detected. Fail-safe unlock active."
    sleep 15
    continue
  fi

  if [ "$LOCKED" = "true" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] LOCK ACTIVE: $REASON"

    # Send notification and open frontend
    osascript -e 'display notification "Habit lock active! Complete your logs to unlock." with title "Habit Armour"' 2>/dev/null
    open "$FRONTEND_URL" 2>/dev/null || open "http://localhost:${PORT}" 2>/dev/null

    # If screen is not locked, lock it now
    if ! is_screen_locked; then
      lock_mac_screen
    fi

    WAS_LOCKED=true

    # Tight enforcement kiosk loop while locked
    while true; do
      # 1. Fetch current status
      RESPONSE=$(curl -s --max-time 3 "$API_URL")
      CURL_STATUS=$?

      if [ $CURL_STATUS -eq 0 ] && [ ! -z "$RESPONSE" ]; then
        PARSED=$(parse_status_json "$RESPONSE")
        IFS='|' read -r STILL_LOCKED STILL_WARNING STILL_REMAINING STILL_WINDOW STILL_ERROR STILL_REASON <<< "$PARSED"

        if [ "$STILL_LOCKED" != "true" ] || [ "$STILL_ERROR" = "true" ]; then
          echo "[$(date '+%Y-%m-%d %H:%M:%S')] STATUS: Habits completed or override applied. Mac unlocked!"
          WAS_LOCKED=false
          break
        fi
      fi

      # 2. If screen is locked, wait and continue monitoring
      if is_screen_locked; then
        WAS_LOCKED=true
        sleep 1
        continue
      fi

      # 3. User just entered password to unlock. Give grace period to focus browser.
      if [ "$WAS_LOCKED" = "true" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Device unlocked by user. Opening Habit Armour..."
        open "$FRONTEND_URL" 2>/dev/null || open "http://localhost:${PORT}" 2>/dev/null
        WAS_LOCKED=false
        sleep 5
        continue
      fi

      # 4. Enforce kiosk behavior: check frontmost application
      FRONT_APP=$(osascript -e 'tell application "System Events" to name of first process whose frontmost is true' 2>/dev/null | xargs)

      IS_ALLOWED=false
      ACTIVE_URL=""

      if [ "$FRONT_APP" = "Google Chrome" ]; then
        ACTIVE_URL=$(osascript -e 'tell application "Google Chrome" to if (count of windows) > 0 then get URL of active tab of first window' 2>/dev/null)
        if is_habit_url "$ACTIVE_URL"; then IS_ALLOWED=true; fi
      elif [ "$FRONT_APP" = "Safari" ]; then
        ACTIVE_URL=$(osascript -e 'tell application "Safari" to if (count of windows) > 0 then get URL of front document' 2>/dev/null)
        if is_habit_url "$ACTIVE_URL"; then IS_ALLOWED=true; fi
      elif [ "$FRONT_APP" = "Arc" ]; then
        ACTIVE_URL=$(osascript -e 'tell application "Arc" to if (count of windows) > 0 then get URL of active tab of first window' 2>/dev/null)
        if is_habit_url "$ACTIVE_URL"; then IS_ALLOWED=true; fi
      elif [ "$FRONT_APP" = "Brave Browser" ]; then
        ACTIVE_URL=$(osascript -e 'tell application "Brave Browser" to if (count of windows) > 0 then get URL of active tab of first window' 2>/dev/null)
        if is_habit_url "$ACTIVE_URL"; then IS_ALLOWED=true; fi
      elif [ "$FRONT_APP" = "Microsoft Edge" ]; then
        ACTIVE_URL=$(osascript -e 'tell application "Microsoft Edge" to if (count of windows) > 0 then get URL of active tab of first window' 2>/dev/null)
        if is_habit_url "$ACTIVE_URL"; then IS_ALLOWED=true; fi
      elif [ "$FRONT_APP" = "Anki" ] || [ "$FRONT_APP" = "Obsidian" ] || [ "$FRONT_APP" = "Antigravity IDE" ]; then
        IS_ALLOWED=true
      fi

      if [ "$IS_ALLOWED" = "true" ]; then
        # User is actively on Habit Armour, Anki, or writing journal. Allow interaction.
        sleep 1
      else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Kiosk violation: active app is [$FRONT_APP] (URL: $ACTIVE_URL). Re-locking..."
        open "$FRONTEND_URL" 2>/dev/null || open "http://localhost:${PORT}" 2>/dev/null
        lock_mac_screen
        WAS_LOCKED=true
        sleep 1
      fi
    done

  elif [ "$WARNING" = "true" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: [$WINDOW] log incomplete. $REMAINING seconds remaining."
    osascript -e 'display notification "Complete your '"$WINDOW"' log! '"$REMAINING"'s remaining." with title "Habit Armour"' 2>/dev/null
    sleep 15
  else
    # Mac is unlocked and outside active violation window
    sleep 10
  fi
done
