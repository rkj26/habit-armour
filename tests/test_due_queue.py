"""
Integration tests for GET /api/practice/due -- the topic-grouped, paced
due-queue built in routes/practice.py. Covers the behavior that's easy to
silently regress:
  - topics with real attempt history are always shown in full ("in progress"),
    even if none of their currently-due questions individually have
    repetitions > 0 yet.
  - brand-new (never-attempted) topics are capped at practiceNewCardsPerDay,
    surfaced in a stable Section -> title order.
  - each group's questions are sorted by ladder `order`, not creation order.
  - not-yet-due questions are excluded entirely.
"""
from datetime import datetime

from sqlmodel import select

from app.config import get_local_date_string
from app.models.config import AppConfigModel
from app.models.study import StudyAttempt, StudyItem, StudyQuestion


def _make_item(db_session, item_id, title, tags=None):
    item = StudyItem(
        id=item_id, type="topic", title=title, tags=tags or [],
        notes="", createdAt=datetime.utcnow().isoformat(),
    )
    db_session.add(item)
    db_session.commit()
    return item


def _make_question(db_session, q_id, item_id, order, due_date, repetitions=0):
    q = StudyQuestion(
        id=q_id, itemId=item_id, itemType="topic", prompt=f"prompt {q_id}",
        answerTemplate="topic", difficulty="Easy", source="manual", active=True,
        order=order, easeFactor=2.5, repetitions=repetitions, intervalDays=0,
        dueDate=due_date, stability=1.0 if repetitions else 0.0, fsrsDifficulty=5.0,
        lapses=0, state=2 if repetitions else 0,
    )
    db_session.add(q)
    db_session.commit()
    return q


def _set_new_topics_per_day(db_session, n):
    cfg = db_session.exec(select(AppConfigModel).where(AppConfigModel.id == 1)).first()
    if not cfg:
        cfg = AppConfigModel(id=1)
    cfg.practiceNewCardsPerDay = n
    db_session.add(cfg)
    db_session.commit()


def test_in_progress_topic_always_shown_in_full_even_with_zero_new_topic_budget(client, db_session):
    today = get_local_date_string()
    _set_new_topics_per_day(db_session, 0)  # no new topics allowed today

    _make_item(db_session, "item_a", "Topic A")
    _make_question(db_session, "q_a1", "item_a", order=0, due_date=today, repetitions=1)
    _make_question(db_session, "q_a2", "item_a", order=1, due_date=today, repetitions=0)
    db_session.add(StudyAttempt(id="att_1", questionId="q_a1", itemId="item_a",
                                 answerMarkdown="x", evaluation={"score": 8.0}))
    db_session.commit()

    data = client.get("/api/practice/due").json()
    groups = {g["itemId"]: g for g in data["dueGroups"]}

    assert "item_a" in groups
    assert groups["item_a"]["isReview"] is True
    assert groups["item_a"]["dueCount"] == 2  # both due questions shown, not gated by the new-topic cap


def test_topic_with_history_shown_even_if_only_its_unreviewed_tail_is_due_today(client, db_session):
    """A topic mid-ladder: its reviewed card isn't due again until tomorrow,
    but its never-attempted tail is due today. Must still appear as one group,
    not get miscategorized as 'new' and bumped by the cap."""
    today = get_local_date_string()
    _set_new_topics_per_day(db_session, 0)

    _make_item(db_session, "item_mid", "Mid-Ladder Topic")
    _make_question(db_session, "q_mid_reviewed", "item_mid", order=0, due_date="2099-01-01", repetitions=1)
    _make_question(db_session, "q_mid_new", "item_mid", order=1, due_date=today, repetitions=0)
    db_session.add(StudyAttempt(id="att_mid", questionId="q_mid_reviewed", itemId="item_mid",
                                 answerMarkdown="x", evaluation={"score": 7.0}))
    db_session.commit()

    data = client.get("/api/practice/due").json()
    groups = {g["itemId"]: g for g in data["dueGroups"]}

    assert "item_mid" in groups
    assert groups["item_mid"]["isReview"] is True
    assert groups["item_mid"]["dueCount"] == 1
    assert groups["item_mid"]["questions"][0]["id"] == "q_mid_new"


def test_new_topics_capped_and_ordered_by_section_then_title(client, db_session):
    today = get_local_date_string()
    _set_new_topics_per_day(db_session, 1)

    _make_item(db_session, "item_b", "Zebra Topic", tags=["Section: Policy Optimisation"])
    _make_question(db_session, "q_b1", "item_b", order=0, due_date=today)

    _make_item(db_session, "item_c", "Alpha Topic", tags=["Section: Foundations"])
    _make_question(db_session, "q_c1", "item_c", order=0, due_date=today)

    data = client.get("/api/practice/due").json()

    shown_ids = [g["itemId"] for g in data["dueGroups"]]
    assert shown_ids == ["item_c"]  # Foundations ranks before Policy Optimisation
    assert data["queuedNewTopicsCount"] == 1
    assert data["totalDueBacklog"] == 2
    assert data["dueCount"] == 1


def test_questions_within_a_group_are_sorted_by_ladder_order_not_creation_order(client, db_session):
    today = get_local_date_string()
    _set_new_topics_per_day(db_session, 5)

    _make_item(db_session, "item_d", "Ladder Topic")
    _make_question(db_session, "q_d3", "item_d", order=2, due_date=today)
    _make_question(db_session, "q_d1", "item_d", order=0, due_date=today)
    _make_question(db_session, "q_d2", "item_d", order=1, due_date=today)

    data = client.get("/api/practice/due").json()
    group = next(g for g in data["dueGroups"] if g["itemId"] == "item_d")

    assert [q["order"] for q in group["questions"]] == [0, 1, 2]


def test_not_yet_due_questions_are_excluded_from_their_group(client, db_session):
    today = get_local_date_string()
    _set_new_topics_per_day(db_session, 5)

    _make_item(db_session, "item_e", "Future Topic")
    _make_question(db_session, "q_e1", "item_e", order=0, due_date=today)
    _make_question(db_session, "q_e2", "item_e", order=1, due_date="2099-01-01")

    data = client.get("/api/practice/due").json()
    group = next(g for g in data["dueGroups"] if g["itemId"] == "item_e")

    assert group["dueCount"] == 1
    assert group["questions"][0]["id"] == "q_e1"
