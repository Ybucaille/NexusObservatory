import json
import os
from dataclasses import dataclass
from typing import Any

from app.providers.base import ProviderConfigError
from app.services.endpoint_profiles import (
    get_profile_api_key,
    list_enabled_endpoint_profiles,
)
from app.services.secrets import SecretStoreError

DEFAULT_ENDPOINT_ID = "default"
DEFAULT_ENDPOINT_LABEL = "Default custom endpoint"


@dataclass(frozen=True, slots=True)
class CustomEndpointProfile:
    id: str
    label: str
    base_url: str | None
    api_key: str | None
    default_model: str | None

    @property
    def base_url_configured(self) -> bool:
        return _has_value(self.base_url)

    @property
    def api_key_configured(self) -> bool:
        return _has_value(self.api_key)

    @property
    def configured(self) -> bool:
        return self.base_url_configured and self.api_key_configured


def list_custom_endpoint_profiles() -> list[CustomEndpointProfile]:
    profiles = _profiles_from_database()
    env_profiles = _profiles_from_json()
    if env_profiles is not None:
        return _dedupe_profiles([*profiles, *env_profiles])

    return _dedupe_profiles([*profiles, _single_env_profile()])


def get_custom_endpoint_profile(endpoint_id: str | None) -> CustomEndpointProfile:
    profiles = list_custom_endpoint_profiles()
    if not profiles:
        raise ProviderConfigError(
            "CUSTOM_ENDPOINTS_JSON must include at least one endpoint profile."
        )

    if endpoint_id and endpoint_id.strip():
        normalized_endpoint_id = endpoint_id.strip()
        for profile in profiles:
            if profile.id == normalized_endpoint_id:
                return profile

        raise ProviderConfigError(
            f"Custom endpoint profile '{normalized_endpoint_id}' was not found."
        )

    return profiles[0]


def _profiles_from_database() -> list[CustomEndpointProfile]:
    profiles: list[CustomEndpointProfile] = []
    for profile in list_enabled_endpoint_profiles():
        try:
            api_key = get_profile_api_key(profile)
        except SecretStoreError:
            api_key = None

        profiles.append(
            CustomEndpointProfile(
                id=profile.id,
                label=profile.label,
                base_url=profile.base_url,
                api_key=api_key,
                default_model=profile.default_model,
            )
        )

    return profiles


def _profiles_from_json() -> list[CustomEndpointProfile] | None:
    raw_value = os.getenv("CUSTOM_ENDPOINTS_JSON")
    if raw_value is None or not raw_value.strip():
        return None

    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise ProviderConfigError("CUSTOM_ENDPOINTS_JSON must be valid JSON.") from exc

    if not isinstance(parsed, list):
        raise ProviderConfigError("CUSTOM_ENDPOINTS_JSON must be a JSON array.")

    profiles: list[CustomEndpointProfile] = []
    seen_ids: set[str] = set()
    for index, item in enumerate(parsed):
        if not isinstance(item, dict):
            raise ProviderConfigError(
                f"CUSTOM_ENDPOINTS_JSON profile at index {index} must be an object."
            )

        profile_id = _string_field(item, "id")
        label = _string_field(item, "label") or profile_id
        if not profile_id:
            raise ProviderConfigError(
                f"CUSTOM_ENDPOINTS_JSON profile at index {index} requires an id."
            )
        if profile_id in seen_ids:
            raise ProviderConfigError(
                f"CUSTOM_ENDPOINTS_JSON profile id '{profile_id}' is duplicated."
            )

        profiles.append(
            CustomEndpointProfile(
                id=profile_id,
                label=label,
                base_url=_string_field(item, "base_url"),
                api_key=_string_field(item, "api_key"),
                default_model=_string_field(item, "default_model"),
            )
        )
        seen_ids.add(profile_id)

    return profiles


def _single_env_profile() -> CustomEndpointProfile:
    return CustomEndpointProfile(
        id=DEFAULT_ENDPOINT_ID,
        label=DEFAULT_ENDPOINT_LABEL,
        base_url=_get_config("CUSTOM_ENDPOINT_BASE_URL", "OPENAI_COMPATIBLE_BASE_URL"),
        api_key=_get_config("CUSTOM_ENDPOINT_API_KEY", "OPENAI_COMPATIBLE_API_KEY"),
        default_model=_get_config(
            "CUSTOM_ENDPOINT_DEFAULT_MODEL",
            "OPENAI_COMPATIBLE_DEFAULT_MODEL",
        ),
    )


def _dedupe_profiles(
    profiles: list[CustomEndpointProfile],
) -> list[CustomEndpointProfile]:
    deduped_profiles: list[CustomEndpointProfile] = []
    seen_ids: set[str] = set()
    for profile in profiles:
        if profile.id in seen_ids:
            continue

        deduped_profiles.append(profile)
        seen_ids.add(profile.id)

    return deduped_profiles


def _get_config(name: str, fallback_name: str) -> str | None:
    value = os.getenv(name)
    if _has_value(value):
        return value.strip()

    fallback_value = os.getenv(fallback_name)
    if _has_value(fallback_value):
        return fallback_value.strip()

    return None


def _string_field(item: dict[str, Any], name: str) -> str | None:
    value = item.get(name)
    if isinstance(value, str) and value.strip():
        return value.strip()

    return None


def _has_value(value: str | None) -> bool:
    return value is not None and bool(value.strip())
