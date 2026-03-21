from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parents[2]
INDEX_SYNC_STATE_PATH = BASE_DIR.parent / "data" / "index-sync-state.json"

DEFAULT_INDEX_SYNC_STATE = {
    "updatedSince": "",
    "lastRunAt": "",
    "lastSuccessAt": "",
    "lastError": "",
}


def read_index_sync_state() -> dict[str, Any]:
    try:
        payload = json.loads(INDEX_SYNC_STATE_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        payload = {}
    except (json.JSONDecodeError, OSError):
        payload = {}

    return {
        "updatedSince": str(payload.get("updatedSince") or "").strip(),
        "lastRunAt": str(payload.get("lastRunAt") or "").strip(),
        "lastSuccessAt": str(payload.get("lastSuccessAt") or "").strip(),
        "lastError": str(payload.get("lastError") or "").strip(),
    }


def build_index_sync_status_payload() -> dict[str, Any]:
    state = read_index_sync_state()
    enabled = str(os.getenv("DJANGO_INDEX_SYNC_ENABLED", "true")).strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    startup = str(os.getenv("DJANGO_INDEX_SYNC_STARTUP", "false")).strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }

    try:
        interval_ms = int(str(os.getenv("DJANGO_INDEX_SYNC_INTERVAL_MS", "3600000")).strip())
    except ValueError:
        interval_ms = 3600000

    try:
        default_max_pages = int(str(os.getenv("DJANGO_INDEX_SYNC_MAX_PAGES", "50")).strip())
    except ValueError:
        default_max_pages = 50

    try:
        default_page_size = int(str(os.getenv("DJANGO_INDEX_SYNC_PAGE_SIZE", "200")).strip())
    except ValueError:
        default_page_size = 200

    runtime = {
        "lastRunAt": state["lastRunAt"],
        "lastSuccessAt": state["lastSuccessAt"],
        "lastError": state["lastError"],
        "lastSummary": None,
    }

    return {
        "running": False,
        "config": {
            "enabled": enabled,
            "intervalMs": interval_ms,
            "startup": startup,
            "defaultMaxPages": default_max_pages,
            "defaultPageSize": default_page_size,
            "hasDjangoAdminToken": bool(str(os.getenv("DJANGO_ADMIN_TOKEN", "")).strip()),
        },
        "runtime": runtime,
        "state": state,
    }