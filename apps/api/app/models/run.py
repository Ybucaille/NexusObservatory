import json
from dataclasses import dataclass
from datetime import datetime
from sqlite3 import Row
from typing import Any


@dataclass(slots=True)
class Run:
    id: int
    created_at: datetime
    updated_at: datetime
    prompt: str
    response: str | None
    model_name: str
    provider: str
    status: str
    latency_ms: int | None
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None
    estimated_cost: float | None
    error_message: str | None
    metadata: dict[str, Any]

    @classmethod
    def from_row(cls, row: Row) -> "Run":
        return cls(
            id=row["id"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            prompt=row["prompt"],
            response=row["response"],
            model_name=row["model_name"],
            provider=row["provider"],
            status=row["status"],
            latency_ms=row["latency_ms"],
            input_tokens=row["input_tokens"],
            output_tokens=row["output_tokens"],
            total_tokens=row["total_tokens"],
            estimated_cost=row["estimated_cost"],
            error_message=row["error_message"],
            metadata=json.loads(row["metadata"]),
        )
