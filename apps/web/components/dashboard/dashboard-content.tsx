"use client";

import { useEffect, useState } from "react";

import { fetchRuns, type Run } from "@/lib/api";
import { ExecutePromptPanel } from "@/components/dashboard/execute-prompt-panel";
import { RunsTable } from "@/components/runs/runs-table";

type LoadState =
  | { status: "loading"; runs: Run[]; error: null }
  | { status: "ready"; runs: Run[]; error: null }
  | { status: "error"; runs: Run[]; error: string };

type MetricCard = {
  label: string;
  value: string;
  helper: string;
  title?: string;
};

export function DashboardContent() {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    runs: [],
    error: null,
  });

  async function loadRuns(signal?: AbortSignal) {
    try {
      const runs = await fetchRuns(signal);
      setState({ status: "ready", runs, error: null });
    } catch (error) {
      if (signal?.aborted) {
        return;
      }

      setState({
        status: "error",
        runs: [],
        error:
          error instanceof Error
            ? error.message
            : "Unable to load runs from the API.",
      });
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadRuns(controller.signal);

    return () => controller.abort();
  }, []);

  if (state.status === "loading") {
    return <DashboardLoadingState />;
  }

  if (state.status === "error") {
    return <DashboardErrorState message={state.error} />;
  }

  const metrics = buildMetricCards(state.runs);
  const recentRuns = state.runs.slice(0, 8);

  return (
    <div className="space-y-6">
      <ExecutePromptPanel onExecuted={() => loadRuns()} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCardView card={metric} key={metric.label} />
        ))}
      </section>

      <section className="rounded-3xl border border-observatory-line bg-observatory-panel/80">
        <div className="flex flex-col gap-3 border-b border-observatory-line px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-observatory-cyan">
              Recent Runs
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">
              Latest recorded executions
            </h3>
          </div>
          <p className="text-sm text-observatory-muted">
            Showing {recentRuns.length} of {state.runs.length}
          </p>
        </div>

        {state.runs.length === 0 ? (
          <DashboardEmptyState />
        ) : (
          <RunsTable compact runs={recentRuns} />
        )}
      </section>
    </div>
  );
}

function buildMetricCards(runs: Run[]): MetricCard[] {
  const successfulRuns = runs.filter((run) => run.status === "success").length;
  const failedRuns = runs.filter((run) => run.status === "error").length;
  const latencyValues = runs
    .map((run) => run.latency_ms)
    .filter((value): value is number => value !== null);
  const averageLatency =
    latencyValues.length > 0
      ? Math.round(
          latencyValues.reduce((total, value) => total + value, 0) /
            latencyValues.length,
        )
      : null;
  const totalTokens = runs.reduce(
    (total, run) => total + (run.total_tokens ?? 0),
    0,
  );
  const mostUsedModel = getMostUsedModel(runs);

  return [
    {
      label: "Total runs",
      value: runs.length.toLocaleString(),
      helper: "All persisted runs in the local API.",
    },
    {
      label: "Successful runs",
      value: successfulRuns.toLocaleString(),
      helper: "Runs completed with success status.",
    },
    {
      label: "Failed runs",
      value: failedRuns.toLocaleString(),
      helper: "Runs recorded with error status.",
    },
    {
      label: "Average latency",
      value: averageLatency === null ? "--" : `${averageLatency} ms`,
      helper: "Calculated from runs with latency values.",
    },
    {
      label: "Total tokens",
      value: totalTokens.toLocaleString(),
      helper: "Sum of recorded total token counts.",
    },
    {
      label: "Most used model",
      value: mostUsedModel ?? "--",
      helper: "Based on the current run history.",
      title: mostUsedModel ?? undefined,
    },
  ];
}

function getMostUsedModel(runs: Run[]): string | null {
  if (runs.length === 0) {
    return null;
  }

  const counts = new Map<string, number>();
  for (const run of runs) {
    counts.set(run.model_name, (counts.get(run.model_name) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function MetricCardView({ card }: { card: MetricCard }) {
  return (
    <article className="rounded-3xl border border-observatory-line bg-observatory-panel/80 p-5 transition hover:border-observatory-cyan/30 hover:bg-observatory-panelSoft/80">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-observatory-muted">
        {card.label}
      </p>
      <p
        className={[
          "mt-5 min-w-0 truncate font-semibold tracking-tight",
          card.label === "Most used model"
            ? "text-2xl sm:text-3xl"
            : "text-3xl sm:text-4xl",
        ].join(" ")}
        title={card.title ?? card.value}
      >
        {card.value}
      </p>
      <p className="mt-3 text-sm leading-6 text-observatory-muted">
        {card.helper}
      </p>
    </article>
  );
}

function DashboardLoadingState() {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            className="h-40 animate-pulse rounded-3xl border border-observatory-line bg-observatory-panel/70"
            key={index}
          />
        ))}
      </section>
      <div className="h-80 animate-pulse rounded-3xl border border-observatory-line bg-observatory-panel/70" />
    </div>
  );
}

function DashboardEmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-observatory-amber">
        No runs yet
      </p>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight">
        Start by creating runs through the API.
      </h3>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-observatory-muted">
        Once `POST /runs` records data, this dashboard will show live metrics
        from the backend run history.
      </p>
    </div>
  );
}

function DashboardErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-3xl border border-red-400/30 bg-red-950/20 p-6">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-red-200">
        API unavailable
      </p>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight">
        Runs could not be loaded.
      </h3>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-red-100/80">
        {message}
      </p>
      <p className="mt-4 text-sm leading-7 text-observatory-muted">
        Check that the backend is running and that
        `NEXT_PUBLIC_API_BASE_URL` points to it.
      </p>
    </section>
  );
}
