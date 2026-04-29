import tempfile
import unittest
from pathlib import Path

from app import database
from app.database import init_database
from app.schemas.run import RunCreate
from app.services.runs import create_run, get_run, list_runs


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


if __name__ == "__main__":
    unittest.main()
