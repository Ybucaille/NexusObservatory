import json
from datetime import UTC, datetime

from app.database import database_connection
from app.models.trace_event import TraceEvent
from app.schemas.trace_event import TraceEventCreate


def create_trace_event(payload: TraceEventCreate) -> TraceEvent:
    now = datetime.now(UTC)

    with database_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO trace_events (
                run_id,
                created_at,
                type,
                title,
                message,
                duration_ms,
                metadata
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.run_id,
                now.isoformat(),
                payload.type,
                payload.title,
                payload.message,
                payload.duration_ms,
                json.dumps(payload.metadata),
            ),
        )
        connection.commit()
        trace_event_id = cursor.lastrowid

    if trace_event_id is None:
        raise RuntimeError("SQLite did not return a trace event id after insert.")

    with database_connection() as connection:
        row = connection.execute(
            """
            SELECT *
            FROM trace_events
            WHERE id = ?
            """,
            (trace_event_id,),
        ).fetchone()

    if row is None:
        raise RuntimeError(
            f"Trace event {trace_event_id} was inserted but could not be read."
        )

    return TraceEvent.from_row(row)


def create_trace_events(payloads: list[TraceEventCreate]) -> list[TraceEvent]:
    return [create_trace_event(payload) for payload in payloads]


def list_trace_events(run_id: int) -> list[TraceEvent]:
    with database_connection() as connection:
        rows = connection.execute(
            """
            SELECT *
            FROM trace_events
            WHERE run_id = ?
            ORDER BY created_at ASC, id ASC
            """,
            (run_id,),
        ).fetchall()

    return [TraceEvent.from_row(row) for row in rows]
