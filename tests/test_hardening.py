"""
Regression tests for the three ways this app could be made to misbehave from
outside: serving files from outside client/dist, persisting a config value that
poisons every later /api/status, and letting a disallowed site through the
kiosk URL check.
"""

import pytest

from agent import is_allowed_url
from app.main import resolve_static_file


class TestStaticFileContainment:
    """`/{full_path:path}` receives percent-decoded paths, so `..` reaches the handler."""

    @pytest.fixture()
    def dist(self, tmp_path):
        root = tmp_path / "client" / "dist"
        root.mkdir(parents=True)
        (root / "index.html").write_text("<html>spa</html>")
        (tmp_path / ".env").write_text("GEMINI_API_KEY=secret")
        return root

    def test_serves_a_real_file_inside_dist(self, dist):
        assert resolve_static_file("index.html", root=str(dist)) == str(dist / "index.html")

    def test_missing_file_inside_dist_falls_through_to_none(self, dist):
        assert resolve_static_file("nope.js", root=str(dist)) is None

    @pytest.mark.parametrize("escape", ["../../.env", "..%2f..%2f.env", "../.env", "/etc/hosts"])
    def test_paths_escaping_dist_are_refused(self, dist, escape):
        assert resolve_static_file(escape, root=str(dist)) is None

    def test_symlink_pointing_outside_dist_is_refused(self, dist, tmp_path):
        (dist / "leak.env").symlink_to(tmp_path / ".env")
        assert resolve_static_file("leak.env", root=str(dist)) is None


class TestConfigValidation:
    """An unchecked setattr persisted junk and made every later /api/status 500."""

    def test_wrong_type_is_rejected_and_not_persisted(self, client):
        before = client.get("/api/config").json()["morningStart"]

        res = client.post("/api/config", json={"morningStart": "not-an-int"})
        assert res.status_code == 422
        assert "morningStart" in res.json()["detail"]["fields"]

        assert client.get("/api/config").json()["morningStart"] == before
        assert client.get("/api/status").status_code == 200

    def test_numeric_string_is_coerced_rather_than_rejected(self, client):
        assert client.post("/api/config", json={"morningStart": "6"}).status_code == 200
        assert client.get("/api/config").json()["morningStart"] == 6

    def test_valid_update_still_applies(self, client):
        assert client.post("/api/config", json={"practiceNewCardsPerDay": 3}).status_code == 200
        assert client.get("/api/config").json()["practiceNewCardsPerDay"] == 3

    def test_one_bad_field_rejects_the_whole_payload(self, client):
        res = client.post("/api/config", json={"gymWeeklyGoal": 6, "ankiLockStartHour": "half past"})
        assert res.status_code == 422
        assert client.get("/api/config").json()["gymWeeklyGoal"] != 6

    def test_primary_key_cannot_be_reassigned(self, client):
        assert client.post("/api/config", json={"id": 99}).status_code == 200
        assert client.get("/api/config").json()["id"] == 1

    def test_allowed_websites_none_coerced_to_default_list(self, client):
        res = client.post("/api/config", json={"allowedWebsites": None})
        assert res.status_code == 200
        assert isinstance(client.get("/api/config").json()["allowedWebsites"], list)

    def test_allowed_websites_custom_list_persisted(self, client):
        res = client.post("/api/config", json={"allowedWebsites": ["claude.ai", "gemini.google.com"]})
        assert res.status_code == 200
        assert client.get("/api/config").json()["allowedWebsites"] == ["claude.ai", "gemini.google.com"]


class TestUnknownApiRoutes:
    def test_unknown_api_path_is_404_not_the_spa_index(self, client):
        assert client.get("/api/definitely-not-a-route").status_code == 404


