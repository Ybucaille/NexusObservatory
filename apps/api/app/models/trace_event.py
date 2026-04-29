import json
from dataclasses import dataclass
from datetime import datetime
from sqlite3 import Row
from typing import Any


@dataclass(slots=True)
class TraceEvent:
    id: int
    run_id: int
    created_at: datetime
    type: str
    title: str
    message: str
    duration_ms: int | None
    metadata: dict[str, Any]

    @classmethod
    def from_row(cls, row: Row) -> "TraceEvent":
        return cls(
            id=row["id"],
            run_id=row["run_id"],
            created_at=datetime.fromisoformat(row["created_at"]),
            type=row["type"],
            title=row["title"],
            message=row["message"],
            duration_ms=row["duration_ms"],
            metadata=json.loads(row["metadata"]),
        )
