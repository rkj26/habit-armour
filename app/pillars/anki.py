import httpx
from typing import Dict, Any, List, Tuple, Optional
from app.config import settings
from app.models.config import AppConfigModel

async def anki_request(action: str, params: Optional[Dict[str, Any]] = None, anki_url: Optional[str] = None) -> Any:
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

async def check_anki_status(config: AppConfigModel) -> Tuple[bool, bool, int, int, List[Dict[str, Any]], Optional[str]]:
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
                if learn_count == 0 or reviewed_today > 0:
                    due = 0
                else:
                    due = learn_count
            else:
                due = new_count + review_count + (learn_count if reviewed_today == 0 else 0)
            
            total_due += due
            deck_list.append({
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
                "cleared": due == 0
            })
            
        verified = (total_due == 0)
        return True, verified, total_due, reviewed_today, deck_list, None
    except Exception as e:
        err_msg = f"Anki Desktop is not reachable on {url}. Please ensure Anki is open with AnkiConnect installed. ({str(e)})"
        return False, False, 0, 0, [], err_msg

