from dataclasses import dataclass
from datetime import datetime
from sqlite3 import Row


@dataclass(slots=True)
class EndpointProfile:
    id: str
    label: str
    base_url: str
    default_model: str | None
    enabled: bool
    secret_ref: str | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_row(cls, row: Row) -> "EndpointProfile":
        return cls(
            id=row["id"],
            label=row["label"],
            base_url=row["base_url"],
            default_model=row["default_model"],
            enabled=bool(row["enabled"]),
            secret_ref=row["secret_ref"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )
