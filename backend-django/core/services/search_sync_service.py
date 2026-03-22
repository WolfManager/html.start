"""
Service for Django index synchronization.
Handles fetching documents from Django, merging with local index, and managing watermark state.
"""

import json
from pathlib import Path
from datetime import datetime, timezone
import hashlib


def _get_state_path():
    """Get absolute path to sync state file."""
    return Path(__file__).resolve().parents[2].parent / "data" / "index-sync-state.json"


def read_django_sync_state():
    """
    Read current django sync state from file.
    """
    state_path = _get_state_path()
    try:
        with open(state_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {
            "updatedSince": "",
            "lastRunAt": "",
            "lastSuccessAt": "",
            "lastError": "",
        }


def update_django_sync_state(updated_since="", last_run_at="", last_success_at="", last_error=""):
    """
    Persist updated django sync state to file.
    """
    state_path = _get_state_path()
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state = {
        "updatedSince": updated_since,
        "lastRunAt": last_run_at,
        "lastSuccessAt": last_success_at,
        "lastError": last_error,
    }
    state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    return state


def reset_watermark(updated_since=""):
    """
    Reset or update the watermark for incremental sync.
    Clears lastError field.
    """
    state = read_django_sync_state()

    # Update watermark
    if updated_since:
        # Validate ISO datetime format
        try:
            datetime.fromisoformat(updated_since.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            raise ValueError(f"Invalid ISO datetime format: {updated_since}")
        state["updatedSince"] = updated_since
    else:
        state["updatedSince"] = ""

    # Clear error
    state["lastError"] = ""

    # Persist
    state_path = _get_state_path()
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")

    return state


def build_sync_state_payload(state):
    """
    Build the state dict for response payload.
    """
    return {
        "updatedSince": state.get("updatedSince", ""),
        "lastRunAt": state.get("lastRunAt", ""),
        "lastSuccessAt": state.get("lastSuccessAt", ""),
        "lastError": state.get("lastError", ""),
    }
