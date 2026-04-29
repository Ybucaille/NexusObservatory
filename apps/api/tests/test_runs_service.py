import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app import database
from app.database import init_database
from app.providers.base import ProviderConfigError
from app.providers.openai_compatible import OpenAICompatibleProvider
from app.providers.registry import UnsupportedProviderError
from app.schemas.run import RunCreate
from app.schemas.run import RunCompareRequest
from app.schemas.run import RunCompareTarget
from app.schemas.run import RunExecuteRequest
from app.schemas.trace_event import TraceEventCreate
from app.services.comparison import compare_runs
from app.services.execution import execute_run
from app.services.runs import create_run, get_run, list_runs
from app.services.traces import create_trace_event, list_trace_events


class RunsServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_database_path = database.DATABASE_PATH
        database.DATABASE_PATH = Path(self.temp_dir.name) / "test.db"
        init_database()

    def tearDown(self) -> None:
        database.DATABASE_PATH = self.original_database_path
        self.temp_dir.cleanup()

    def test_create_list_and_get_run(self) -> None:
        created = create_run(
            RunCreate(
                prompt="Explain SQLite simply.",
                response="SQLite is a local file-based database.",
                model_name="manual-test-model",
                provider="manual",
                latency_ms=42,
                input_tokens=10,
                output_tokens=8,
                total_tokens=18,
                estimated_cost=0.0,
                metadata={"source": "unit-test"},
            )
        )

        self.assertEqual(created.id, 1)
        self.assertEqual(created.prompt, "Explain SQLite simply.")
        self.assertEqual(created.status, "success")
        self.assertEqual(created.metadata, {"source": "unit-test"})

        runs = list_runs()
        self.assertEqual(len(runs), 1)
        self.assertEqual(runs[0].id, created.id)

        fetched = get_run(created.id)
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched, created)

    def test_get_missing_run_returns_none(self) -> None:
        self.assertIsNone(get_run(999))

    def test_create_and_list_trace_events(self) -> None:
        run = create_run(
            RunCreate(
                prompt="Trace this run.",
                response="Traced.",
                model_name="manual-test-model",
                provider="manual",
            )
        )
        trace_event = create_trace_event(
            TraceEventCreate(
                run_id=run.id,
                type="request_received",
                title="Request received",
                message="The API received a request.",
                metadata={"source": "unit-test"},
            )
        )

        trace_events = list_trace_events(run.id)
        self.assertEqual(len(trace_events), 1)
        self.assertEqual(trace_events[0], trace_event)
        self.assertEqual(trace_events[0].metadata, {"source": "unit-test"})

    def test_execute_run_with_mock_provider_stores_run(self) -> None:
        executed = execute_run(
            RunExecuteRequest(
                prompt="Summarize an AI run.",
                provider="mock",
                model="mock-model",
            )
        )

        self.assertEqual(executed.id, 1)
        self.assertEqual(executed.provider, "mock")
        self.assertEqual(executed.model_name, "mock-model")
        self.assertEqual(executed.status, "success")
        self.assertGreaterEqual(executed.latency_ms or 0, 0)
        self.assertIn("Mock response from mock-model", executed.response or "")
        self.assertEqual(executed.metadata["mock"], True)
        self.assertEqual(
            [trace_event.type for trace_event in list_trace_events(executed.id)],
            [
                "request_received",
                "provider_selected",
                "provider_call_started",
                "provider_call_finished",
                "run_stored",
            ],
        )

    def test_execute_run_with_mock_provider_uses_default_model(self) -> None:
        executed = execute_run(
            RunExecuteRequest(
                prompt="Summarize an AI run.",
                provider="mock",
            )
        )

        self.assertEqual(executed.model_name, "mock-model")

    def test_compare_runs_with_mock_targets_stores_each_success(self) -> None:
        comparison = compare_runs(
            RunCompareRequest(
                prompt="Compare this prompt.",
                targets=[
                    RunCompareTarget(provider="mock", model="mock-model"),
                    RunCompareTarget(provider="mock", model="mock-alt"),
                ],
            )
        )

        self.assertEqual(len(comparison.results), 2)
        self.assertTrue(all(result.status == "success" for result in comparison.results))
        self.assertEqual(
            sorted(run.model_name for run in list_runs()),
            ["mock-alt", "mock-model"],
        )
        for result in comparison.results:
            self.assertIsNotNone(result.run)
            self.assertGreaterEqual(len(list_trace_events(result.run.id)), 5)

    def test_compare_runs_returns_partial_error_for_missing_openai_config(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "OPENAI_COMPATIBLE_BASE_URL": "",
                "OPENAI_COMPATIBLE_API_KEY": "",
            },
            clear=False,
        ):
            comparison = compare_runs(
                RunCompareRequest(
                    prompt="Compare mock and configured providers.",
                    targets=[
                        RunCompareTarget(provider="mock", model="mock-model"),
                        RunCompareTarget(
                            provider="openai_compatible",
                            model="gpt-4o-mini",
                        ),
                    ],
                )
            )

        self.assertEqual(len(comparison.results), 2)
        self.assertEqual(comparison.results[0].status, "success")
        self.assertIsNotNone(comparison.results[0].run)
        self.assertEqual(comparison.results[1].status, "error")
        self.assertIsNone(comparison.results[1].run)
        self.assertIn(
            "OPENAI_COMPATIBLE_BASE_URL is required",
            comparison.results[1].error_message or "",
        )
        self.assertEqual(len(list_runs()), 1)

    def test_execute_run_rejects_unsupported_provider(self) -> None:
        with self.assertRaisesRegex(
            UnsupportedProviderError,
            "Unsupported provider 'openai'",
        ):
            execute_run(
                RunExecuteRequest(
                    prompt="Use a real provider.",
                    provider="openai",
                    model="gpt-test",
                )
            )

    def test_openai_compatible_provider_requires_configuration(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "OPENAI_COMPATIBLE_BASE_URL": "",
                "OPENAI_COMPATIBLE_API_KEY": "",
            },
            clear=False,
        ):
            with self.assertRaisesRegex(
                ProviderConfigError,
                "OPENAI_COMPATIBLE_BASE_URL is required",
            ):
                execute_run(
                    RunExecuteRequest(
                        prompt="Use configured provider.",
                        provider="openai_compatible",
                        model="gpt-test",
                    )
                )

    def test_openai_compatible_provider_parses_chat_completion_response(self) -> None:
        provider = OpenAICompatibleProvider()
        response_body = {
            "id": "chatcmpl-test",
            "object": "chat.completion",
            "created": 123,
            "model": "returned-model",
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "Real provider response.",
                    }
                }
            ],
            "usage": {
                "prompt_tokens": 4,
                "completion_tokens": 3,
                "total_tokens": 7,
            },
        }

        with patch.dict(
            "os.environ",
            {
                "OPENAI_COMPATIBLE_BASE_URL": "http://provider.local/v1",
                "OPENAI_COMPATIBLE_API_KEY": "test-key",
                "OPENAI_COMPATIBLE_DEFAULT_MODEL": "default-model",
            },
            clear=False,
        ), patch(
            "app.providers.openai_compatible.urlopen",
            return_value=_FakeResponse(response_body),
        ) as urlopen_mock:
            result = provider.generate(prompt="Say hello.", model="")

        request = urlopen_mock.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(request.full_url, "http://provider.local/v1/chat/completions")
        self.assertEqual(payload["model"], "default-model")
        self.assertEqual(payload["messages"][0]["content"], "Say hello.")
        self.assertEqual(result.response, "Real provider response.")
        self.assertEqual(result.model_name, "returned-model")
        self.assertEqual(result.input_tokens, 4)
        self.assertEqual(result.output_tokens, 3)
        self.assertEqual(result.total_tokens, 7)


class _FakeResponse:
    def __init__(self, body: dict[str, object]) -> None:
        self.body = body

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def read(self) -> bytes:
        return json.dumps(self.body).encode("utf-8")


if __name__ == "__main__":
    unittest.main()
