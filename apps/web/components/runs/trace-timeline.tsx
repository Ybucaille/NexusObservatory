import type { TraceEvent } from "@/lib/api";
import { formatDateTime } from "./run-format";

type TraceTimelineProps = {
  error?: string | null;
  events: TraceEvent[];
  status: "loading" | "ready" | "error";
};

export function TraceTimeline(props: TraceTimelineProps) {
  return (
    <section className="rounded-3xl border border-observatory-line bg-observatory-panel/80 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-observatory-cyan">
            Trace Timeline
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight">
            Execution flow
          </h3>
        </div>
        {props.status === "ready" ? (
          <p className="text-sm text-observatory-muted">
            {props.events.length} events
          </p>
        ) : null}
      </div>

      {props.status === "loading" ? <TraceLoadingState /> : null}
      {props.status === "error" ? (
        <TraceErrorState message={props.error ?? "Trace events could not be loaded."} />
      ) : null}
      {props.status === "ready" && props.events.length === 0 ? (
        <TraceEmptyState />
      ) : null}
      {props.status === "ready" && props.events.length > 0 ? (
        <ol className="mt-6 space-y-4">
          {props.events.map((event) => (
            <li className="relative pl-8" key={event.id}>
              <div className="absolute left-0 top-1.5 h-3 w-3 rounded-full border border-observatory-cyan bg-observatory-panel shadow-[0_0_18px_rgba(96,230,255,0.35)]" />
              <div className="rounded-2xl border border-observatory-line bg-observatory-ink/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-base font-semibold tracking-tight">
                      {event.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-observatory-muted">
                      {event.message}
                    </p>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-observatory-cyan">
                      {event.type}
                    </p>
                    <p className="mt-1 whitespace-nowrap text-xs text-observatory-muted">
                      {formatDateTime(event.created_at)}
                    </p>
                  </div>
                </div>

                {event.duration_ms !== null ? (
                  <p className="mt-3 inline-flex rounded-full border border-observatory-line bg-observatory-panelSoft px-3 py-1 font-mono text-xs text-observatory-muted">
                    {event.duration_ms} ms
                  </p>
                ) : null}

                {Object.keys(event.metadata).length > 0 ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.18em] text-observatory-muted transition hover:text-observatory-text">
                      Metadata
                    </summary>
                    <pre className="mt-3 max-h-72 overflow-auto rounded-2xl border border-observatory-line bg-observatory-panel/70 p-3 text-xs leading-6 text-observatory-muted">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function TraceLoadingState() {
  return (
    <div className="mt-6 space-y-3">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          className="h-24 animate-pulse rounded-2xl border border-observatory-line bg-observatory-ink/70"
          key={index}
        />
      ))}
    </div>
  );
}

function TraceEmptyState() {
  return (
    <div className="mt-6 rounded-2xl border border-observatory-line bg-observatory-ink/70 p-5 text-sm text-observatory-muted">
      No trace events were recorded for this run.
    </div>
  );
}

function TraceErrorState({ message }: { message: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-950/20 p-5 text-sm text-red-100/85">
      {message}
    </div>
  );
}
