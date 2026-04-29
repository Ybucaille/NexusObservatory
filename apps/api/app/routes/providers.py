from fastapi import APIRouter

from app.schemas.provider import ProviderStatusResponse
from app.services.provider_status import get_provider_status

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("/status", response_model=ProviderStatusResponse)
async def provider_status_route() -> ProviderStatusResponse:
    return get_provider_status()
