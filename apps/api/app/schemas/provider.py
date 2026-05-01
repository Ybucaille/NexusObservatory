from pydantic import BaseModel


class CustomEndpointProfileStatus(BaseModel):
    id: str
    label: str
    configured: bool
    base_url_configured: bool
    api_key_configured: bool
    default_model: str | None = None


class ProviderStatus(BaseModel):
    name: str
    available: bool
    configured: bool
    default_model: str | None = None
    base_url_configured: bool | None = None
    api_key_configured: bool | None = None
    endpoint_profiles: list[CustomEndpointProfileStatus] | None = None


class ProviderStatusResponse(BaseModel):
    providers: list[ProviderStatus]
