import os

from app.schemas.provider import ProviderStatus, ProviderStatusResponse


def get_provider_status() -> ProviderStatusResponse:
    base_url_configured = _is_configured(
        "CUSTOM_ENDPOINT_BASE_URL",
        "OPENAI_COMPATIBLE_BASE_URL",
    )
    api_key_configured = _is_configured(
        "CUSTOM_ENDPOINT_API_KEY",
        "OPENAI_COMPATIBLE_API_KEY",
    )
    default_model = _get_config(
        "CUSTOM_ENDPOINT_DEFAULT_MODEL",
        "OPENAI_COMPATIBLE_DEFAULT_MODEL",
    )
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
                name="custom_endpoint",
                available=True,
                configured=base_url_configured and api_key_configured,
                base_url_configured=base_url_configured,
                api_key_configured=api_key_configured,
                default_model=normalized_default_model,
            ),
        ]
    )


def _is_configured(name: str, fallback_name: str) -> bool:
    return _get_config(name, fallback_name) is not None


def _get_config(name: str, fallback_name: str) -> str | None:
    value = os.getenv(name)
    if value is not None and value.strip():
        return value

    fallback_value = os.getenv(fallback_name)
    if fallback_value is not None and fallback_value.strip():
        return fallback_value

    return None
