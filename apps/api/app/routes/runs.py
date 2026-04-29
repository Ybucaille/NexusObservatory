from fastapi import APIRouter, HTTPException, Path, status

from app.providers.base import ProviderCallError, ProviderConfigError
from app.providers.registry import UnsupportedProviderError
from app.schemas.run import (
    RunCompareRequest,
    RunCompareResponse,
    RunCreate,
    RunExecuteRequest,
    RunResponse,
)
from app.schemas.trace_event import TraceEventResponse
from app.services.comparison import compare_runs
from app.services.execution import execute_run
from app.services.runs import create_run, get_run, list_runs
from app.services.traces import list_trace_events

router = APIRouter(prefix="/runs", tags=["runs"])


@router.post("", response_model=RunResponse, status_code=status.HTTP_201_CREATED)
async def create_run_route(payload: RunCreate) -> RunResponse:
    return RunResponse.model_validate(create_run(payload))


@router.get("", response_model=list[RunResponse])
async def list_runs_route() -> list[RunResponse]:
    return [RunResponse.model_validate(run) for run in list_runs()]


@router.post("/execute", response_model=RunResponse, status_code=status.HTTP_201_CREATED)
async def execute_run_route(payload: RunExecuteRequest) -> RunResponse:
    try:
        run = execute_run(payload)
    except UnsupportedProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except ProviderConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except ProviderCallError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return RunResponse.model_validate(run)


@router.post("/compare", response_model=RunCompareResponse)
async def compare_runs_route(payload: RunCompareRequest) -> RunCompareResponse:
    return compare_runs(payload)


@router.get("/{run_id}/trace", response_model=list[TraceEventResponse])
async def list_run_trace_route(
    run_id: int = Path(..., gt=0),
) -> list[TraceEventResponse]:
    run = get_run(run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run {run_id} was not found.",
        )

    return [
        TraceEventResponse.model_validate(trace_event)
        for trace_event in list_trace_events(run_id)
    ]


@router.get("/{run_id}", response_model=RunResponse)
async def get_run_route(run_id: int = Path(..., gt=0)) -> RunResponse:
    run = get_run(run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run {run_id} was not found.",
        )

    return RunResponse.model_validate(run)
