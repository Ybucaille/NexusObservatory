from fastapi import APIRouter, HTTPException, Path, status

from app.schemas.run import RunCreate, RunResponse
from app.services.runs import create_run, get_run, list_runs

router = APIRouter(prefix="/runs", tags=["runs"])


@router.post("", response_model=RunResponse, status_code=status.HTTP_201_CREATED)
async def create_run_route(payload: RunCreate) -> RunResponse:
    return RunResponse.model_validate(create_run(payload))


@router.get("", response_model=list[RunResponse])
async def list_runs_route() -> list[RunResponse]:
    return [RunResponse.model_validate(run) for run in list_runs()]


@router.get("/{run_id}", response_model=RunResponse)
async def get_run_route(run_id: int = Path(..., gt=0)) -> RunResponse:
    run = get_run(run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run {run_id} was not found.",
        )

    return RunResponse.model_validate(run)
