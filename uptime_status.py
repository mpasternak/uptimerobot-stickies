#!/usr/bin/env python3
"""Stan monitorów z publicznej strony statusu UptimeRobot — dla karteczki Übersicht.

Działa z każdą publiczną stroną statusu UptimeRobot: zarówno
https://stats.uptimerobot.com/<klucz>, jak i z własną domeną (np. status.example.com).
Taka strona udostępnia bez logowania JSON pod /api/getMonitorList/<klucz>; klucz
wyciągamy z HTML strony i zapamiętujemy w ~/.cache/uptimerobot-stickies/.

Użycie:
    python3 uptime_status.py https://status.example.com           # tekst (test w terminalu)
    python3 uptime_status.py https://status.example.com --json    # JSON dla widgetu

Tylko biblioteka standardowa.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger("uptime_status")

CACHE = Path("~/.cache/uptimerobot-stickies/keys.json").expanduser()
TIMEOUT = 10  # sek.
UA = "uptimerobot-stickies/1.0 (+uebersicht)"
WARN_RATIO = 99.0  # dostępność z 30 dni poniżej tego = 🟡, nawet gdy teraz działa

KEY_RE = re.compile(r"/api/getMonitorList/([A-Za-z0-9]+)")
STATS_RE = re.compile(r"^https?://stats\.uptimerobot\.com/([A-Za-z0-9]+)")
# statusClass z API strony statusu → stan karteczki; nieznane traktujemy jak 🟡.
STATE = {"success": "ok", "danger": "down", "black": "paused"}
ORDER = {"down": 0, "warn": 1, "paused": 2, "ok": 3}


def _get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json, text/html"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read()


# --- klucz strony ---------------------------------------------------------------


def key_from_html(html: str) -> str | None:
    """Klucz strony statusu z jej HTML (skrypt strony woła /api/getMonitorList/<klucz>)."""
    m = KEY_RE.search(html)
    return m.group(1) if m else None


def _load_cache() -> dict:
    try:
        return json.loads(CACHE.read_text())
    except FileNotFoundError:
        return {}
    except (OSError, ValueError):
        log.warning("Zepsuty cache kluczy %s — pobieram klucz od nowa", CACHE)
        return {}


def _save_cache(cache: dict) -> None:
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache))


def api_url(page_url: str, *, refresh: bool = False) -> str:
    """Adres JSON-a z monitorami dla strony statusu (stats.uptimerobot.com albo własna domena)."""
    page_url = page_url.rstrip("/")
    m = STATS_RE.match(page_url)
    if m:
        return f"https://stats.uptimerobot.com/api/getMonitorList/{m.group(1)}"
    cache = _load_cache()
    key = None if refresh else cache.get(page_url)
    if not key:
        key = key_from_html(_get(page_url).decode("utf-8", "replace"))
        if not key:
            raise LookupError(f"{page_url}: to nie wygląda na stronę statusu UptimeRobot")
        cache[page_url] = key
        _save_cache(cache)
    origin = "{0.scheme}://{0.netloc}".format(urllib.parse.urlsplit(page_url))
    return f"{origin}/api/getMonitorList/{key}"


def fetch_monitors(api: str) -> list[dict]:
    """Wszystkie monitory strony (API stronicuje — domyślnie po 30)."""
    monitors: list[dict] = []
    page = 1
    while True:
        psp = json.loads(_get(f"{api}?page={page}")).get("psp", {})
        batch = psp.get("monitors", [])
        monitors += batch
        if not batch or len(monitors) >= psp.get("totalMonitors", 0):
            return monitors
        page += 1


def load_monitors(page_url: str) -> list[dict]:
    try:
        return fetch_monitors(api_url(page_url))
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise
        # Klucz z cache mógł się zdezaktualizować (strona przepięta) — pobierz go od nowa.
        log.warning("%s: 404 dla zapamiętanego klucza, odświeżam klucz", page_url)
        return fetch_monitors(api_url(page_url, refresh=True))


# --- ocena i raport ---------------------------------------------------------------


def _ratio(m: dict, field: str) -> float | None:
    try:
        return float(m[field]["ratio"])
    except (KeyError, TypeError, ValueError):
        return None  # brak statystyki (np. świeżo dodany monitor) — kolumna zostaje pusta


def _pct(r: float | None) -> str:
    if r is None:
        return ""
    return f"{r:.2f}".rstrip("0").rstrip(".") + "%"


def sticky_row(m: dict, page_url: str) -> dict:
    """Monitor w formacie karteczki: stan, dostępność z 30 i 90 dni."""
    r30, r90 = _ratio(m, "30dRatio"), _ratio(m, "90dRatio")
    state = STATE.get(str(m.get("statusClass") or ""), "warn")
    problems = []
    if state == "down":
        problems.append("nie działa")
    elif state == "warn":
        problems.append(f"stan: {m.get('statusClass')}")
    elif state == "ok" and r30 is not None and r30 < WARN_RATIO:
        state = "warn"
        problems.append(f"dostępność 30 dni: {_pct(r30)}")
    tip = f"{m.get('name')} ({m.get('type') or '?'})"
    if m.get("lastDowntime"):
        tip += f"\nostatnia awaria: {m['lastDowntime']}"
    return {
        "state": state,
        "name": m.get("name") or f"#{m.get('monitorId')}",
        "url": m.get("url") or page_url,  # monitor bez publicznego adresu → link do strony statusu
        "tip": tip,
        "cols": [_pct(r30), _pct(r90)],
        "problems": problems,
    }


def build_report(page_url: str, monitors: list[dict]) -> dict:
    rows = sorted((sticky_row(m, page_url) for m in monitors), key=lambda r: (ORDER[r["state"]], r["name"]))
    counts = {s: sum(r["state"] == s for r in rows) for s in ORDER}
    return {
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "counts": counts,
        "subtitle": "30 d · 90 d",
        "col_widths": [52, 52],
        "rows": rows,
    }


ICON = {"ok": "🟢", "warn": "🟡", "down": "🔴", "paused": "⏸"}


def _text(rep: dict, page_url: str) -> str:
    c = rep["counts"]
    lines = [
        f"{page_url}   {rep['generated_at']}",
        f"🟢 {c['ok']}  🟡 {c['warn']}  🔴 {c['down']}  ⏸ {c['paused']}",
        "",
    ]
    for r in rep["rows"]:
        r30, r90 = r["cols"]
        lines.append(f"{ICON[r['state']]} {r['name']:<32} 30d {r30:>8}  90d {r90:>8}")
        lines += [f"     · {p}" for p in r["problems"]]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="Stan monitorów z publicznej strony statusu UptimeRobot.")
    ap.add_argument("url", help="adres strony statusu, np. https://stats.uptimerobot.com/AbC123")
    ap.add_argument("--json", action="store_true", help="wyjście JSON (dla widgetu Übersicht)")
    a = ap.parse_args()
    logging.basicConfig(level=logging.WARNING, stream=sys.stderr, format="%(levelname)s %(message)s")

    try:
        rep = build_report(a.url, load_monitors(a.url))
    except (OSError, ValueError, LookupError) as exc:
        # Brak sieci / zły adres / nie-JSON — krótki komunikat zamiast tracebacku;
        # widget pokaże wtedy ostatnie zapamiętane dane.
        log.error("Nie udało się pobrać stanu z %s: %s", a.url, exc)
        if a.json:
            print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 1
    print(json.dumps(rep, ensure_ascii=False) if a.json else _text(rep, a.url))
    return 0


if __name__ == "__main__":
    sys.exit(main())
