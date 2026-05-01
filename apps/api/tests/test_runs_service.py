import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from app import database
from app.database import database_connection, init_database
from app.providers.base import ProviderConfigError
from app.providers.custom_endpoint import CustomEndpointProvider
from app.providers.registry import UnsupportedProviderError
from app.schemas.endpoint_profile import EndpointProfileCreate, EndpointProfileUpdate
from app.schemas.run import RunCreate
from app.schemas.run import RunCompareRequest
from app.schemas.run import RunCompareTarget
from app.schemas.run import RunExecuteRequest
from app.schemas.trace_event import TraceEventCreate
from app.routes.runs import execute_run_route
from app.services.comparison import compare_runs
from app.services.endpoint_profiles import (
    create_endpoint_profile,
    delete_endpoint_profile,
    endpoint_profile_to_response,
    get_endpoint_profile,
    get_profile_api_key,
    update_endpoint_profile,
)
from app.services.execution import execute_run
from app.services.provider_status import get_provider_status
from app.services.runs import create_run, get_run, list_runs
from app.services.secrets import SecretStoreUnavailableError
from app.services.traces import create_trace_event, list_trace_events
from app.scripts.seed_demo_data import seed_demo_data


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

    def test_compare_runs_returns_partial_error_for_missing_custom_endpoint_config(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "CUSTOM_ENDPOINTS_JSON": "",
                "CUSTOM_ENDPOINT_BASE_URL": "",
                "CUSTOM_ENDPOINT_API_KEY": "",
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
                            provider="custom_endpoint",
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
            "CUSTOM_ENDPOINT_BASE_URL is required",
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

    def test_custom_endpoint_provider_requires_configuration(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "CUSTOM_ENDPOINTS_JSON": "",
                "CUSTOM_ENDPOINT_BASE_URL": "",
                "CUSTOM_ENDPOINT_API_KEY": "",
                "OPENAI_COMPATIBLE_BASE_URL": "",
                "OPENAI_COMPATIBLE_API_KEY": "",
            },
            clear=False,
        ):
            with self.assertRaisesRegex(
                ProviderConfigError,
                "CUSTOM_ENDPOINT_BASE_URL is required",
            ):
                execute_run(
                    RunExecuteRequest(
                        prompt="Use configured provider.",
                        provider="custom_endpoint",
                        model="gpt-test",
                    )
                )

    def test_execute_run_route_returns_400_for_missing_custom_endpoint_config(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "CUSTOM_ENDPOINTS_JSON": "",
                "CUSTOM_ENDPOINT_BASE_URL": "",
                "CUSTOM_ENDPOINT_API_KEY": "",
                "OPENAI_COMPATIBLE_BASE_URL": "",
                "OPENAI_COMPATIBLE_API_KEY": "",
            },
            clear=False,
        ):
            with self.assertRaises(HTTPException) as context:
                asyncio.run(
                    execute_run_route(
                        RunExecuteRequest(
                            prompt="Use configured provider.",
                            provider="custom_endpoint",
                            model="gpt-test",
                        )
                    )
                )

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("CUSTOM_ENDPOINT_BASE_URL", str(context.exception.detail))

    def test_provider_status_reports_missing_custom_endpoint_config_without_secret(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "CUSTOM_ENDPOINTS_JSON": "",
                "CUSTOM_ENDPOINT_BASE_URL": "",
                "CUSTOM_ENDPOINT_API_KEY": "",
                "CUSTOM_ENDPOINT_DEFAULT_MODEL": "",
                "OPENAI_COMPATIBLE_BASE_URL": "",
                "OPENAI_COMPATIBLE_API_KEY": "",
                "OPENAI_COMPATIBLE_DEFAULT_MODEL": "",
            },
            clear=False,
        ):
            status = get_provider_status()

        providers = {provider.name: provider for provider in status.providers}
        self.assertTrue(providers["mock"].available)
        self.assertTrue(providers["mock"].configured)
        self.assertEqual(providers["mock"].default_model, "mock-model")
        self.assertTrue(providers["custom_endpoint"].available)
        self.assertFalse(providers["custom_endpoint"].configured)
        self.assertFalse(providers["custom_endpoint"].base_url_configured)
        self.assertFalse(providers["custom_endpoint"].api_key_configured)
        self.assertIsNone(providers["custom_endpoint"].default_model)
        self.assertEqual(len(providers["custom_endpoint"].endpoint_profiles or []), 1)
        self.assertEqual(
            (providers["custom_endpoint"].endpoint_profiles or [])[0].id,
            "default",
        )

    def test_provider_status_reports_configured_custom_endpoint_without_secret_value(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "CUSTOM_ENDPOINTS_JSON": "",
                "CUSTOM_ENDPOINT_BASE_URL": "http://provider.local/v1",
                "CUSTOM_ENDPOINT_API_KEY": "secret-test-key",
                "CUSTOM_ENDPOINT_DEFAULT_MODEL": "gpt-test",
            },
            clear=False,
        ):
            status = get_provider_status()

        custom_endpoint_status = {
            provider.name: provider for provider in status.providers
        }["custom_endpoint"]
        serialized = custom_endpoint_status.model_dump()
        self.assertTrue(custom_endpoint_status.configured)
        self.assertTrue(custom_endpoint_status.base_url_configured)
        self.assertTrue(custom_endpoint_status.api_key_configured)
        self.assertEqual(custom_endpoint_status.default_model, "gpt-test")
        self.assertEqual(
            (custom_endpoint_status.endpoint_profiles or [])[0].default_model,
            "gpt-test",
        )
        self.assertNotIn("secret-test-key", str(serialized))

    def test_provider_status_reports_multiple_custom_endpoint_profiles_without_secrets(self) -> None:
        endpoints_json = json.dumps(
            [
                {
                    "id": "openai",
                    "label": "OpenAI",
                    "base_url": "https://api.openai.com/v1",
                    "api_key": "openai-secret",
                    "default_model": "gpt-4o-mini",
                },
                {
                    "id": "vllm-local",
                    "label": "Local vLLM",
                    "base_url": "http://localhost:8001/v1",
                    "api_key": "",
                    "default_model": "llama3.1",
                },
            ]
        )

        with patch.dict(
            "os.environ",
            {"CUSTOM_ENDPOINTS_JSON": endpoints_json},
            clear=False,
        ):
            status = get_provider_status()

        custom_endpoint_status = {
            provider.name: provider for provider in status.providers
        }["custom_endpoint"]
        serialized = custom_endpoint_status.model_dump()
        profiles = custom_endpoint_status.endpoint_profiles or []

        self.assertTrue(custom_endpoint_status.configured)
        self.assertEqual(len(profiles), 2)
        self.assertEqual(profiles[0].id, "openai")
        self.assertEqual(profiles[0].label, "OpenAI")
        self.assertTrue(profiles[0].configured)
        self.assertFalse(profiles[1].configured)
        self.assertNotIn("openai-secret", str(serialized))

    def test_endpoint_profile_crud_uses_secret_reference_and_redacts_api_key(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "NEXUS_SECRET_STORE": "encrypted-local",
            },
            clear=False,
        ):
            profile = create_endpoint_profile(
                EndpointProfileCreate(
                    id="openai-db",
                    label="OpenAI DB",
                    base_url="https://api.openai.com/v1",
                    default_model="gpt-4o-mini",
                    api_key="db-secret-key",
                )
            )
            response = endpoint_profile_to_response(profile)

            with database_connection() as connection:
                row = connection.execute(
                    "SELECT secret_ref FROM endpoint_profiles WHERE id = ?",
                    ("openai-db",),
                ).fetchone()

            self.assertIsNotNone(row)
            self.assertIn("openai-db", row["secret_ref"])
            self.assertNotEqual(row["secret_ref"], "db-secret-key")
            secret_path = Path(self.temp_dir.name) / ".nexus_secrets.encrypted.json"
            key_path = Path(self.temp_dir.name) / ".nexus_secret.key"
            self.assertTrue(secret_path.exists())
            self.assertTrue(key_path.exists())
            self.assertNotIn(
                "db-secret-key",
                secret_path.read_text(encoding="utf-8"),
            )
            self.assertTrue(response.api_key_configured)
            self.assertNotIn("db-secret-key", str(response.model_dump()))

            updated = update_endpoint_profile(
                "openai-db",
                EndpointProfileUpdate(label="OpenAI Updated"),
            )
            self.assertEqual(updated.label, "OpenAI Updated")
            self.assertEqual(get_profile_api_key(updated), "db-secret-key")

            replaced = update_endpoint_profile(
                "openai-db",
                EndpointProfileUpdate(api_key="replacement-secret"),
            )
            self.assertEqual(get_profile_api_key(replaced), "replacement-secret")

            cleared = update_endpoint_profile(
                "openai-db",
                EndpointProfileUpdate(clear_api_key=True),
            )
            self.assertIsNone(cleared.secret_ref)
            self.assertFalse(endpoint_profile_to_response(cleared).api_key_configured)

            delete_endpoint_profile("openai-db")
            self.assertIsNone(get_endpoint_profile("openai-db"))

    def test_provider_status_includes_db_profiles_without_raw_secret(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "CUSTOM_ENDPOINTS_JSON": "",
                "CUSTOM_ENDPOINT_BASE_URL": "",
                "CUSTOM_ENDPOINT_API_KEY": "",
                "NEXUS_SECRET_STORE": "encrypted-local",
            },
            clear=False,
        ):
            create_endpoint_profile(
                EndpointProfileCreate(
                    id="db-local",
                    label="DB Local",
                    base_url="http://localhost:8001/v1",
                    default_model="llama3.1",
                    api_key="local-secret",
                )
            )
            status = get_provider_status()

        custom_endpoint_status = {
            provider.name: provider for provider in status.providers
        }["custom_endpoint"]
        serialized = custom_endpoint_status.model_dump()
        profile_statuses = custom_endpoint_status.endpoint_profiles or []
        db_profile_status = {
            profile.id: profile for profile in profile_statuses
        }["db-local"]

        self.assertTrue(db_profile_status.api_key_configured)
        self.assertTrue(db_profile_status.configured)
        self.assertNotIn("local-secret", str(serialized))

    def test_custom_endpoint_provider_selects_database_endpoint_profile(self) -> None:
        provider = CustomEndpointProvider()
        response_body = {
            "model": "db-model",
            "choices": [{"message": {"content": "DB profile response."}}],
            "usage": {},
        }

        with patch.dict(
            "os.environ",
            {
                "CUSTOM_ENDPOINTS_JSON": "",
                "CUSTOM_ENDPOINT_BASE_URL": "",
                "CUSTOM_ENDPOINT_API_KEY": "",
                "NEXUS_SECRET_STORE": "encrypted-local",
            },
            clear=False,
        ):
            create_endpoint_profile(
                EndpointProfileCreate(
                    id="db-vllm",
                    label="DB vLLM",
                    base_url="http://db-vllm.local/v1",
                    default_model="llama3.1",
                    api_key="db-vllm-secret",
                )
            )
            with patch(
                "app.providers.custom_endpoint.urlopen",
                return_value=_FakeResponse(response_body),
            ) as urlopen_mock:
                result = provider.generate(
                    prompt="Use DB profile.",
                    model="",
                    endpoint_id="db-vllm",
                )

        request = urlopen_mock.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(request.full_url, "http://db-vllm.local/v1/chat/completions")
        self.assertEqual(payload["model"], "llama3.1")
        self.assertEqual(result.response, "DB profile response.")
        self.assertEqual(result.metadata["endpoint_id"], "db-vllm")
        self.assertEqual(result.metadata["endpoint_label"], "DB vLLM")

    def test_auto_secret_store_uses_encrypted_local_without_env_flags(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "NEXUS_SECRET_STORE": "",
                "NEXUS_ALLOW_INSECURE_LOCAL_SECRETS": "",
            },
            clear=False,
        ), patch(
            "app.services.secrets.KeyringSecretStore",
            side_effect=SecretStoreUnavailableError("No keyring in test."),
        ):
            profile = create_endpoint_profile(
                EndpointProfileCreate(
                    id="auto-local",
                    label="Auto Local",
                    base_url="http://auto.local/v1",
                    default_model="auto-model",
                    api_key="auto-secret",
                )
            )

            secret_path = Path(self.temp_dir.name) / ".nexus_secrets.encrypted.json"
            self.assertTrue(secret_path.exists())
            self.assertNotIn(
                "auto-secret",
                secret_path.read_text(encoding="utf-8"),
            )
            self.assertEqual(get_profile_api_key(profile), "auto-secret")

    def test_seed_demo_data_replaces_only_demo_runs_and_creates_traces(self) -> None:
        user_run = create_run(
            RunCreate(
                prompt="Keep this user-created run.",
                response="This should not be deleted by demo seeding.",
                model_name="manual-model",
                provider="manual",
                metadata={"source": "manual"},
            )
        )

        first_deleted, first_created = seed_demo_data()
        second_deleted, second_created = seed_demo_data()

        runs = list_runs()
        demo_runs = [
            run for run in runs if run.metadata.get("source") == "demo-seed"
        ]
        preserved_user_run = get_run(user_run.id)

        self.assertEqual(first_deleted, 0)
        self.assertEqual(first_created, 7)
        self.assertEqual(second_deleted, 7)
        self.assertEqual(second_created, 7)
        self.assertEqual(len(demo_runs), 7)
        self.assertIsNotNone(preserved_user_run)
        self.assertEqual(preserved_user_run.prompt, "Keep this user-created run.")
        self.assertGreaterEqual(
            len([run for run in demo_runs if run.status == "success"]),
            6,
        )
        self.assertEqual(len([run for run in demo_runs if run.status == "error"]), 1)
        for run in demo_runs:
            self.assertGreaterEqual(len(list_trace_events(run.id)), 5)

    def test_custom_endpoint_provider_parses_chat_completion_response(self) -> None:
        provider = CustomEndpointProvider()
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
                "CUSTOM_ENDPOINTS_JSON": "",
                "CUSTOM_ENDPOINT_BASE_URL": "http://provider.local/v1",
                "CUSTOM_ENDPOINT_API_KEY": "test-key",
                "CUSTOM_ENDPOINT_DEFAULT_MODEL": "default-model",
            },
            clear=False,
        ), patch(
            "app.providers.custom_endpoint.urlopen",
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
        self.assertEqual(result.metadata["endpoint_id"], "default")
        self.assertEqual(result.metadata["endpoint_label"], "Default custom endpoint")

    def test_custom_endpoint_provider_selects_configured_endpoint_id(self) -> None:
        provider = CustomEndpointProvider()
        response_body = {
            "model": "vllm-returned-model",
            "choices": [{"message": {"content": "Endpoint selected."}}],
            "usage": {},
        }
        endpoints_json = json.dumps(
            [
                {
                    "id": "openai",
                    "label": "OpenAI",
                    "base_url": "https://api.openai.com/v1",
                    "api_key": "openai-key",
                    "default_model": "gpt-4o-mini",
                },
                {
                    "id": "vllm",
                    "label": "Local vLLM",
                    "base_url": "http://vllm.local/v1",
                    "api_key": "vllm-key",
                    "default_model": "llama3.1",
                },
            ]
        )

        with patch.dict(
            "os.environ",
            {"CUSTOM_ENDPOINTS_JSON": endpoints_json},
            clear=False,
        ), patch(
            "app.providers.custom_endpoint.urlopen",
            return_value=_FakeResponse(response_body),
        ) as urlopen_mock:
            result = provider.generate(
                prompt="Say hello.",
                model="",
                endpoint_id="vllm",
            )

        request = urlopen_mock.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(request.full_url, "http://vllm.local/v1/chat/completions")
        self.assertEqual(payload["model"], "llama3.1")
        self.assertEqual(result.response, "Endpoint selected.")
        self.assertEqual(result.metadata["endpoint_id"], "vllm")
        self.assertEqual(result.metadata["endpoint_label"], "Local vLLM")

    def test_execute_run_stores_custom_endpoint_metadata(self) -> None:
        response_body = {
            "model": "selected-model",
            "choices": [{"message": {"content": "Stored endpoint metadata."}}],
            "usage": {},
        }
        endpoints_json = json.dumps(
            [
                {
                    "id": "openai",
                    "label": "OpenAI",
                    "base_url": "https://api.openai.com/v1",
                    "api_key": "openai-key",
                    "default_model": "gpt-4o-mini",
                }
            ]
        )

        with patch.dict(
            "os.environ",
            {"CUSTOM_ENDPOINTS_JSON": endpoints_json},
            clear=False,
        ), patch(
            "app.providers.custom_endpoint.urlopen",
            return_value=_FakeResponse(response_body),
        ):
            run = execute_run(
                RunExecuteRequest(
                    prompt="Use OpenAI.",
                    provider="custom_endpoint",
                    model="",
                    endpoint_id="openai",
                )
            )

        self.assertEqual(run.metadata["endpoint_id"], "openai")
        self.assertEqual(run.metadata["endpoint_label"], "OpenAI")

    def test_custom_endpoint_provider_supports_old_env_fallback(self) -> None:
        provider = CustomEndpointProvider()
        response_body = {
            "model": "fallback-model",
            "choices": [{"message": {"content": "Fallback response."}}],
            "usage": {},
        }

        with patch.dict(
            "os.environ",
            {
                "CUSTOM_ENDPOINTS_JSON": "",
                "CUSTOM_ENDPOINT_BASE_URL": "",
                "CUSTOM_ENDPOINT_API_KEY": "",
                "CUSTOM_ENDPOINT_DEFAULT_MODEL": "",
                "OPENAI_COMPATIBLE_BASE_URL": "http://fallback.local/v1",
                "OPENAI_COMPATIBLE_API_KEY": "fallback-key",
                "OPENAI_COMPATIBLE_DEFAULT_MODEL": "fallback-default",
            },
            clear=False,
        ), patch(
            "app.providers.custom_endpoint.urlopen",
            return_value=_FakeResponse(response_body),
        ) as urlopen_mock:
            result = provider.generate(prompt="Say hello.", model="")

        request = urlopen_mock.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(request.full_url, "http://fallback.local/v1/chat/completions")
        self.assertEqual(payload["model"], "fallback-default")
        self.assertEqual(result.response, "Fallback response.")


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
