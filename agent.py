#!/usr/bin/env python3
"""
Habit Armour Native macOS Lock Daemon (PyObjC)
Monitors local habit status and enforces kiosk / screen locking when overdue.
Designed for non-disruptive, reliable kiosk operation without page reloads.
"""

import time
import os
import subprocess
import httpx
from datetime import datetime
from AppKit import NSWorkspace

PORT = int(os.environ.get("PORT", "3000"))
API_URL = f"http://127.0.0.1:{PORT}/api/status"
FRONTEND_URL = f"http://127.0.0.1:{PORT}"

ALLOWED_APPS = {
    "Anki", "Obsidian", "Antigravity IDE", "Terminal", "iTerm2", "Alacritty", "Ghostty"
}

ALLOWED_BROWSERS = {
    "Google Chrome", "Safari", "Arc", "Brave Browser", "Microsoft Edge", "Firefox", "Opera", "Orion", "Vivaldi"
}

ALLOWED_URL_HOSTS = {
    f"localhost:{PORT}", f"127.0.0.1:{PORT}",
    "localhost:5173", "localhost:5174",
    "127.0.0.1:5173", "127.0.0.1:5174"
}

def log(msg: str):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)

def lock_mac_screen():
    """Triggers macOS native lock screen cleanly without cutting display power."""
    cgsession_path = "/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession"
    if os.path.exists(cgsession_path):
        try:
            subprocess.run([cgsession_path, "-suspend"], capture_output=True, timeout=2.0)
            return
        except Exception:
            pass
            
    try:
        subprocess.run(
            ["osascript", "-e", 'tell application "System Events" to keystroke "q" using {control down, command down}'],
            capture_output=True, timeout=2.0
        )
    except Exception:
        pass

def is_screen_locked() -> bool:
    """Checks if macOS console screen is currently locked."""
    try:
        res = subprocess.run(
            ["ioreg", "-n", "Root", "-d1", "-a"],
            capture_output=True, text=True, timeout=2.0
        )
        return "<key>IOConsoleLocked</key><true/>" in res.stdout.replace("\n", "").replace(" ", "")
    except Exception:
        return False

def get_frontmost_app() -> str:
    """Native Cocoa query for frontmost active application name."""
    try:
        workspace = NSWorkspace.sharedWorkspace()
        app = workspace.frontmostApplication()
        return app.localizedName() if app else ""
    except Exception:
        return ""

def get_active_browser_url(app_name: str) -> str:
    """Retrieves active tab URL for supported browsers via AppleScript."""
    script = ""
    if app_name == "Safari":
        script = 'tell application "Safari" to if (count of windows) > 0 then return URL of front document'
    elif app_name == "Brave Browser":
        script = 'tell application "Brave Browser" to if (count of windows) > 0 then return URL of active tab of front window'
    elif app_name == "Google Chrome":
        script = 'tell application "Google Chrome" to if (count of windows) > 0 then return URL of active tab of front window'
    elif app_name == "Microsoft Edge":
        script = 'tell application "Microsoft Edge" to if (count of windows) > 0 then return URL of active tab of front window'
    elif app_name == "Arc":
        script = 'tell application "Arc" to if (count of windows) > 0 then return URL of active tab of front window'
        
    if not script:
        return ""
        
    try:
        res = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=1.0)
        return res.stdout.strip()
    except Exception:
        return ""

def is_allowed_url(url: str) -> bool:
    if not url:
        return False
    return any(host in url for host in ALLOWED_URL_HOSTS)

def send_notification(msg: str):
    try:
        subprocess.run(
            ["osascript", "-e", f'display notification "{msg}" with title "Habit Armour"'],
            capture_output=True, timeout=2.0
        )
    except Exception:
        pass

def open_habit_armour_once():
    """Opens Habit Armour URL once when entering lock state."""
    try:
        subprocess.run(["open", FRONTEND_URL], capture_output=True, timeout=2.0)
    except Exception:
        pass

