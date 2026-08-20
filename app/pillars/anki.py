import time
from typing import Any

import httpx

from app.config import settings
from app.models.config import AppConfigModel

# The lock daemon polls /api/status every ~1.5s while a lock is active and the
# dashboard polls it every 5s, so an uncached AnkiConnect call per status read
# means ~40 requests a minute to Anki. Deck counts don't change that fast.
ANKI_POLL_TTL_SEC = 60.0
_anki_cache: dict[str, Any] = {"at": 0.0, "url": None, "result": None}


async def anki_request(action: str, params: dict[str, Any] | None = None, anki_url: str | None = None) -> Any:
    url = anki_url or settings.ANKI_CONNECT_URL
    payload = {"action": action, "version": 6, "params": params or {}}

    async with httpx.AsyncClient(timeout=3.0) as client:
        res = await client.post(url, json=payload)
        if res.status_code != 200:
            raise Exception(f"HTTP {res.status_code}")
        data = res.json()
        if data.get("error"):
            raise Exception(data["error"])
        return data.get("result")


async def check_anki_status(
    config: AppConfigModel,
) -> tuple[bool, bool, int, int, list[dict[str, Any]], str | None]:
    """
    Returns (reachable, verified_complete, total_due, reviewed_today, deck_details, error_message).
    """
    url = config.ankiConnectUrl or settings.ANKI_CONNECT_URL
    ignored_decks = set(config.ankiIgnoredDecks or [])

    try:
        # 1. Check version/reachability
        await anki_request("version", anki_url=url)

        # 2. Get true cards reviewed today directly from Anki
        reviewed_today = 0
        try:
            reviewed_today = await anki_request("getNumCardsReviewedToday", anki_url=url) or 0
        except Exception:
            reviewed_today = 0

        # 3. Get deck names
        deck_names = await anki_request("deckNames", anki_url=url)
        deck_names = [d for d in deck_names if d not in ignored_decks]

        # 4. Get deck stats
        deck_stats = await anki_request("getDeckStats", {"decks": deck_names}, anki_url=url)

        total_due = 0
        deck_list = []

        for d_id, stats in deck_stats.items():
            name = stats.get("name", "")
            if name in ignored_decks:
                continue
            new_count = stats.get("new_count", 0)
            learn_count = stats.get("learn_count", 0)
            review_count = stats.get("review_count", 0)
            total_in_deck = stats.get("total_in_deck", 0)

            # In Anki:
            # - new_count: remaining unstudied new cards today (subject to daily deck limit)
            # - review_count: scheduled reviews due today
            # - learn_count: cards in active learning/relearning steps
            # If all new cards and review cards for today are completed (0 new, 0 review)
            # and the user has actively completed study sessions today (reviewed_today > 0),
            # or if the deck is fully clear (0 new, 0 review, 0 learn), the deck requirement is satisfied.
            if new_count == 0 and review_count == 0:
                due = 0 if (learn_count == 0 or reviewed_today > 0) else learn_count
            else:
                due = new_count + review_count + (learn_count if reviewed_today == 0 else 0)

            total_due += due
            deck_list.append(
                {
                    "deck_id": stats.get("deck_id") or d_id,
                    "name": name,
                    "due": due,
                    "due_count": due,
                    "new": new_count,
                    "new_count": new_count,
                    "learn": learn_count,
                    "learn_count": learn_count,
                    "review": review_count,
                    "review_count": review_count,
                    "total_in_deck": total_in_deck,
                    "total": total_in_deck,
                    "cleared": due == 0,
                }
            )

        verified = total_due == 0
        return True, verified, total_due, reviewed_today, deck_list, None
    except Exception as e:
        err_msg = f"Anki Desktop is not reachable on {url}. Please ensure Anki is open with AnkiConnect installed. ({str(e)})"
        return False, False, 0, 0, [], err_msg


def invalidate_anki_cache() -> None:
    """Drops the cached poll so the next read hits Anki. Call after a user-driven verify."""
    _anki_cache.update(at=0.0, url=None, result=None)


async def check_anki_status_cached(
    config: AppConfigModel,
) -> tuple[bool, bool, int, int, list[dict[str, Any]], str | None]:
    """TTL-cached wrapper for polling paths (status reads). Explicit user
    verification should call check_anki_status directly."""
    url = config.ankiConnectUrl or settings.ANKI_CONNECT_URL
    now = time.monotonic()
    if (
        _anki_cache["result"] is not None
        and _anki_cache["url"] == url
        and (now - _anki_cache["at"]) < ANKI_POLL_TTL_SEC
    ):
        return _anki_cache["result"]

    result = await check_anki_status(config)
    _anki_cache.update(at=now, url=url, result=result)
    return result
