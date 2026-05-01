import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager

from app.config import DATABASE_PATH


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


@contextmanager
def database_connection() -> Iterator[sqlite3.Connection]:
    connection = get_connection()
    try:
        yield connection
    finally:
        connection.close()


def init_database() -> None:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with database_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                prompt TEXT NOT NULL,
                response TEXT,
                model_name TEXT NOT NULL,
                provider TEXT NOT NULL,
                status TEXT NOT NULL,
                latency_ms INTEGER,
                input_tokens INTEGER,
                output_tokens INTEGER,
                total_tokens INTEGER,
                estimated_cost REAL,
                error_message TEXT,
                metadata TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS trace_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                duration_ms INTEGER,
                metadata TEXT NOT NULL,
                FOREIGN KEY (run_id) REFERENCES runs(id)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS endpoint_profiles (
                id TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                base_url TEXT NOT NULL,
                default_model TEXT,
                enabled INTEGER NOT NULL,
                secret_ref TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.commit()
