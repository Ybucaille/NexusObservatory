from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RunStatus(StrEnum):
    success = "success"
    error = "error"
    running = "running"
    cancelled = "cancelled"


class RunCreate(BaseModel):
    prompt: str = Field(..., min_length=1)
    response: str | None = None
    model_name: str = Field(..., min_length=1)
    provider: str = Field(..., min_length=1)
    status: RunStatus = RunStatus.success
    latency_ms: int | None = Field(default=None, ge=0)
    input_tokens: int | None = Field(default=None, ge=0)
    output_tokens: int | None = Field(default=None, ge=0)
    total_tokens: int | None = Field(default=None, ge=0)
    estimated_cost: float | None = Field(default=None, ge=0)
    error_message: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class RunExecuteRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    provider: str = Field(default="mock", min_length=1)
    model: str = ""


class RunResponse(RunCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
