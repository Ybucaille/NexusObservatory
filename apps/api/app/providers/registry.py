from app.providers.base import Provider
from app.providers.mock import MockProvider

_PROVIDERS: dict[str, Provider] = {
    "mock": MockProvider(),
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
