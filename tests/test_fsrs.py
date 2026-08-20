"""
Unit tests for the FSRS-5 math and daily-gate logic in app/pillars/practice.py.
Pure functions -- no DB/client needed.
"""

from app.models.daily_entry import DailyEntry
from app.pillars.practice import (
    compute_next_fsrs,
    compute_retrievability,
    is_practice_satisfied,
    score_to_fsrs_grade,
)


def test_score_to_fsrs_grade_boundaries():
    assert score_to_fsrs_grade(0) == 1
    assert score_to_fsrs_grade(4.9) == 1
    assert score_to_fsrs_grade(5.0) == 2
    assert score_to_fsrs_grade(6.9) == 2
    assert score_to_fsrs_grade(7.0) == 3
    assert score_to_fsrs_grade(8.4) == 3
    assert score_to_fsrs_grade(8.5) == 4
    assert score_to_fsrs_grade(10.0) == 4


def test_compute_next_fsrs_new_card_good_grade_enters_review_state():
    result = compute_next_fsrs(
        current_stability=0.0,
        current_difficulty=5.0,
        current_reps=0,
        current_lapses=0,
        current_state=0,
        last_reviewed_at=None,
        grade=3,
        today_str="2026-08-20",
    )
    assert result["repetitions"] == 1
    assert result["lapses"] == 0
    assert result["state"] == 2  # Review
    assert result["stability"] > 0
    assert result["dueDate"] > "2026-08-20"


def test_compute_next_fsrs_new_card_again_grade_stays_in_learning():
    result = compute_next_fsrs(
        current_stability=0.0,
        current_difficulty=5.0,
        current_reps=0,
        current_lapses=0,
        current_state=0,
        last_reviewed_at=None,
        grade=1,
        today_str="2026-08-20",
    )
    assert result["lapses"] == 1
    assert result["state"] == 1  # Learning, not Review, on a first-attempt fail


def test_compute_next_fsrs_lapse_increments_lapses_and_enters_relearning():
    result = compute_next_fsrs(
        current_stability=10.0,
        current_difficulty=5.0,
        current_reps=3,
        current_lapses=0,
        current_state=2,
        last_reviewed_at="2026-08-10T00:00:00",
        grade=1,
        today_str="2026-08-20",
    )
    assert result["lapses"] == 1
    assert result["state"] == 3  # Relearning
    assert result["stability"] <= 10.0  # a lapse must not increase stability


def test_compute_next_fsrs_good_recall_does_not_shrink_stability():
    result = compute_next_fsrs(
        current_stability=5.0,
        current_difficulty=5.0,
        current_reps=2,
        current_lapses=0,
        current_state=2,
        last_reviewed_at="2026-08-10T00:00:00",
        grade=4,
        today_str="2026-08-20",  # Easy
    )
    assert result["stability"] >= 5.0
    assert result["lapses"] == 0
    assert result["state"] == 2


def test_compute_retrievability_is_full_at_zero_elapsed_and_decays_after():
    r_fresh = compute_retrievability(elapsed_days=0, stability=10.0)
    r_later = compute_retrievability(elapsed_days=30, stability=10.0)
    assert r_fresh == 1.0
    assert 0 < r_later < r_fresh


def test_compute_retrievability_zero_stability_is_zero():
    assert compute_retrievability(elapsed_days=5, stability=0.0) == 0.0


def test_is_practice_satisfied_no_entry_no_due_is_satisfied():
    assert is_practice_satisfied(None, due_count=0, min_required=1) is True


def test_is_practice_satisfied_no_entry_with_due_is_not_satisfied():
    assert is_practice_satisfied(None, due_count=3, min_required=1) is False


def test_is_practice_satisfied_manual_override_always_satisfies():
    entry = DailyEntry(date="2026-08-20", practiceManualOverride=True)
    assert is_practice_satisfied(entry, due_count=50, min_required=5) is True


def test_is_practice_satisfied_min_required_zero_needs_full_clear():
    entry = DailyEntry(date="2026-08-20", practiceCompletedQuestionIds=["q1"])
    assert is_practice_satisfied(entry, due_count=5, min_required=0) is False
    assert is_practice_satisfied(entry, due_count=0, min_required=0) is True


def test_is_practice_satisfied_checks_distinct_completed_against_min_required():
    entry = DailyEntry(date="2026-08-20", practiceCompletedQuestionIds=["q1", "q2"])
    assert is_practice_satisfied(entry, due_count=10, min_required=2) is True
    assert is_practice_satisfied(entry, due_count=10, min_required=3) is False
