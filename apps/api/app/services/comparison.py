from app.providers.base import ProviderCallError, ProviderConfigError
from app.providers.custom_endpoint_config import get_custom_endpoint_profile
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
        endpoint_label = _get_endpoint_label(target.provider, target.endpoint_id)
        try:
            run = execute_run(
                RunExecuteRequest(
                    prompt=payload.prompt,
                    provider=target.provider,
                    model=target.model,
                    endpoint_id=target.endpoint_id,
                )
            )
        except (UnsupportedProviderError, ProviderConfigError, ProviderCallError) as exc:
            results.append(
                RunCompareItem(
                    provider=target.provider,
                    model=target.model,
                    status="error",
                    endpoint_id=target.endpoint_id,
                    endpoint_label=endpoint_label,
                    error_message=str(exc),
                )
            )
            continue

        results.append(
            RunCompareItem(
                provider=target.provider,
                model=run.model_name,
                status="success",
                endpoint_id=_string_metadata(run.metadata, "endpoint_id")
                or target.endpoint_id,
                endpoint_label=_string_metadata(run.metadata, "endpoint_label")
                or endpoint_label,
                run=RunResponse.model_validate(run),
            )
        )

    return RunCompareResponse(results=results)


def _get_endpoint_label(provider: str, endpoint_id: str | None) -> str | None:
    if provider != "custom_endpoint":
        return None

    try:
        return get_custom_endpoint_profile(endpoint_id).label
    except ProviderConfigError:
        return None


def _string_metadata(metadata: dict[str, object], key: str) -> str | None:
    value = metadata.get(key)
    return value if isinstance(value, str) else None
