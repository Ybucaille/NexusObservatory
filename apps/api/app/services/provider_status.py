import os

from app.schemas.provider import ProviderStatus, ProviderStatusResponse


def get_provider_status() -> ProviderStatusResponse:
    base_url_configured = _is_configured("OPENAI_COMPATIBLE_BASE_URL")
    api_key_configured = _is_configured("OPENAI_COMPATIBLE_API_KEY")
    default_model = os.getenv("OPENAI_COMPATIBLE_DEFAULT_MODEL")
    normalized_default_model = (
        default_model.strip() if default_model and default_model.strip() else None
    )

    return ProviderStatusResponse(
        providers=[
            ProviderStatus(
                name="mock",
                available=True,
                configured=True,
                default_model="mock-model",
            ),
            ProviderStatus(
                name="openai_compatible",
                available=True,
                configured=base_url_configured and api_key_configured,
                base_url_configured=base_url_configured,
                api_key_configured=api_key_configured,
                default_model=normalized_default_model,
            ),
        ]
    )


def _is_configured(name: str) -> bool:
    value = os.getenv(name)
    return bool(value and value.strip())
