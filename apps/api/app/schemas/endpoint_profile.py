from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EndpointProfileCreate(BaseModel):
    id: str = Field(..., min_length=1, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_.-]*$")
    label: str = Field(..., min_length=1)
    base_url: str = Field(..., min_length=1)
    default_model: str | None = None
    enabled: bool = True
    api_key: str | None = None


class EndpointProfileUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1)
    base_url: str | None = Field(default=None, min_length=1)
    default_model: str | None = None
    enabled: bool | None = None
    api_key: str | None = None
    clear_api_key: bool = False


class EndpointProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    label: str
    base_url: str
    default_model: str | None = None
    enabled: bool
    api_key_configured: bool
    created_at: datetime
    updated_at: datetime
