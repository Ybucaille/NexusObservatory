from app.providers.custom_endpoint_config import list_custom_endpoint_profiles
from app.schemas.provider import (
    CustomEndpointProfileStatus,
    ProviderStatus,
    ProviderStatusResponse,
)


def get_provider_status() -> ProviderStatusResponse:
    endpoint_profiles = [
        CustomEndpointProfileStatus(
            id=profile.id,
            label=profile.label,
            configured=profile.configured,
            base_url_configured=profile.base_url_configured,
            api_key_configured=profile.api_key_configured,
            default_model=profile.default_model,
        )
        for profile in list_custom_endpoint_profiles()
    ]
    configured_profiles = [
        profile for profile in endpoint_profiles if profile.configured
    ]
    default_model = (
        configured_profiles[0].default_model
        if configured_profiles
        else endpoint_profiles[0].default_model
        if endpoint_profiles
        else None
    )
    base_url_configured = any(
        profile.base_url_configured for profile in endpoint_profiles
    )
    api_key_configured = any(
        profile.api_key_configured for profile in endpoint_profiles
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
                configured=any(profile.configured for profile in endpoint_profiles),
                base_url_configured=base_url_configured,
                api_key_configured=api_key_configured,
                default_model=default_model,
                endpoint_profiles=endpoint_profiles,
            ),
        ]
    )
