import csv
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .admin_overview_service import filter_by_date_range, parse_range_to_since
from .analytics_service import read_analytics

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR.parent / "data"
ANALYTICS_PATH = DATA_DIR / "analytics.json"
BACKUP_DIR = DATA_DIR / "backups"
MAX_BACKUP_FILES = max(5, min(10000, int(__import__("os").getenv("MAX_BACKUP_FILES", "120"))))

ALLOWED_BACKUP_REASONS = {
    "startup",
    "scheduled",
    "write",
    "manual",
    "pre-restore",
    "restored",
    "unknown",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _stamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace(":", "-").replace(".", "-")


def _ensure_paths() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    if not ANALYTICS_PATH.exists():
        ANALYTICS_PATH.write_text(
            json.dumps({"searches": [], "pageViews": []}, indent=2),
            encoding="utf-8",
        )


def _prune_backups() -> None:
    backups = sorted(
        [file for file in BACKUP_DIR.glob("analytics-*.json") if file.is_file()],
        key=lambda file: file.stat().st_mtime,
        reverse=True,
    )
    for stale in backups[MAX_BACKUP_FILES:]:
        try:
            stale.unlink(missing_ok=True)
        except Exception:
            continue


def create_backup(reason: str = "manual", *, force: bool = True) -> dict[str, Any]:
    _ensure_paths()
    normalized_reason = reason if reason in ALLOWED_BACKUP_REASONS else "unknown"

    file_name = f"analytics-{_stamp()}-{normalized_reason}.json"
    target = BACKUP_DIR / file_name
    shutil.copyfile(ANALYTICS_PATH, target)

    if force:
        _prune_backups()

    stat = target.stat()
    return {
        "fileName": file_name,
        "sizeBytes": int(stat.st_size),
        "createdAt": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat().replace("+00:00", "Z"),
        "reason": normalized_reason,
    }


def list_backups(reason: str = "all") -> list[dict[str, Any]]:
    _ensure_paths()
    normalized_filter = reason if reason != "all" else "all"

    entries: list[dict[str, Any]] = []
    for file in BACKUP_DIR.glob("analytics-*.json"):
        if not file.is_file():
            continue

        name = file.name
        detected_reason = "unknown"
        for candidate in ALLOWED_BACKUP_REASONS:
            if name.endswith(f"-{candidate}.json"):
                detected_reason = candidate
                break

        if normalized_filter != "all" and detected_reason != normalized_filter:
            continue

        stat = file.stat()
        entries.append(
            {
                "fileName": name,
                "sizeBytes": int(stat.st_size),
                "createdAt": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat().replace("+00:00", "Z"),
                "reason": detected_reason,
            }
        )

    entries.sort(key=lambda item: item.get("createdAt") or "", reverse=True)
    return entries[:100]


def is_allowed_backup_reason(reason: str) -> bool:
    return reason in ALLOWED_BACKUP_REASONS


def sanitize_backup_file_name(file_name: str) -> str:
    name = Path(str(file_name or "").strip()).name
    if not name or not name.startswith("analytics-") or not name.endswith(".json"):
        return ""
    return name


def resolve_backup_file_path(file_name: str) -> Path | None:
    _ensure_paths()
    name = sanitize_backup_file_name(file_name)
    if not name:
        return None
    path = BACKUP_DIR / name
    if not path.exists() or not path.is_file():
        return None
    return path


def restore_backup(file_name: str) -> dict[str, Any]:
    source = resolve_backup_file_path(file_name)
    if source is None:
        raise FileNotFoundError("Backup file not found.")

    create_backup("pre-restore", force=True)
    shutil.copyfile(source, ANALYTICS_PATH)
    create_backup("restored", force=True)

    return {
        "ok": True,
        "restoredFrom": source.name,
        "generatedAt": _now_iso(),
    }


def build_export_csv(range_value: str) -> str:
    normalized_range = range_value if range_value in {"all", "24h", "7d", "30d"} else "all"

    analytics = read_analytics()
    all_searches = list(analytics.get("searches") or [])
    all_page_views = list(analytics.get("pageViews") or [])

    since = parse_range_to_since(normalized_range)
    searches = filter_by_date_range(all_searches, since)
    page_views = filter_by_date_range(all_page_views, since)

    rows: list[list[Any]] = [
        [
            "rowType",
            "timestamp",
            "query",
            "resultCount",
            "page",
            "ip",
            "userAgent",
            "count",
            "percent",
            "range",
        ]
    ]

    for item in searches:
        rows.append(
            [
                "search",
                item.get("at") or "",
                item.get("query") or "",
                item.get("resultCount") or 0,
                "",
                item.get("ip") or "",
                "",
                "",
                "",
                normalized_range,
            ]
        )

    for item in page_views:
        rows.append(
            [
                "page_view",
                item.get("at") or "",
                "",
                "",
                item.get("page") or "",
                item.get("ip") or "",
                item.get("userAgent") or "",
                "",
                "",
                normalized_range,
            ]
        )

    from io import StringIO

    output = StringIO()
    writer = csv.writer(output)
    writer.writerows(rows)
    return output.getvalue()
