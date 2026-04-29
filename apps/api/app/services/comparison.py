from app.providers.base import ProviderCallError, ProviderConfigError
from app.providers.registry import UnsupportedProviderError
from app.schemas.run import (
    RunCompareItem,
    RunCompareRequest,
    RunCompareResponse,
    RunExecuteRequest,
    RunResponse,
)
from app.services.execution import execute_run


def compare_runs(payload: RunCompareRequest) -> RunCompareResponse:
    results: list[RunCompareItem] = []

    for target in payload.targets:
        try:
            run = execute_run(
                RunExecuteRequest(
                    prompt=payload.prompt,
                    provider=target.provider,
                    model=target.model,
                )
            )
        except (UnsupportedProviderError, ProviderConfigError, ProviderCallError) as exc:
            results.append(
                RunCompareItem(
                    provider=target.provider,
                    model=target.model,
                    status="error",
                    error_message=str(exc),
                )
            )
            continue

        results.append(
            RunCompareItem(
                provider=target.provider,
                model=run.model_name,
                status="success",
                run=RunResponse.model_validate(run),
            )
        )

    return RunCompareResponse(results=results)
