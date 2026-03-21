import re
from datetime import datetime, timezone
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
BACKUP_DIR = BASE_DIR.parent / "data" / "backups"
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