def activate_app(app_name: str):
    """Brings an application to the front WITHOUT reloading or refreshing any URLs."""
    if not app_name:
        return
    try:
        subprocess.run(
            ["osascript", "-e", f'tell application "{app_name}" to activate'],
            capture_output=True, timeout=1.5
        )
    except Exception:
        pass

def main():
    log(f"Habit Armour PyObjC Lock Agent started on port {PORT}...")
    client = httpx.Client(timeout=3.0)
    was_locked = False
    browser_opened_for_lock = False
    consecutive_violations = 0

    while True:
        try:
            res = client.get(API_URL)
            if res.status_code != 200:
                log(f"Server returned HTTP {res.status_code}. Retrying in 10s...")
                time.sleep(10)
                continue
                
            data = res.json()
        except Exception as e:
            log(f"Local server unreachable: {e}. Retrying in 10s...")
            time.sleep(10)
            continue

        locked = data.get("locked") is True
        reason = data.get("reason", "Overdue habit requirements")

        if locked:
            if not was_locked:
                log(f"LOCK ACTIVATED: {reason}")
                send_notification("Habit lock active! Complete your logs to unlock.")
                open_habit_armour_once()
                browser_opened_for_lock = True
                if not is_screen_locked():
                    lock_mac_screen()
                was_locked = True

            # Kiosk enforcement loop
            while True:
                try:
                    res = client.get(API_URL)
                    if res.status_code == 200:
                        status_data = res.json()
                        if not status_data.get("locked"):
                            log("STATUS: Habits completed or override applied. Mac unlocked!")
                            was_locked = False
                            browser_opened_for_lock = False
                            consecutive_violations = 0
                            break
                except Exception:
                    pass

                # If screen is locked, reset violation counter and wait
                if is_screen_locked():
                    was_locked = True
                    consecutive_violations = 0
                    time.sleep(1.5)
                    continue

                # Screen was just unlocked by user: give 10s grace to focus browser
                if was_locked and not browser_opened_for_lock:
                    log("Device unlocked by user. Opening Habit Armour...")
                    open_habit_armour_once()
                    browser_opened_for_lock = True
                    was_locked = False
                    time.sleep(8)
                    continue

                # Check active application
                front_app = get_frontmost_app()
                is_allowed = False
                active_url = ""

                # 1. Standalone allowed productivity apps
                if front_app in ALLOWED_APPS:
                    is_allowed = True
                    consecutive_violations = 0

                # 2. Supported Browsers
                elif front_app in ALLOWED_BROWSERS:
                    active_url = get_active_browser_url(front_app)
                    if active_url:
                        if is_allowed_url(active_url):
                            is_allowed = True
                            consecutive_violations = 0
                        else:
                            # User is on a different URL in the browser
                            is_allowed = False
                    else:
                        # AppleScript URL query returned empty (e.g. macOS automation restrictions).
                        # In this case, assume allowed while browser is frontmost so we NEVER
                        # disrupt or reload the user while typing their logs!
                        is_allowed = True
                        consecutive_violations = 0

                if is_allowed:
                    consecutive_violations = 0
                    time.sleep(1.5)
                else:
                    consecutive_violations += 1
                    log(f"Kiosk violation #{consecutive_violations}: active app is [{front_app}] (URL: {active_url})")

                    # Require 4 consecutive violations (~6 seconds of sustained non-allowed app usage)
                    # before re-locking, preventing accidental alt-tab / notification focus re-locks.
                    if consecutive_violations >= 4:
                        log(f"Sustained violation detected in [{front_app}]. Re-locking screen...")
                        lock_mac_screen()
                        was_locked = True
                        consecutive_violations = 0
                        time.sleep(2)
                    else:
                        time.sleep(1.5)

        else:
            was_locked = False
            browser_opened_for_lock = False
            consecutive_violations = 0
            time.sleep(5)

if __name__ == "__main__":
    main()
