import re
import shutil
from datetime import datetime, timezone
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
BACKUP_DIR = BASE_DIR.parent / "data" / "backups"
SEARCH_INDEX_PATH = BASE_DIR.parent / "data" / "search-index.json"
BACKUP_REASON_PATTERN = re.compile(
    r"^search-index-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-(.+)\.json$",
    re.IGNORECASE,
)


def list_search_index_backups(reason: str = "all") -> list[dict]:
    if not BACKUP_DIR.exists():
        return []

    normalized_reason = str(reason or "all").strip().lower() or "all"
    backups: list[dict] = []

    for file in BACKUP_DIR.glob("search-index-*.json"):
        if not file.is_file():
            continue

        match = BACKUP_REASON_PATTERN.match(file.name)
        detected_reason = str(match.group(1) if match else "unknown").lower()
        if normalized_reason != "all" and detected_reason != normalized_reason:
            continue

        stat = file.stat()
        backups.append(
            {
                "fileName": file.name,
                "sizeBytes": int(stat.st_size),
                "createdAt": datetime.fromtimestamp(
                    stat.st_mtime,
                    tz=timezone.utc,
                )
                .isoformat()
                .replace("+00:00", "Z"),
                "reason": detected_reason,
            }
        )

    backups.sort(key=lambda item: str(item.get("createdAt") or ""), reverse=True)
    return backups


def _safe_file_stamp() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
        .replace(":", "-")
        .replace(".", "-")
    )


def _safe_reason(reason: str) -> str:
    normalized = re.sub(r"[^a-z0-9-]+", "-", str(reason or "manual").strip().lower())
    normalized = normalized.strip("-")
    return normalized or "manual"


def sanitize_search_index_backup_file_name(file_name: str) -> str:
    name = Path(str(file_name or "").strip()).name
    if not name or not name.startswith("search-index-") or not name.lower().endswith(".json"):
        return ""
    return name


def backup_search_index(reason: str = "manual") -> str | None:
    if not SEARCH_INDEX_PATH.exists():
        return None

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    target_name = f"search-index-{_safe_file_stamp()}-{_safe_reason(reason)}.json"
    shutil.copyfile(SEARCH_INDEX_PATH, BACKUP_DIR / target_name)
    return target_name


def restore_search_index_from_backup(
    file_name: str,
    *,
    create_backup: bool = True,
) -> dict:
    sanitized = sanitize_search_index_backup_file_name(file_name)
    if not sanitized:
        raise ValueError("Invalid search-index backup file name.")

    source_path = BACKUP_DIR / sanitized
    if not source_path.exists() or not source_path.is_file():
        raise FileNotFoundError("Search-index backup file not found.")

    pre_restore_backup = backup_search_index("pre-restore") if create_backup else None
    shutil.copyfile(source_path, SEARCH_INDEX_PATH)

    return {
        "restoredFrom": sanitized,
        "preRestoreBackup": pre_restore_backup,
    }
