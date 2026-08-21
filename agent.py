#!/usr/bin/env python3
"""
Habit Armour Native macOS Lock Daemon (PyObjC)
Monitors local habit status and enforces kiosk / screen locking when overdue.
Designed for non-disruptive, reliable kiosk operation without page reloads.
"""

import ctypes
import os
import subprocess
import time
from datetime import datetime
from urllib.parse import urlparse

import httpx
from AppKit import NSWorkspace

PORT = int(os.environ.get("PORT", "3000"))
API_URL = f"http://127.0.0.1:{PORT}/api/status"
FRONTEND_URL = f"http://127.0.0.1:{PORT}"

# Standalone desktop apps strictly allowed during lock mode to complete habits/reviews:
# - Anki: for flashcard reviews
# - Obsidian: for local journal notes
# - Typora: for drafting math proofs and recall answers
ALLOWED_APPS = {
    "Anki",
    "Obsidian",
    "Typora",
}

# Browsers whose active tab URL can actually be read via AppleScript. Anything
# outside this set can't be checked, so it can't be allowed during a lock --
# listing e.g. Firefox as "allowed" without a URL script silently guaranteed a
# re-lock even on a whitelisted site.
ALLOWED_BROWSERS = {"Google Chrome", "Safari", "Arc", "Brave Browser", "Microsoft Edge"}

UNVERIFIABLE_BROWSERS = {"Firefox", "Opera", "Orion", "Vivaldi", "Zen Browser", "LibreWolf", "Tor Browser"}

DEFAULT_ALLOWED_URL_HOSTS = {
    f"localhost:{PORT}",
    f"127.0.0.1:{PORT}",
    "localhost:5173",
    "localhost:5174",
    "127.0.0.1:5173",
    "127.0.0.1:5174",
    "myfitnesspal.com",
    "gemini.google.com",
    "claude.ai",
    "chatgpt.com",
    "chat.openai.com",
    "anthropic.com",
    "arxiv.org",
}


def log(msg: str):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)


def lock_mac_screen():
    """Triggers macOS native lock screen cleanly using login.framework SACLockScreenImmediate."""
    try:
        login_framework = ctypes.cdll.LoadLibrary(
            "/System/Library/PrivateFrameworks/login.framework/Versions/Current/login"
        )
        if hasattr(login_framework, "SACLockScreenImmediate"):
            login_framework.SACLockScreenImmediate()
            return
    except Exception as e:
        log(f"SACLockScreenImmediate notice: {e}")

    cgsession_path = "/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession"
    if os.path.exists(cgsession_path):
        try:
            subprocess.run([cgsession_path, "-suspend"], capture_output=True, timeout=2.0)
            return
        except Exception:
            pass

    try:
        subprocess.run(
            [
                "osascript",
                "-e",
                'tell application "System Events" to keystroke "q" using {control down, command down}',
            ],
            capture_output=True,
            timeout=2.0,
        )
    except Exception:
        pass


def is_screen_locked() -> bool:
    """Checks if macOS console screen is currently locked."""
    try:
        res = subprocess.run(
            ["ioreg", "-n", "Root", "-d1", "-a"], capture_output=True, text=True, timeout=2.0
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
        script = 'tell application "Safari" to if (count of documents) > 0 then return URL of front document'
    elif app_name == "Google Chrome":
        script = 'tell application "Google Chrome" to if (count of windows) > 0 then return URL of active tab of front window'
    elif app_name == "Brave Browser":
        script = 'tell application "Brave Browser" to if (count of windows) > 0 then return URL of active tab of front window'
    elif app_name == "Microsoft Edge":
        script = 'tell application "Microsoft Edge" to if (count of windows) > 0 then return URL of active tab of front window'
    elif app_name == "Arc":
        script = 'tell application "Arc" to if (count of windows) > 0 then return URL of active tab of front window'

    if not script:
        return ""

    try:
        res = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=2.0)
        return res.stdout.strip()
    except Exception:
        return ""


def host_matches(netloc: str, allowed_entry: str) -> bool:
    """Exact host match, or a subdomain of the allowed entry. Never a substring."""
    entry = allowed_entry.strip().lower().lstrip(".")
    if not entry:
        return False
    if ":" in entry:
        return netloc == entry
    bare_host = netloc.split(":")[0]
    return bare_host == entry or bare_host.endswith("." + entry)


