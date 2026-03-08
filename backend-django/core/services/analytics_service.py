import json
import random
import time
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR.parent / "data"
ANALYTICS_PATH = DATA_DIR / "analytics.json"


def _ensure_files() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not ANALYTICS_PATH.exists():
        ANALYTICS_PATH.write_text(
            json.dumps({"searches": [], "pageViews": []}, indent=2),
            encoding="utf-8",
        )


def read_analytics() -> dict[str, Any]:
    _ensure_files()
    try:
        return json.loads(ANALYTICS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"searches": [], "pageViews": []}


def write_analytics(data: dict[str, Any]) -> None:
    _ensure_files()
    ANALYTICS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _trim_list(items: list[dict[str, Any]], max_size: int) -> list[dict[str, Any]]:
    if len(items) <= max_size:
        return items
    return items[-max_size:]


def log_search(*, query: str, result_count: int, ip: str) -> None:
    analytics = read_analytics()
    searches = list(analytics.get("searches") or [])
    searches.append(
        {
            "id": f"s-{int(time.time() * 1000)}-{random.randint(1000, 9999)}",
            "query": query.strip(),
            "resultCount": int(result_count),
            "ip": ip or "unknown",
            "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
    )
    analytics["searches"] = _trim_list(searches, 10000)
    analytics.setdefault("pageViews", [])
    write_analytics(analytics)


def log_page_view(*, page: str, ip: str, user_agent: str) -> None:
    analytics = read_analytics()
    page_views = list(analytics.get("pageViews") or [])
    page_views.append(
        {
            "id": f"p-{int(time.time() * 1000)}-{random.randint(1000, 9999)}",
            "page": (page or "unknown").strip() or "unknown",
            "ip": ip or "unknown",
            "userAgent": user_agent or "unknown",
            "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
    )
    analytics.setdefault("searches", [])
    analytics["pageViews"] = _trim_list(page_views, 20000)
    write_analytics(analytics)
