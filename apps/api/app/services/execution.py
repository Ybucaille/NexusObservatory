from time import perf_counter
from typing import Any

from app.models.run import Run
from app.providers import get_provider
from app.schemas.run import RunCreate, RunExecuteRequest
from app.schemas.trace_event import TraceEventCreate
from app.services.runs import create_run
from app.services.traces import create_trace_events


def execute_run(payload: RunExecuteRequest) -> Run:
    pending_trace_events: list[dict[str, Any]] = []
    pending_trace_events.append(
        _trace_event(
            type="request_received",
            title="Request received",
            message="Run execution request accepted by the API.",
            metadata={
                "provider": payload.provider,
                "model": payload.model,
                "prompt_length": len(payload.prompt),
            },
        )
    )
    provider = get_provider(payload.provider)
    pending_trace_events.append(
        _trace_event(
            type="provider_selected",
            title="Provider selected",
            message=f"Selected provider '{provider.name}'.",
            metadata={
                "provider": provider.name,
                "requested_model": payload.model,
            },
        )
    )

    pending_trace_events.append(
        _trace_event(
            type="provider_call_started",
            title="Provider call started",
            message="Provider generation call started.",
            metadata={
                "provider": provider.name,
                "model": payload.model,
            },
        )
    )
    started_at = perf_counter()
    result = provider.generate(prompt=payload.prompt, model=payload.model)
    latency_ms = round((perf_counter() - started_at) * 1000)
    model_name = result.model_name or payload.model
    pending_trace_events.append(
        _trace_event(
            type="provider_call_finished",
            title="Provider call finished",
            message="Provider generation call completed successfully.",
            duration_ms=latency_ms,
            metadata={
                "provider": provider.name,
                "model": model_name,
                "input_tokens": result.input_tokens,
                "output_tokens": result.output_tokens,
                "total_tokens": result.total_tokens,
            },
        )
    )

    run = create_run(
        RunCreate(
            prompt=payload.prompt,
            response=result.response,
            model_name=model_name,
            provider=payload.provider,
            status="success",
            latency_ms=latency_ms,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            total_tokens=result.total_tokens,
            estimated_cost=0,
            metadata=result.metadata,
        )
    )
    pending_trace_events.append(
        _trace_event(
            type="run_stored",
            title="Run stored",
            message="Execution result was persisted as a run.",
            metadata={"run_id": run.id},
        )
    )
    create_trace_events(
        [
            TraceEventCreate(run_id=run.id, **pending_trace_event)
            for pending_trace_event in pending_trace_events
        ]
    )

    return run


def _trace_event(
    *,
    type: str,
    title: str,
    message: str,
    duration_ms: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "type": type,
        "title": title,
        "message": message,
        "duration_ms": duration_ms,
        "metadata": metadata or {},
    }
