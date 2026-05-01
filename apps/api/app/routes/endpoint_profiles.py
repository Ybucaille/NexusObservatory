from fastapi import APIRouter, HTTPException, Path, Response, status

from app.schemas.endpoint_profile import (
    EndpointProfileCreate,
    EndpointProfileResponse,
    EndpointProfileUpdate,
)
from app.services.endpoint_profiles import (
    EndpointProfileAlreadyExistsError,
    EndpointProfileNotFoundError,
    create_endpoint_profile,
    delete_endpoint_profile,
    endpoint_profile_to_response,
    list_endpoint_profiles,
    update_endpoint_profile,
)
from app.services.secrets import SecretStoreError

router = APIRouter(prefix="/endpoint-profiles", tags=["endpoint-profiles"])


@router.get("", response_model=list[EndpointProfileResponse])
async def list_endpoint_profiles_route() -> list[EndpointProfileResponse]:
    return [
        endpoint_profile_to_response(profile)
        for profile in list_endpoint_profiles()
    ]


@router.post(
    "",
    response_model=EndpointProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_endpoint_profile_route(
    payload: EndpointProfileCreate,
) -> EndpointProfileResponse:
    try:
        profile = create_endpoint_profile(payload)
    except EndpointProfileAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except SecretStoreError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return endpoint_profile_to_response(profile)


@router.patch("/{profile_id}", response_model=EndpointProfileResponse)
async def update_endpoint_profile_route(
    payload: EndpointProfileUpdate,
    profile_id: str = Path(..., min_length=1),
) -> EndpointProfileResponse:
    try:
        profile = update_endpoint_profile(profile_id, payload)
    except EndpointProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except SecretStoreError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return endpoint_profile_to_response(profile)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_endpoint_profile_route(
    profile_id: str = Path(..., min_length=1),
) -> Response:
    try:
        delete_endpoint_profile(profile_id)
    except EndpointProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except SecretStoreError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)
