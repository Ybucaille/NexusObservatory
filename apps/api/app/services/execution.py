from time import perf_counter

from app.models.run import Run
from app.providers import get_provider
from app.schemas.run import RunCreate, RunExecuteRequest
from app.services.runs import create_run


def execute_run(payload: RunExecuteRequest) -> Run:
    provider = get_provider(payload.provider)

    started_at = perf_counter()
    result = provider.generate(prompt=payload.prompt, model=payload.model)
    latency_ms = round((perf_counter() - started_at) * 1000)

    return create_run(
        RunCreate(
            prompt=payload.prompt,
            response=result.response,
            model_name=result.model_name or payload.model,
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
