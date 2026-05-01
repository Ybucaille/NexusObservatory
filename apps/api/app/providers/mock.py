from app.providers.base import ProviderResult


class MockProvider:
    name = "mock"

    def generate(
        self,
        prompt: str,
        model: str,
        endpoint_id: str | None = None,
    ) -> ProviderResult:
        selected_model = model.strip() or "mock-model"
        normalized_prompt = " ".join(prompt.split())
        response = (
            f"Mock response from {selected_model}: I received your prompt and would "
            f"analyze it as an AI run. Prompt summary: {normalized_prompt[:160]}"
        )
        input_tokens = _estimate_tokens(prompt)
        output_tokens = _estimate_tokens(response)

        return ProviderResult(
            response=response,
            model_name=selected_model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            metadata={
                "mock": True,
                "provider": self.name,
                "model": selected_model,
            },
        )


def _estimate_tokens(value: str) -> int:
    return max(1, len(value.split()))
