from app.providers.base import Provider
from app.providers.mock import MockProvider
from app.providers.openai_compatible import OpenAICompatibleProvider

_PROVIDERS: dict[str, Provider] = {
    "mock": MockProvider(),
    "openai_compatible": OpenAICompatibleProvider(),
}


class UnsupportedProviderError(ValueError):
    def __init__(self, provider: str) -> None:
        supported = ", ".join(sorted(_PROVIDERS))
        super().__init__(
            f"Unsupported provider '{provider}'. Supported providers: {supported}."
        )


def get_provider(provider: str) -> Provider:
    try:
        return _PROVIDERS[provider]
    except KeyError as exc:
        raise UnsupportedProviderError(provider) from exc
