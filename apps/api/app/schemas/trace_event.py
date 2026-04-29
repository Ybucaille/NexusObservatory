from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TraceEventCreate(BaseModel):
    run_id: int = Field(..., gt=0)
    type: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)
    duration_ms: int | None = Field(default=None, ge=0)
    metadata: dict[str, Any] = Field(default_factory=dict)


class TraceEventResponse(TraceEventCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
