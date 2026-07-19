#!/bin/bash

# Configuration
PORT="${PORT:-3000}"
API_URL="${API_URL:-http://localhost:${PORT}/api/status}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:${PORT}}"

echo "Habit Armor Lock Agent started..."

while true; do
  # Fetch status from local server
  RESPONSE=$(curl -s --max-time 3 "$API_URL")
  CURL_STATUS=$?

  if [ $CURL_STATUS -ne 0 ] || [ -z "$RESPONSE" ]; then
    echo "Local server is unreachable (exit code: $CURL_STATUS). Retrying in 15 seconds..."
    sleep 15
    continue
  fi

  # Parse fields using simple grep patterns
  LOCKED=$(echo "$RESPONSE" | grep -o '"locked":true')
  WARNING=$(echo "$RESPONSE" | grep -o '"isWarning":true')
  REMAINING=$(echo "$RESPONSE" | grep -o '"secondsRemaining":[0-9]*' | cut -d: -f2)
  WINDOW=$(echo "$RESPONSE" | grep -o '"window":"[a-zA-Z]*"' | cut -d: -f2 | tr -d '"')

  if [ ! -z "$LOCKED" ]; then
    echo "LOCK ACTIVE: Habits not completed for [$WINDOW] window. Enforcing lock..."
    
    # Lock the screen initially if it's not already locked
    if ! ioreg -n Root -d1 -a | grep -A 1 "IOConsoleLocked" | grep -q "<true/>"; then
      osascript -e 'display notification "Habit lock active! Complete your '"$WINDOW"' log to unlock." with title "Habit Armor"'
      open "$FRONTEND_URL"
      pmset displaysleepnow
    fi
    
    WAS_LOCKED=true
    
    # Tight enforcement loop while the lock is active
    while true; do
      # 1. Fetch status to check if user has submitted the form and unlocked
      RESPONSE=$(curl -s --max-time 3 "$API_URL")
      CURL_STATUS=$?
      if [ $CURL_STATUS -eq 0 ] && [ ! -z "$RESPONSE" ]; then
        STILL_LOCKED=$(echo "$RESPONSE" | grep -o '"locked":true')
        if [ -z "$STILL_LOCKED" ]; then
          echo "STATUS: Habits completed. Unlocking device..."
          break
        fi
      fi
      
      # 2. Check if screen is locked
      if ioreg -n Root -d1 -a | grep -A 1 "IOConsoleLocked" | grep -q "<true/>"; then
        WAS_LOCKED=true
        sleep 1
        continue
      fi
      
      # 3. Screen is unlocked. Enforce single-webpage kiosk behavior.
      if [ "$WAS_LOCKED" = "true" ]; then
        # Just unlocked! Give 5 seconds grace to open the URL and let browser load/focus
        echo "Device unlocked. Opening habits page..."
        open "$FRONTEND_URL"
        WAS_LOCKED=false
        sleep 5
        continue
      fi
      
      # Determine active application and URL
      FRONT_APP=$(osascript -e 'tell application "System Events" to name of first process whose frontmost is true' 2>/dev/null)
      FRONT_APP=$(echo "$FRONT_APP" | xargs)
      
      IS_ALLOWED_BROWSER=false
      URL=""
      
      if [ "$FRONT_APP" = "Google Chrome" ]; then
        IS_ALLOWED_BROWSER=true
        URL=$(osascript -e 'tell application "Google Chrome" to if (count of windows) > 0 then get URL of active tab of first window' 2>/dev/null)
      elif [ "$FRONT_APP" = "Safari" ]; then
        IS_ALLOWED_BROWSER=true
        URL=$(osascript -e 'tell application "Safari" to if (count of windows) > 0 then get URL of front document' 2>/dev/null)
      elif [ "$FRONT_APP" = "Arc" ]; then
        IS_ALLOWED_BROWSER=true
        URL=$(osascript -e 'tell application "Arc" to if (count of windows) > 0 then get URL of active tab of first window' 2>/dev/null)
      elif [ "$FRONT_APP" = "Brave Browser" ]; then
        IS_ALLOWED_BROWSER=true
        URL=$(osascript -e 'tell application "Brave Browser" to if (count of windows) > 0 then get URL of active tab of first window' 2>/dev/null)
      elif [ "$FRONT_APP" = "Microsoft Edge" ]; then
        IS_ALLOWED_BROWSER=true
        URL=$(osascript -e 'tell application "Microsoft Edge" to if (count of windows) > 0 then get URL of active tab of first window' 2>/dev/null)
      fi
      
      # Normalize URL to check if it points to the local habit tracker
      IS_HABIT_URL=false
      CLEAN_HOST=$(echo "$FRONTEND_URL" | sed -E 's/https?:\/\///')
      if [[ "$URL" == *"$CLEAN_HOST"* ]] || [[ "$URL" == *"127.0.0.1:${PORT}"* ]] || [[ "$URL" == *":${PORT}"* ]]; then
        IS_HABIT_URL=true
      fi
      
      if [ "$IS_ALLOWED_BROWSER" = "true" ] && [ "$IS_HABIT_URL" = "true" ]; then
        # User is actively on the lock screen form. Let them be.
        sleep 1
      else
        # User tried to switch to another app/tab, or closed the browser. Lock immediately!
        echo "Lock violation: active app is [$FRONT_APP] with URL [$URL]. Re-locking..."
        open "$FRONTEND_URL"
        pmset displaysleepnow
        WAS_LOCKED=true
        sleep 1
      fi
    done
  elif [ ! -z "$WARNING" ]; then
    echo "WARNING: Habits incomplete for [$WINDOW]. $REMAINING seconds remaining..."
    
    # Send a macOS system notification
    osascript -e 'display notification "Complete your '"$WINDOW"' log! '"$REMAINING"'s remaining." with title "Habit Armor"'
    
    # Force open the browser tab if not already there
    open "$FRONTEND_URL"
    
    # Wait 15 seconds before checking again
    sleep 15
  else
    echo "STATUS: Habits completed or outside tracking window. Mac is unlocked."
    # Check again in 30 seconds
    sleep 30
  fi
done
