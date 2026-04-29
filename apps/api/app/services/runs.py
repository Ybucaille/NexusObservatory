import json
from datetime import UTC, datetime

from app.database import database_connection
from app.models.run import Run
from app.schemas.run import RunCreate


def create_run(payload: RunCreate) -> Run:
    now = datetime.now(UTC)
    metadata_json = json.dumps(payload.metadata)

    with database_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO runs (
                created_at,
                updated_at,
                prompt,
                response,
                model_name,
                provider,
                status,
                latency_ms,
                input_tokens,
                output_tokens,
                total_tokens,
                estimated_cost,
                error_message,
                metadata
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                now.isoformat(),
                now.isoformat(),
                payload.prompt,
                payload.response,
                payload.model_name,
                payload.provider,
                payload.status.value,
                payload.latency_ms,
                payload.input_tokens,
                payload.output_tokens,
                payload.total_tokens,
                payload.estimated_cost,
                payload.error_message,
                metadata_json,
            ),
        )
        connection.commit()
        run_id = cursor.lastrowid

    if run_id is None:
        raise RuntimeError("SQLite did not return a run id after insert.")

    run = get_run(run_id)
    if run is None:
        raise RuntimeError(f"Run {run_id} was inserted but could not be read.")

    return run


def list_runs() -> list[Run]:
    with database_connection() as connection:
        rows = connection.execute(
            """
            SELECT *
            FROM runs
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()

    return [Run.from_row(row) for row in rows]


def get_run(run_id: int) -> Run | None:
    with database_connection() as connection:
        row = connection.execute(
            """
            SELECT *
            FROM runs
            WHERE id = ?
            """,
            (run_id,),
        ).fetchone()

    if row is None:
        return None

    return Run.from_row(row)
