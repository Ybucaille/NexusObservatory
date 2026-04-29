import json
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.providers.base import ProviderCallError, ProviderConfigError, ProviderResult


class CustomEndpointProvider:
    name = "custom_endpoint"

    def generate(self, prompt: str, model: str) -> ProviderResult:
        base_url = _require_config(
            _get_config("CUSTOM_ENDPOINT_BASE_URL", "OPENAI_COMPATIBLE_BASE_URL"),
            "CUSTOM_ENDPOINT_BASE_URL",
        )
        api_key = _require_config(
            _get_config("CUSTOM_ENDPOINT_API_KEY", "OPENAI_COMPATIBLE_API_KEY"),
            "CUSTOM_ENDPOINT_API_KEY",
        )
        selected_model = (
            model.strip()
            or _get_config(
                "CUSTOM_ENDPOINT_DEFAULT_MODEL",
                "OPENAI_COMPATIBLE_DEFAULT_MODEL",
                "gpt-4o-mini",
            ).strip()
        )
        endpoint = f"{base_url.rstrip('/')}/chat/completions"
        payload = {
            "model": selected_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
        }
        request = Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=60) as response:
                body = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            detail = _read_error_body(exc)
            raise ProviderCallError(
                f"Custom endpoint provider returned {exc.code}: {detail}"
            ) from exc
        except URLError as exc:
            raise ProviderCallError(
                f"Custom endpoint provider request failed: {exc.reason}"
            ) from exc
        except TimeoutError as exc:
            raise ProviderCallError(
                "Custom endpoint provider request timed out."
            ) from exc
        except json.JSONDecodeError as exc:
            raise ProviderCallError(
                "Custom endpoint provider returned invalid JSON."
            ) from exc

        response_text = _extract_response_text(body)
        usage = body.get("usage") if isinstance(body.get("usage"), dict) else {}

        return ProviderResult(
            response=response_text,
            model_name=_string_or_none(body.get("model")) or selected_model,
            input_tokens=_int_or_none(usage.get("prompt_tokens")),
            output_tokens=_int_or_none(usage.get("completion_tokens")),
            total_tokens=_int_or_none(usage.get("total_tokens")),
            metadata={
                "provider": self.name,
                "response_id": _string_or_none(body.get("id")),
                "object": _string_or_none(body.get("object")),
                "created": body.get("created"),
                "system_fingerprint": _string_or_none(
                    body.get("system_fingerprint")
                ),
                "usage": usage,
            },
        )


def _get_config(
    name: str,
    fallback_name: str,
    default: str | None = None,
) -> str | None:
    value = os.getenv(name)
    if value is not None and value.strip():
        return value

    fallback_value = os.getenv(fallback_name)
    if fallback_value is not None and fallback_value.strip():
        return fallback_value

    return default


def _require_config(value: str | None, name: str) -> str:
    if value is None or not value.strip():
        raise ProviderConfigError(
            f"{name} is required for provider 'custom_endpoint'."
        )

    return value.strip()


def _extract_response_text(body: dict[str, Any]) -> str:
    choices = body.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ProviderCallError(
            "Custom endpoint provider response did not include choices."
        )

    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        raise ProviderCallError(
            "Custom endpoint provider returned an invalid choice object."
        )

    message = first_choice.get("message")
    if isinstance(message, dict) and isinstance(message.get("content"), str):
        return message["content"]

    text = first_choice.get("text")
    if isinstance(text, str):
        return text

    raise ProviderCallError(
        "Custom endpoint provider response did not include message content."
    )


def _read_error_body(error: HTTPError) -> str:
    try:
        body = error.read().decode("utf-8")
    except Exception:
        return error.reason

    if not body:
        return error.reason

    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        return body[:500]

    detail = parsed.get("error") if isinstance(parsed, dict) else None
    if isinstance(detail, dict) and isinstance(detail.get("message"), str):
        return detail["message"]
    if isinstance(detail, str):
        return detail

    return body[:500]


def _int_or_none(value: object) -> int | None:
    return value if isinstance(value, int) else None


def _string_or_none(value: object) -> str | None:
    return value if isinstance(value, str) else None
