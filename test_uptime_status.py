"""Testy wyciągania klucza strony, stronicowania i oceny stanu monitorów."""

import json

import uptime_status as us

PAGE = "https://status.example.com"


def _mon(name, status="success", r30="100.000", r90="100.000", **kw):
    m = {
        "monitorId": hash(name) % 10_000,
        "statusClass": status,
        "name": name,
        "url": None,
        "type": "HTTP(s)",
        "30dRatio": {"ratio": r30},
        "90dRatio": {"ratio": r90},
        "lastDowntime": None,
    }
    m.update(kw)
    return m


def test_key_from_html():
    html = '<script>fetch("/api/getMonitorList/AbC123xyz?page=1")</script>'
    assert us.key_from_html(html) == "AbC123xyz"


def test_key_from_html_missing():
    assert us.key_from_html("<html>zwykła strona</html>") is None


def test_api_url_stats_domain_needs_no_fetch(monkeypatch):
    def boom(url):
        raise AssertionError(f"nie powinno pobierać {url}")

    monkeypatch.setattr(us, "_get", boom)
    assert us.api_url("https://stats.uptimerobot.com/AbC123/") == (
        "https://stats.uptimerobot.com/api/getMonitorList/AbC123"
    )


def test_api_url_custom_domain_uses_and_caches_key(monkeypatch, tmp_path):
    monkeypatch.setattr(us, "CACHE", tmp_path / "keys.json")
    calls = []

    def fake_get(url):
        calls.append(url)
        return b'<base href="https://status.example.com/"> /api/getMonitorList/Key42'

    monkeypatch.setattr(us, "_get", fake_get)
    assert us.api_url(PAGE + "/") == "https://status.example.com/api/getMonitorList/Key42"
    assert us.api_url(PAGE) == "https://status.example.com/api/getMonitorList/Key42"
    assert calls == [PAGE]  # drugi raz klucz z cache


def test_fetch_monitors_follows_pages(monkeypatch):
    pages = {
        1: {"psp": {"monitors": [_mon("a"), _mon("b")], "totalMonitors": 3}},
        2: {"psp": {"monitors": [_mon("c")], "totalMonitors": 3}},
    }
    monkeypatch.setattr(us, "_get", lambda url: json.dumps(pages[int(url.rsplit("=", 1)[1])]).encode())
    assert [m["name"] for m in us.fetch_monitors("https://x/api/getMonitorList/K")] == ["a", "b", "c"]


def test_row_states():
    assert us.sticky_row(_mon("a"), PAGE)["state"] == "ok"
    assert us.sticky_row(_mon("a", status="danger"), PAGE)["state"] == "down"
    assert us.sticky_row(_mon("a", status="black"), PAGE)["state"] == "paused"
    assert us.sticky_row(_mon("a", status="cos-nowego"), PAGE)["state"] == "warn"


def test_low_30d_ratio_is_warning():
    r = us.sticky_row(_mon("a", r30="98.500"), PAGE)
    assert r["state"] == "warn"
    assert r["problems"] == ["dostępność 30 dni: 98.5%"]


def test_row_columns_and_link():
    r = us.sticky_row(_mon("a", r30="100.000", r90="99.951"), PAGE)
    assert r["cols"] == ["100%", "99.95%"]
    assert r["url"] == PAGE  # bez adresu monitora → link do strony statusu
    assert us.sticky_row(_mon("a", url="https://a.example"), PAGE)["url"] == "https://a.example"


def test_missing_ratio_leaves_empty_column():
    m = _mon("a")
    m["30dRatio"] = None
    r = us.sticky_row(m, PAGE)
    assert r["cols"][0] == ""
    assert r["state"] == "ok"


def test_report_sorts_problems_first_and_counts():
    rep = us.build_report(PAGE, [_mon("z"), _mon("b", status="danger"), _mon("a"), _mon("p", status="black")])
    assert [r["name"] for r in rep["rows"]] == ["b", "p", "a", "z"]
    assert rep["counts"] == {"down": 1, "warn": 0, "paused": 1, "ok": 2}
