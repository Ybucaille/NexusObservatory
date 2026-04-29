"use client";

import { useEffect, useState } from "react";

import { fetchRuns, type Run } from "@/lib/api";
import { RunsTable } from "./runs-table";

type LoadState =
  | { status: "loading"; runs: Run[]; error: null }
  | { status: "ready"; runs: Run[]; error: null }
  | { status: "error"; runs: Run[]; error: string };

export function RunsPageContent() {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    runs: [],
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadRuns() {
      try {
        const runs = await fetchRuns(controller.signal);
        setState({ status: "ready", runs, error: null });
      } catch (error) {
        if (controller.signal.aborted) {
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

    void loadRuns();

    return () => controller.abort();
  }, []);

  if (state.status === "loading") {
    return <RunsLoadingState />;
  }

  if (state.status === "error") {
    return <RunsErrorState message={state.error} />;
  }

  return (
    <section className="rounded-3xl border border-observatory-line bg-observatory-panel/80">
      <div className="flex flex-col gap-3 border-b border-observatory-line px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-observatory-cyan">
            Runs
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight">
            All recorded executions
          </h3>
        </div>
        <p className="text-sm text-observatory-muted">
          {state.runs.length.toLocaleString()} total
        </p>
      </div>

      {state.runs.length === 0 ? (
        <RunsEmptyState />
      ) : (
        <RunsTable runs={state.runs} />
      )}
    </section>
  );
}

function RunsLoadingState() {
  return (
    <div className="h-[32rem] animate-pulse rounded-3xl border border-observatory-line bg-observatory-panel/70" />
  );
}

function RunsEmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-observatory-amber">
        No runs yet
      </p>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight">
        The API has not recorded any runs.
      </h3>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-observatory-muted">
        Create a run with `POST /runs`, then return here to inspect it.
      </p>
    </div>
  );
}

function RunsErrorState({ message }: { message: string }) {
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