class TestRequestBodyValidation:
    """
    Routes take typed models rather than `dict[str, Any]`, so a malformed body
    is rejected before the handler runs. The date cases matter most: the value
    is a primary key *and* an Obsidian filename.
    """

    @pytest.mark.parametrize(
        "bad_date",
        ["../../../../tmp/evil", "2026-8-1", "not-a-date", "2026-08-20/../x", ""],
    )
    def test_habit_log_rejects_a_malformed_date(self, client, bad_date):
        res = client.post("/api/submit", json={"window": "morning", "date": bad_date, "data": {}})
        assert res.status_code == 422

    def test_habit_log_accepts_a_valid_date(self, client):
        res = client.post("/api/submit", json={"window": "morning", "date": "2026-08-20", "data": {"x": 1}})
        assert res.status_code == 200
        assert res.json()["entry"]["date"] == "2026-08-20"

    def test_habit_log_defaults_to_today_when_date_omitted(self, client):
        assert client.post("/api/submit", json={"window": "morning", "data": {}}).status_code == 200

    def test_habit_log_rejects_an_unknown_window(self, client):
        assert client.post("/api/submit", json={"window": "brunch", "data": {}}).status_code == 422

    def test_habit_log_requires_a_window(self, client):
        assert client.post("/api/submit", json={"data": {}}).status_code == 422

    def test_photo_upload_rejects_a_traversal_date(self, client):
        res = client.post(
            "/api/upload-photo",
            json={"date": "../../etc", "pose": "front", "dataUrl": "data:image/png;base64,AAAA"},
        )
        assert res.status_code == 422

    def test_study_item_requires_a_title(self, client):
        assert client.post("/api/practice/items", json={"type": "topic"}).status_code == 422

    def test_study_item_rejects_an_unknown_type(self, client):
        res = client.post("/api/practice/items", json={"title": "X", "type": "podcast"})
        assert res.status_code == 422

    def test_study_item_accepts_comma_separated_tags(self, client):
        res = client.post(
            "/api/practice/items",
            json={"title": "Bellman", "tags": "Section: Foundations, dp"},
        )
        assert res.status_code == 200
        assert res.json()["item"]["tags"] == ["Section: Foundations", "dp"]

    def test_attempt_rejects_a_blank_answer(self, client):
        res = client.post("/api/practice/attempts", json={"questionId": "q1", "answerMarkdown": "   "})
        assert res.status_code == 422

    def test_generate_questions_bounds_the_count(self, client):
        # Unbounded here would fan out into a large call on a personal Gemini quota.
        res = client.post("/api/practice/questions/generate", json={"itemId": "x", "count": 500})
        assert res.status_code == 422

    def test_partial_item_update_leaves_omitted_fields_alone(self, client):
        created = client.post("/api/practice/items", json={"title": "Original", "notes": "keep me"})
        item_id = created.json()["item"]["id"]

        res = client.put(f"/api/practice/items/{item_id}", json={"title": "Renamed"})
        assert res.status_code == 200
        assert res.json()["item"]["title"] == "Renamed"
        assert res.json()["item"]["notes"] == "keep me"


class TestKioskUrlAllowlist:
    """The old check was `allowed_host in url`, true for any URL merely containing one."""

    @pytest.mark.parametrize(
        "url",
        [
            "https://claude.ai/chat/123",
            "https://www.claude.ai/",
            "https://gemini.google.com/app",
            "http://127.0.0.1:3000/practice",
            "https://arxiv.org/abs/1706.03762",
        ],
    )
    def test_allowed_hosts_and_their_subdomains_pass(self, url):
        assert is_allowed_url(url) is True

    @pytest.mark.parametrize(
        "url",
        [
            "https://www.youtube.com/results?search_query=claude.ai",
            "https://claude.ai.phishing-site.example/",
            "https://reddit.com/r/all#arxiv.org",
            "https://twitter.com/home?ref=chatgpt.com",
            "https://evil.example/claude.ai/",
            "https://claude.ai@evil.example/",
            "https://news.ycombinator.com/",
        ],
    )
    def test_hosts_that_merely_mention_an_allowed_domain_are_blocked(self, url):
        assert is_allowed_url(url) is False

    def test_blank_and_non_http_urls_are_blocked(self):
        assert is_allowed_url("") is False
        assert is_allowed_url("file:///Users/me/Downloads/claude.ai.html") is False

    def test_dynamic_allowlist_from_config_is_honoured(self):
        assert is_allowed_url("https://myfitnesspal.com/food") is True
        assert is_allowed_url("https://notion.so/notes") is False
        assert is_allowed_url("https://notion.so/notes", ["notion.so"]) is True
        assert is_allowed_url("https://www.notion.so/notes", ["notion.so"]) is True
