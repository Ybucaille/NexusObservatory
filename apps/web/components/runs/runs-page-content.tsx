"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { fetchRuns, type Run, type RunStatus } from "@/lib/api";
import { formatProviderLabel } from "./run-format";
import { RunsTable } from "./runs-table";

type LoadState =
  | { status: "loading"; runs: Run[]; error: null }
  | { status: "ready"; runs: Run[]; error: null }
  | { status: "error"; runs: Run[]; error: string };

type StatusFilter = "all" | RunStatus;
type SortOrder =
  | "newest"
  | "oldest"
  | "highest-latency"
  | "lowest-latency"
  | "highest-tokens"
  | "lowest-tokens";

export function RunsPageContent() {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    runs: [],
    error: null,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

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

  const providerOptions = getProviderOptions(state.runs);
  const modelOptions = getModelOptions(state.runs);
  const visibleRuns = sortRuns(
    filterRuns({
      modelFilter,
      providerFilter,
      runs: state.runs,
      searchQuery,
      statusFilter,
    }),
    sortOrder,
  );
  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    statusFilter !== "all" ||
    providerFilter !== "all" ||
    modelFilter !== "all" ||
    sortOrder !== "newest";

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
        <>
          <RunsControls
            modelFilter={modelFilter}
            modelOptions={modelOptions}
            onModelFilterChange={setModelFilter}
            onProviderFilterChange={setProviderFilter}
            onReset={() => {
              setSearchQuery("");
              setStatusFilter("all");
              setProviderFilter("all");
              setModelFilter("all");
              setSortOrder("newest");
            }}
            onSearchQueryChange={setSearchQuery}
            onSortOrderChange={setSortOrder}
            onStatusFilterChange={setStatusFilter}
            providerFilter={providerFilter}
            providerOptions={providerOptions}
            resultCount={visibleRuns.length}
            searchQuery={searchQuery}
            sortOrder={sortOrder}
            statusFilter={statusFilter}
            totalCount={state.runs.length}
          />

          {visibleRuns.length === 0 ? (
            <RunsNoResultsState hasActiveFilters={hasActiveFilters} />
          ) : (
            <RunsTable runs={visibleRuns} />
          )}
        </>
      )}
    </section>
  );
}