def is_allowed_url(url: str, dynamic_allowed=None) -> bool:
    """
    Whitelist check against the URL's host only. A substring test over the whole
    URL let any page through as long as an allowed host appeared anywhere in it
    (e.g. youtube.com/results?search_query=claude.ai, or claude.ai.evil.com).
    """
    if not url:
        return False
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        return False
    netloc = parsed.netloc.lower()
    if "@" in netloc:  # strip userinfo, e.g. https://claude.ai@evil.com/
        netloc = netloc.rsplit("@", 1)[-1]
    if not netloc:
        return False

    allowed_set = set(DEFAULT_ALLOWED_URL_HOSTS)
    if dynamic_allowed and isinstance(dynamic_allowed, list):
        for host in dynamic_allowed:
            if host and isinstance(host, str) and host.strip():
                allowed_set.add(host.strip().lower())
    return any(host_matches(netloc, entry) for entry in allowed_set)


def send_notification(msg: str):
    try:
        subprocess.run(
            ["osascript", "-e", f'display notification "{msg}" with title "Habit Armour"'],
            capture_output=True,
            timeout=2.0,
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
            capture_output=True,
            timeout=1.5,
        )
    except Exception:
        pass


def main():
    log(f"Habit Armour PyObjC Lock Agent started on port {PORT}...")
    client = httpx.Client(timeout=3.0)
    screen_was_locked = False
    consecutive_violations = 0
    current_allowed_websites = []

    while True:
        try:
            res = client.get(API_URL)
            if res.status_code != 200:
                log(f"Server returned HTTP {res.status_code}. Retrying in 10s...")
                time.sleep(10)
                continue

            data = res.json()
            current_allowed_websites = data.get("allowedWebsites", [])
        except Exception as e:
            log(f"Local server unreachable: {e}. Retrying in 10s...")
            time.sleep(10)
            continue

        locked = data.get("locked") is True
        reason = data.get("reason", "Overdue habit requirements")

        if locked:
            log(f"LOCK ACTIVATED: {reason}")
            send_notification("Habit lock active! Complete your logs to unlock.")
            open_habit_armour_once()
            if not is_screen_locked():
                lock_mac_screen()
            screen_was_locked = True
            consecutive_violations = 0

            # Kiosk enforcement loop
            while True:
                try:
                    res = client.get(API_URL)
                    if res.status_code == 200:
                        status_data = res.json()
                        current_allowed_websites = status_data.get("allowedWebsites", [])
                        if not status_data.get("locked"):
                            log("STATUS: Habits completed or override applied. Mac unlocked!")
                            screen_was_locked = False
                            consecutive_violations = 0
                            break
                except Exception:
                    pass

                # If physical screen is currently locked, wait and monitor
                if is_screen_locked():
                    screen_was_locked = True
                    consecutive_violations = 0
                    time.sleep(1.5)
                    continue

                # Screen was just unlocked by user: open Habit Armour and grant 6s focus grace
                if screen_was_locked:
                    log("Screen unlocked by user. Opening Habit Armour...")
                    open_habit_armour_once()
                    screen_was_locked = False
                    consecutive_violations = 0
                    time.sleep(6)
                    continue

                # Check active application
                front_app = get_frontmost_app()
                is_allowed = False
                active_url = ""
                violation_detail = ""

                # 1. Standalone allowed productivity apps for habits
                if front_app in ALLOWED_APPS:
                    is_allowed = True
                    consecutive_violations = 0

                # 2. Browsers whose active tab URL we can verify
                elif front_app in ALLOWED_BROWSERS:
                    active_url = get_active_browser_url(front_app)
                    if is_allowed_url(active_url, current_allowed_websites):
                        is_allowed = True
                        consecutive_violations = 0
                    else:
                        violation_detail = f"URL not on whitelist: '{active_url or 'unknown/blank tab'}'"

                # 3. Browsers with no URL script -- fail closed
                elif front_app in UNVERIFIABLE_BROWSERS:
                    violation_detail = (
                        f"cannot read active tab of {front_app}; "
                        f"use {', '.join(sorted(ALLOWED_BROWSERS))} during a lock"
                    )
                else:
                    violation_detail = f"[{front_app}] is not on the allowlist during habit lock"

                if is_allowed:
                    consecutive_violations = 0
                    time.sleep(1.5)
                else:
                    consecutive_violations += 1
                    log(f"Kiosk violation #{consecutive_violations}: {violation_detail}")

                    # 2 consecutive violations (~3 seconds of distraction) triggers immediate re-lock
                    if consecutive_violations >= 2:
                        log(
                            f"Sustained violation in [{front_app}] -- {violation_detail}. Re-locking screen..."
                        )
                        lock_mac_screen()
                        screen_was_locked = True
                        consecutive_violations = 0
                        time.sleep(2)
                    else:
                        time.sleep(1.5)

        else:
            screen_was_locked = False
            consecutive_violations = 0
            time.sleep(5)


if __name__ == "__main__":
    main()
