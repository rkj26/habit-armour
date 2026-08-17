#!/usr/bin/env python3
"""
Habit Armour Native macOS Lock Daemon (PyObjC)
Monitors local habit status and enforces kiosk / screen locking when overdue.
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

ALLOWED_APPS = {"Anki", "Obsidian", "Antigravity IDE"}
ALLOWED_URL_HOSTS = {f"localhost:{PORT}", f"127.0.0.1:{PORT}", "localhost:5173", "localhost:5174", "127.0.0.1:5173", "127.0.0.1:5174"}

def log(msg: str):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)

def lock_mac_screen():
    """Triggers macOS native lock screen."""
    try:
        subprocess.run(
            ["osascript", "-e", 'tell application "System Events" to keystroke "q" using {control down, command down}'],
            capture_output=True, timeout=2.0
        )
    except Exception:
        pass
    try:
        subprocess.run(["pmset", "displaysleepnow"], capture_output=True, timeout=2.0)
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
    if app_name == "Google Chrome":
        script = 'tell application "Google Chrome" to if (count of windows) > 0 then get URL of active tab of first window'
    elif app_name == "Safari":
        script = 'tell application "Safari" to if (count of windows) > 0 then get URL of front document'
    elif app_name == "Arc":
        script = 'tell application "Arc" to if (count of windows) > 0 then get URL of active tab of first window'
    elif app_name == "Brave Browser":
        script = 'tell application "Brave Browser" to if (count of windows) > 0 then get URL of active tab of first window'
    elif app_name == "Microsoft Edge":
        script = 'tell application "Microsoft Edge" to if (count of windows) > 0 then get URL of active tab of first window'
        
    if not script:
        return ""
        
    try:
        res = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=1.5)
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

def open_habit_armour():
    try:
        subprocess.run(["open", FRONTEND_URL], capture_output=True, timeout=2.0)
    except Exception:
        pass

def main():
    log(f"Habit Armour PyObjC Lock Agent started on port {PORT}...")
    client = httpx.Client(timeout=3.0)
    was_locked = False

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
            log(f"LOCK ACTIVE: {reason}")
            send_notification("Habit lock active! Complete your logs to unlock.")
            open_habit_armour()

            if not is_screen_locked():
                lock_mac_screen()

            was_locked = True

            # Tight kiosk enforcement loop
            while True:
                try:
                    res = client.get(API_URL)
                    if res.status_code == 200:
                        status_data = res.json()
                        if not status_data.get("locked"):
                            log("STATUS: Habits completed or override applied. Mac unlocked!")
                            was_locked = False
                            break
                except Exception:
                    pass

                # If screen is locked, wait and monitor
                if is_screen_locked():
                    was_locked = True
                    time.sleep(1)
                    continue

                # User unlocked Mac: give 5s grace to focus browser
                if was_locked:
                    log("Device unlocked by user. Focusing Habit Armour...")
                    open_habit_armour()
                    was_locked = False
                    time.sleep(5)
                    continue

                # Check active application
                front_app = get_frontmost_app()
                is_allowed = False
                active_url = ""

                if front_app in ALLOWED_APPS:
                    is_allowed = True
                elif front_app in {"Google Chrome", "Safari", "Arc", "Brave Browser", "Microsoft Edge"}:
                    active_url = get_active_browser_url(front_app)
                    if is_allowed_url(active_url):
                        is_allowed = True

                if is_allowed:
                    time.sleep(1)
                else:
                    log(f"Kiosk violation: active app is [{front_app}] (URL: {active_url}). Re-locking...")
                    open_habit_armour()
                    lock_mac_screen()
                    was_locked = True
                    time.sleep(1)

        else:
            time.sleep(10)

if __name__ == "__main__":
    main()
