import json
from dataclasses import dataclass
from typing import Any

from app.database import database_connection, init_database
from app.schemas.run import RunCreate
from app.schemas.trace_event import TraceEventCreate
from app.services.runs import create_run
from app.services.traces import create_trace_events

DEMO_SOURCE = "demo-seed"


@dataclass(frozen=True, slots=True)
class DemoRun:
    prompt: str
    response: str | None
    model_name: str
    provider: str
    status: str
    latency_ms: int | None
    input_tokens: int | None
    output_tokens: int | None
    estimated_cost: float
    error_message: str | None
    metadata: dict[str, Any]

    @property
    def total_tokens(self) -> int | None:
        if self.input_tokens is None or self.output_tokens is None:
            return None
        return self.input_tokens + self.output_tokens


DEMO_RUNS: tuple[DemoRun, ...] = (
    DemoRun(
        prompt="Summarize the latest retrieval trace and identify the slowest step.",
        response=(
            "The retrieval trace completed successfully. Vector search accounted "
            "for most of the latency, followed by answer synthesis. The run is "
            "healthy but would benefit from caching repeated embeddings."
        ),
        model_name="mock-model",
        provider="mock",
        status="success",
        latency_ms=118,
        input_tokens=14,
        output_tokens=33,
        estimated_cost=0.0,
        error_message=None,
        metadata={"scenario": "retrieval-observability", "temperature": 0.2},
    ),
    DemoRun(
        prompt="Rewrite this support response so it is concise and calm.",
        response=(
            "I understand the issue. Please restart the worker, confirm the queue "
            "is draining, and send the request id if the error appears again."
        ),
        model_name="gpt-4o-mini",
        provider="openai_compatible",
        status="success",
        latency_ms=642,
        input_tokens=19,
        output_tokens=29,
        estimated_cost=0.0002,
        error_message=None,
        metadata={"scenario": "support-rewrite", "temperature": 0.4},
    ),
    DemoRun(
        prompt="Classify this incident: model timeout after 30 seconds during batch evaluation.",
        response=(
            "Category: provider_timeout. Severity: medium. Suggested action: "
            "reduce batch size, inspect provider latency, and retry with backoff."
        ),
        model_name="llama3.1",
        provider="openai_compatible",
        status="success",
        latency_ms=921,
        input_tokens=16,
        output_tokens=25,
        estimated_cost=0.0,
        error_message=None,
        metadata={"scenario": "incident-classification", "temperature": 0.1},
    ),
    DemoRun(
        prompt="Generate three acceptance criteria for an AI observability dashboard.",
        response=(
            "1. Runs are persisted with prompt, response, provider and latency. "
            "2. Failed executions show readable errors. 3. Run detail pages show "
            "trace events that explain the execution flow."
        ),
        model_name="gpt-4o-mini",
        provider="openai_compatible",
        status="success",
        latency_ms=488,
        input_tokens=13,
        output_tokens=36,
        estimated_cost=0.00018,
        error_message=None,
        metadata={"scenario": "product-planning", "temperature": 0.7},
    ),
    DemoRun(
        prompt="Explain why the prompt execution failed in plain English.",
        response=None,
        model_name="gpt-4o-mini",
        provider="openai_compatible",
        status="error",
        latency_ms=1504,
        input_tokens=11,
        output_tokens=0,
        estimated_cost=0.0,
        error_message=(
            "OpenAI-compatible provider returned 404: The requested model was not found."
        ),
        metadata={"scenario": "provider-error", "temperature": 0.7},
    ),
    DemoRun(
        prompt="Compare response quality between a local mock and a configured model.",
        response=(
            "The configured model gives more specific reasoning, while the mock "
            "provider is useful for deterministic UI and API validation."
        ),
        model_name="mock-model",
        provider="mock",
        status="success",
        latency_ms=74,
        input_tokens=12,
        output_tokens=24,
        estimated_cost=0.0,
        error_message=None,
        metadata={"scenario": "model-lab-baseline", "temperature": 0.0},
    ),
    DemoRun(
        prompt="Extract the key metrics from this run: 812ms latency, 41 input tokens, 73 output tokens.",
        response=(
            "Latency: 812 ms. Input tokens: 41. Output tokens: 73. Total tokens: "
            "114. The run is within the expected latency range."
        ),
        model_name="llama3.1",
        provider="openai_compatible",
        status="success",
        latency_ms=812,
        input_tokens=41,
        output_tokens=73,
        estimated_cost=0.0,
        error_message=None,
        metadata={"scenario": "metric-extraction", "temperature": 0.2},
    ),
)