function RunsControls({
  modelFilter,
  modelOptions,
  onModelFilterChange,
  onProviderFilterChange,
  onReset,
  onSearchQueryChange,
  onSortOrderChange,
  onStatusFilterChange,
  providerFilter,
  providerOptions,
  resultCount,
  searchQuery,
  sortOrder,
  statusFilter,
  totalCount,
}: {
  modelFilter: string;
  modelOptions: string[];
  onModelFilterChange: (value: string) => void;
  onProviderFilterChange: (value: string) => void;
  onReset: () => void;
  onSearchQueryChange: (value: string) => void;
  onSortOrderChange: (value: SortOrder) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  providerFilter: string;
  providerOptions: string[];
  resultCount: number;
  searchQuery: string;
  sortOrder: SortOrder;
  statusFilter: StatusFilter;
  totalCount: number;
}) {
  return (
    <div className="border-b border-observatory-line bg-observatory-ink/25 px-5 py-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_repeat(4,minmax(0,11rem))_auto] lg:items-end">
        <label className="block min-w-0">
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-observatory-muted">
            Search
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-observatory-line bg-observatory-ink/80 px-4 py-3 text-sm text-observatory-text outline-none transition placeholder:text-observatory-muted/60 focus:border-observatory-cyan/60"
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Prompt, response, model or provider"
            value={searchQuery}
          />
        </label>

        <RunsSelect
          label="Status"
          onChange={(value) => onStatusFilterChange(value as StatusFilter)}
          value={statusFilter}
        >
          <option value="all">All</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="running">Running</option>
          <option value="cancelled">Cancelled</option>
        </RunsSelect>

        <RunsSelect
          label="Provider"
          onChange={onProviderFilterChange}
          value={providerFilter}
        >
          <option value="all">All</option>
          {providerOptions.map((provider) => (
            <option key={provider} value={provider}>
              {formatProviderLabel(provider)}
            </option>
          ))}
        </RunsSelect>

        <RunsSelect label="Model" onChange={onModelFilterChange} value={modelFilter}>
          <option value="all">All</option>
          {modelOptions.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </RunsSelect>

        <RunsSelect
          label="Sort"
          onChange={(value) => onSortOrderChange(value as SortOrder)}
          value={sortOrder}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="highest-latency">Highest latency</option>
          <option value="lowest-latency">Lowest latency</option>
          <option value="highest-tokens">Highest tokens</option>
          <option value="lowest-tokens">Lowest tokens</option>
        </RunsSelect>

        <button
          className="rounded-2xl border border-observatory-line bg-observatory-panelSoft px-4 py-3 font-mono text-xs uppercase tracking-[0.16em] text-observatory-muted transition hover:border-observatory-cyan/50 hover:text-white"
          onClick={onReset}
          type="button"
        >
          Reset
        </button>
      </div>

      <p className="mt-4 text-sm text-observatory-muted">
        Showing {resultCount.toLocaleString()} of {totalCount.toLocaleString()}{" "}
        runs
      </p>
    </div>
  );
}

function RunsSelect({
  children,
  label,
  onChange,
  value,
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="font-mono text-xs uppercase tracking-[0.18em] text-observatory-muted">
        {label}
      </span>
      <select
        className="mt-2 w-full rounded-2xl border border-observatory-line bg-observatory-ink/80 px-4 py-3 text-sm text-observatory-text outline-none transition focus:border-observatory-cyan/60"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
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

function RunsNoResultsState({
  hasActiveFilters,
}: {
  hasActiveFilters: boolean;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-observatory-amber">
        No matching runs
      </p>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight">
        No runs match the current view.
      </h3>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-observatory-muted">
        {hasActiveFilters
          ? "Adjust the search, filters or sorting controls to broaden the result set."
          : "The run list is available, but no visible rows were produced."}
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

function filterRuns({
  modelFilter,
  providerFilter,
  runs,
  searchQuery,
  statusFilter,
}: {
  modelFilter: string;
  providerFilter: string;
  runs: Run[];
  searchQuery: string;
  statusFilter: StatusFilter;
}): Run[] {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  return runs.filter((run) => {
    const matchesSearch =
      normalizedSearch === "" ||
      [run.prompt, run.response ?? "", run.model_name, run.provider]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    const matchesStatus =
      statusFilter === "all" || run.status === statusFilter;
    const matchesProvider =
      providerFilter === "all" || run.provider === providerFilter;
    const matchesModel =
      modelFilter === "all" || run.model_name === modelFilter;

    return matchesSearch && matchesStatus && matchesProvider && matchesModel;
  });
}

function sortRuns(runs: Run[], sortOrder: SortOrder): Run[] {
  return [...runs].sort((left, right) => {
    switch (sortOrder) {
      case "oldest":
        return getRunTime(left) - getRunTime(right);
      case "highest-latency":
        return compareNullableNumberDesc(left.latency_ms, right.latency_ms);
      case "lowest-latency":
        return compareNullableNumberAsc(left.latency_ms, right.latency_ms);
      case "highest-tokens":
        return compareNullableNumberDesc(left.total_tokens, right.total_tokens);
      case "lowest-tokens":
        return compareNullableNumberAsc(left.total_tokens, right.total_tokens);
      case "newest":
      default:
        return getRunTime(right) - getRunTime(left);
    }
  });
}

function getProviderOptions(runs: Run[]): string[] {
  return getSortedOptions([
    "mock",
    "custom_endpoint",
    ...runs.map((run) => run.provider),
  ]);
}

function getModelOptions(runs: Run[]): string[] {
  return getSortedOptions(runs.map((run) => run.model_name));
}

function getSortedOptions(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right),
  );
}

function getRunTime(run: Run): number {
  return Date.parse(run.created_at);
}

function compareNullableNumberDesc(
  left: number | null,
  right: number | null,
): number {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return right - left;
}

function compareNullableNumberAsc(
  left: number | null,
  right: number | null,
): number {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return left - right;
}
