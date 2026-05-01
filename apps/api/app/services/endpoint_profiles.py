from datetime import UTC, datetime

from app.database import database_connection
from app.models.endpoint_profile import EndpointProfile
from app.schemas.endpoint_profile import (
    EndpointProfileCreate,
    EndpointProfileResponse,
    EndpointProfileUpdate,
)
from app.services.secrets import (
    SecretStoreError,
    SecretStoreUnavailableError,
    build_endpoint_secret_ref,
    get_secret_store,
)


class EndpointProfileAlreadyExistsError(RuntimeError):
    pass


class EndpointProfileNotFoundError(RuntimeError):
    pass


def list_endpoint_profiles() -> list[EndpointProfile]:
    with database_connection() as connection:
        rows = connection.execute(
            """
            SELECT *
            FROM endpoint_profiles
            ORDER BY created_at ASC, id ASC
            """
        ).fetchall()

    return [EndpointProfile.from_row(row) for row in rows]


def list_enabled_endpoint_profiles() -> list[EndpointProfile]:
    with database_connection() as connection:
        rows = connection.execute(
            """
            SELECT *
            FROM endpoint_profiles
            WHERE enabled = 1
            ORDER BY created_at ASC, id ASC
            """
        ).fetchall()

    return [EndpointProfile.from_row(row) for row in rows]


def get_endpoint_profile(profile_id: str) -> EndpointProfile | None:
    with database_connection() as connection:
        row = connection.execute(
            """
            SELECT *
            FROM endpoint_profiles
            WHERE id = ?
            """,
            (profile_id,),
        ).fetchone()

    if row is None:
        return None

    return EndpointProfile.from_row(row)


def create_endpoint_profile(payload: EndpointProfileCreate) -> EndpointProfile:
    existing_profile = get_endpoint_profile(payload.id)
    if existing_profile is not None:
        raise EndpointProfileAlreadyExistsError(
            f"Endpoint profile '{payload.id}' already exists."
        )

    now = datetime.now(UTC)
    secret_ref = None
    if payload.api_key is not None and payload.api_key.strip():
        secret_ref = build_endpoint_secret_ref(payload.id)
        get_secret_store().set_secret(secret_ref, payload.api_key.strip())

    with database_connection() as connection:
        connection.execute(
            """
            INSERT INTO endpoint_profiles (
                id,
                label,
                base_url,
                default_model,
                enabled,
                secret_ref,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.id,
                payload.label.strip(),
                payload.base_url.strip(),
                _normalize_optional_string(payload.default_model),
                1 if payload.enabled else 0,
                secret_ref,
                now.isoformat(),
                now.isoformat(),
            ),
        )
        connection.commit()

    created_profile = get_endpoint_profile(payload.id)
    if created_profile is None:
        raise RuntimeError(
            f"Endpoint profile '{payload.id}' was inserted but could not be read."
        )

    return created_profile


def update_endpoint_profile(
    profile_id: str,
    payload: EndpointProfileUpdate,
) -> EndpointProfile:
    profile = get_endpoint_profile(profile_id)
    if profile is None:
        raise EndpointProfileNotFoundError(
            f"Endpoint profile '{profile_id}' was not found."
        )

    secret_ref = profile.secret_ref
    if payload.clear_api_key:
        if secret_ref is not None:
            get_secret_store().delete_secret(secret_ref)
        secret_ref = None
    elif payload.api_key is not None:
        stripped_api_key = payload.api_key.strip()
        if stripped_api_key:
            secret_ref = secret_ref or build_endpoint_secret_ref(profile.id)
            get_secret_store().set_secret(secret_ref, stripped_api_key)

    now = datetime.now(UTC)
    with database_connection() as connection:
        connection.execute(
            """
            UPDATE endpoint_profiles
            SET label = ?,
                base_url = ?,
                default_model = ?,
                enabled = ?,
                secret_ref = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                payload.label.strip()
                if payload.label is not None
                else profile.label,
                payload.base_url.strip()
                if payload.base_url is not None
                else profile.base_url,
                _normalize_optional_string(payload.default_model)
                if "default_model" in payload.model_fields_set
                else profile.default_model,
                1
                if payload.enabled is True
                else 0
                if payload.enabled is False
                else 1
                if profile.enabled
                else 0,
                secret_ref,
                now.isoformat(),
                profile.id,
            ),
        )
        connection.commit()

    updated_profile = get_endpoint_profile(profile.id)
    if updated_profile is None:
        raise RuntimeError(
            f"Endpoint profile '{profile.id}' was updated but could not be read."
        )

    return updated_profile


def delete_endpoint_profile(profile_id: str) -> None:
    profile = get_endpoint_profile(profile_id)
    if profile is None:
        raise EndpointProfileNotFoundError(
            f"Endpoint profile '{profile_id}' was not found."
        )

    if profile.secret_ref is not None:
        get_secret_store().delete_secret(profile.secret_ref)

    with database_connection() as connection:
        connection.execute(
            """
            DELETE FROM endpoint_profiles
            WHERE id = ?
            """,
            (profile.id,),
        )
        connection.commit()


def endpoint_profile_to_response(
    profile: EndpointProfile,
) -> EndpointProfileResponse:
    return EndpointProfileResponse(
        id=profile.id,
        label=profile.label,
        base_url=profile.base_url,
        default_model=profile.default_model,
        enabled=profile.enabled,
        api_key_configured=_has_secret(profile.secret_ref),
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


def get_profile_api_key(profile: EndpointProfile) -> str | None:
    if profile.secret_ref is None:
        return None

    return get_secret_store().get_secret(profile.secret_ref)


def _has_secret(secret_ref: str | None) -> bool:
    if secret_ref is None:
        return False

    try:
        return get_secret_store().has_secret(secret_ref)
    except SecretStoreUnavailableError:
        return False


def _normalize_optional_string(value: str | None) -> str | None:
    if value is None:
        return None

    stripped_value = value.strip()
    return stripped_value or None