def seed_demo_data() -> tuple[int, int]:
    init_database()
    deleted_runs = clear_demo_data()

    created_runs = 0
    for index, demo_run in enumerate(DEMO_RUNS, start=1):
        run = create_run(
            RunCreate(
                prompt=demo_run.prompt,
                response=demo_run.response,
                model_name=demo_run.model_name,
                provider=demo_run.provider,
                status=demo_run.status,
                latency_ms=demo_run.latency_ms,
                input_tokens=demo_run.input_tokens,
                output_tokens=demo_run.output_tokens,
                total_tokens=demo_run.total_tokens,
                estimated_cost=demo_run.estimated_cost,
                error_message=demo_run.error_message,
                metadata={
                    **demo_run.metadata,
                    "source": DEMO_SOURCE,
                    "demo_index": index,
                },
            )
        )
        create_trace_events(_trace_events_for_run(run.id, demo_run))
        created_runs += 1

    return deleted_runs, created_runs


def clear_demo_data() -> int:
    with database_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, metadata
            FROM runs
            """
        ).fetchall()
        run_ids = [
            row["id"]
            for row in rows
            if _metadata_has_demo_source(row["metadata"])
        ]

        if not run_ids:
            return 0

        placeholders = ", ".join("?" for _ in run_ids)
        connection.execute(
            f"DELETE FROM trace_events WHERE run_id IN ({placeholders})",
            run_ids,
        )
        connection.execute(
            f"DELETE FROM runs WHERE id IN ({placeholders})",
            run_ids,
        )
        connection.commit()

    return len(run_ids)


def _metadata_has_demo_source(metadata_json: str) -> bool:
    try:
        metadata = json.loads(metadata_json)
    except json.JSONDecodeError:
        return False

    return isinstance(metadata, dict) and metadata.get("source") == DEMO_SOURCE


def _trace_events_for_run(run_id: int, demo_run: DemoRun) -> list[TraceEventCreate]:
    base_metadata = {
        "source": DEMO_SOURCE,
        "provider": demo_run.provider,
        "model": demo_run.model_name,
    }
    events = [
        TraceEventCreate(
            run_id=run_id,
            type="request_received",
            title="Request received",
            message="Demo execution request accepted by the API.",
            metadata={**base_metadata, "prompt_length": len(demo_run.prompt)},
        ),
        TraceEventCreate(
            run_id=run_id,
            type="provider_selected",
            title="Provider selected",
            message=f"Selected provider '{demo_run.provider}'.",
            metadata=base_metadata,
        ),
        TraceEventCreate(
            run_id=run_id,
            type="provider_call_started",
            title="Provider call started",
            message="Provider generation call started.",
            metadata=base_metadata,
        ),
    ]

    if demo_run.status == "error":
        events.append(
            TraceEventCreate(
                run_id=run_id,
                type="error",
                title="Provider error",
                message=demo_run.error_message or "Demo provider call failed.",
                duration_ms=demo_run.latency_ms,
                metadata={**base_metadata, "status": demo_run.status},
            )
        )
    else:
        events.append(
            TraceEventCreate(
                run_id=run_id,
                type="provider_call_finished",
                title="Provider call finished",
                message="Provider generation call completed successfully.",
                duration_ms=demo_run.latency_ms,
                metadata={
                    **base_metadata,
                    "input_tokens": demo_run.input_tokens,
                    "output_tokens": demo_run.output_tokens,
                    "total_tokens": demo_run.total_tokens,
                },
            )
        )

    events.append(
        TraceEventCreate(
            run_id=run_id,
            type="run_stored",
            title="Run stored",
            message="Execution result was persisted as a run.",
            metadata={**base_metadata, "run_id": run_id},
        )
    )

    return events


def main() -> None:
    deleted_runs, created_runs = seed_demo_data()
    print(
        f"Seeded {created_runs} demo runs "
        f"after clearing {deleted_runs} previous demo runs."
    )


if __name__ == "__main__":
    main()
