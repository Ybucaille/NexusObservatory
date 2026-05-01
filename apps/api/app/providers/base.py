from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(slots=True)
class ProviderResult:
    response: str
    model_name: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class Provider(Protocol):
    name: str

    def generate(
        self,
        prompt: str,
        model: str,
        endpoint_id: str | None = None,
    ) -> ProviderResult:
        pass


class ProviderError(RuntimeError):
    pass


class ProviderConfigError(ProviderError):
    pass


class ProviderCallError(ProviderError):
    pass
