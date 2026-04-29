from pydantic import BaseModel


class ProviderStatus(BaseModel):
    name: str
    available: bool
    configured: bool
    default_model: str | None = None
    base_url_configured: bool | None = None
    api_key_configured: bool | None = None


class ProviderStatusResponse(BaseModel):
    providers: list[ProviderStatus]
