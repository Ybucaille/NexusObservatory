"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { fetchRun, fetchRunTrace, type Run, type TraceEvent } from "@/lib/api";
import {
  formatCompactDateTime,
  formatDateTime,
  formatLatency,
  formatTokens,
} from "./run-format";
import { StatusBadge } from "./status-badge";
import { TraceTimeline } from "./trace-timeline";

type LoadState =
  | { status: "loading"; run: null; error: null }
  | { status: "ready"; run: Run; error: null }
  | { status: "error"; run: null; error: string };

type TraceLoadState =
  | { status: "loading"; events: TraceEvent[]; error: null }
  | { status: "ready"; events: TraceEvent[]; error: null }
  | { status: "error"; events: TraceEvent[]; error: string };

type CopyTarget = "metadata" | "prompt" | "response";

export function RunDetailContent() {
  const params = useParams<{ id: string }>();
  const runId = useMemo(() => Number(params.id), [params.id]);
  const [state, setState] = useState<LoadState>({
    status: "loading",
    run: null,
    error: null,
  });
  const [traceState, setTraceState] = useState<TraceLoadState>({
    status: "loading",
    events: [],
    error: null,
  });
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | null>(null);

  useEffect(() => {
    if (!Number.isInteger(runId) || runId <= 0) {
      setState({
        status: "error",
        run: null,
        error: "Run id must be a positive integer.",
      });
      setTraceState({
        status: "error",
        events: [],
        error: "Trace cannot be loaded without a valid run id.",
      });
      return;
    }

    const controller = new AbortController();

    async function loadRun() {
      setState({ status: "loading", run: null, error: null });
      setTraceState({ status: "loading", events: [], error: null });

      try {
        const run = await fetchRun(runId, controller.signal);
        setState({ status: "ready", run, error: null });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          run: null,
          error:
            error instanceof Error
              ? error.message
            : "Unable to load this run from the API.",
        });
        setTraceState({
          status: "error",
          events: [],
          error: "Trace cannot be loaded because the run failed to load.",
        });
        return;
      }

      try {
        const events = await fetchRunTrace(runId, controller.signal);
        setTraceState({ status: "ready", events, error: null });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setTraceState({
          status: "error",
          events: [],
          error:
            error instanceof Error
              ? error.message
              : "Unable to load trace events from the API.",
        });
      }
    }

    void loadRun();

    return () => controller.abort();
  }, [runId]);

  if (state.status === "loading") {
    return <RunDetailLoadingState />;
  }

  if (state.status === "error") {
    return <RunDetailErrorState message={state.error} />;
  }

  const run = state.run;
  const metadataJson = JSON.stringify(run.metadata, null, 2);

  async function handleCopy(target: CopyTarget, value: string) {
    await copyText(value);
    setCopiedTarget(target);
    window.setTimeout(() => {
      setCopiedTarget((currentTarget) =>
        currentTarget === target ? null : currentTarget,
      );
    }, 1800);
  }

  function handleExportJson() {
    const exportData =
      traceState.status === "ready"
        ? { ...run, trace_events: traceState.events }
        : run;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nexus-run-${run.id}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-observatory-line bg-observatory-panel/80 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Link
              className="font-mono text-xs uppercase tracking-[0.22em] text-observatory-cyan transition hover:text-white"
              href="/runs"
            >
              Back to runs
            </Link>
            <h3 className="mt-4 truncate text-3xl font-semibold tracking-tight">
              Run #{run.id}
            </h3>
            <p className="mt-3 max-w-3xl truncate text-sm text-observatory-muted">
              {run.prompt}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <StatusBadge status={run.status} />
            <button
              className="rounded-2xl border border-observatory-cyan/35 bg-observatory-cyan/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-observatory-cyan transition hover:bg-observatory-cyan/15 hover:text-white"
              onClick={handleExportJson}
              type="button"
            >
              Export JSON
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailMetric label="Model" title={run.model_name} value={run.model_name} />
        <DetailMetric label="Provider" value={run.provider} />
        <DetailMetric label="Latency" value={formatLatency(run.latency_ms)} />
        <DetailMetric label="Total tokens" value={formatTokens(run.total_tokens)} />
        <DetailMetric
          label="Input tokens"
          value={formatTokens(run.input_tokens)}
        />
        <DetailMetric
          label="Output tokens"
          value={formatTokens(run.output_tokens)}
        />
        <TimestampMetric label="Created" value={run.created_at} />
        <TimestampMetric label="Updated" value={run.updated_at} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <TextBlock
          action={
            <CopyButton
              copied={copiedTarget === "prompt"}
              label="Copy prompt"
              onClick={() => handleCopy("prompt", run.prompt)}
            />
          }
          label="Prompt"
          value={run.prompt}
        />
        <TextBlock
          action={
            run.response?.trim() ? (
              <CopyButton
                copied={copiedTarget === "response"}
                label="Copy response"
                onClick={() => handleCopy("response", run.response ?? "")}
              />
            ) : null
          }
          label="Response"
          mutedValue="No response was recorded for this run."
          value={run.response}
        />
      </section>

      {run.error_message ? (
        <TextBlock label="Error" tone="error" value={run.error_message} />
      ) : null}

      <TraceTimeline
        error={traceState.error ?? undefined}
        events={traceState.events}
        status={traceState.status}
      />

      <section className="rounded-3xl border border-observatory-line bg-observatory-panel/80 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-observatory-muted">
            Metadata
          </p>
          <CopyButton
            copied={copiedTarget === "metadata"}
            label="Copy metadata"
            onClick={() => handleCopy("metadata", metadataJson)}
          />
        </div>
        <pre className="mt-4 max-h-96 overflow-auto rounded-2xl border border-observatory-line bg-observatory-ink/80 p-4 text-sm leading-7 text-observatory-muted">
          {metadataJson}
        </pre>
      </section>
    </div>
  );
}

function DetailMetric({
  label,
  title,
  value,
}: {
  label: string;
  title?: string;
  value: string;
}) {
  return (
    <article className="rounded-3xl border border-observatory-line bg-observatory-panel/80 p-5">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-observatory-muted">
        {label}
      </p>
      <p className="mt-4 truncate text-lg font-semibold" title={title ?? value}>
        {value}
      </p>
    </article>
  );
}

function TimestampMetric({ label, value }: { label: string; value: string }) {
  const timestamp = formatCompactDateTime(value);

  return (
    <article className="rounded-3xl border border-observatory-line bg-observatory-panel/80 p-5">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-observatory-muted">
        {label}
      </p>
      <p className="mt-4 text-lg font-semibold" title={formatDateTime(value)}>
        {timestamp.date}
      </p>
      <p className="mt-1 font-mono text-xs uppercase tracking-[0.16em] text-observatory-muted">
        {timestamp.time}
      </p>
    </article>
  );
}

function TextBlock({
  action,
  label,
  mutedValue,
  tone = "default",
  value,
}: {
  action?: ReactNode;
  label: string;
  mutedValue?: string;
  tone?: "default" | "error";
  value: string | null;
}) {
  const displayValue = value?.trim() ? value : (mutedValue ?? "--");

  return (
    <section
      className={[
        "rounded-3xl border p-6",
        tone === "error"
          ? "border-red-400/30 bg-red-950/20"
          : "border-observatory-line bg-observatory-panel/80",
      ].join(" ")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          className={[
            "font-mono text-xs uppercase tracking-[0.25em]",
            tone === "error" ? "text-red-200" : "text-observatory-muted",
          ].join(" ")}
        >
          {label}
        </p>
        {action}
      </div>
      <pre className="mt-4 whitespace-pre-wrap break-words rounded-2xl border border-observatory-line bg-observatory-ink/80 p-4 text-sm leading-7 text-observatory-text">
        {displayValue}
      </pre>
    </section>
  );
}

function CopyButton({
  copied,
  label,
  onClick,
}: {
  copied: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="rounded-2xl border border-observatory-line bg-observatory-panelSoft px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-observatory-muted transition hover:border-observatory-cyan/50 hover:text-white"
      onClick={onClick}
      type="button"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function RunDetailLoadingState() {
  return (
    <div className="space-y-6">
      <div className="h-36 animate-pulse rounded-3xl border border-observatory-line bg-observatory-panel/70" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            className="h-32 animate-pulse rounded-3xl border border-observatory-line bg-observatory-panel/70"
            key={index}
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-3xl border border-observatory-line bg-observatory-panel/70" />
    </div>
  );
}

function RunDetailErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-3xl border border-red-400/30 bg-red-950/20 p-6">
      <Link
        className="font-mono text-xs uppercase tracking-[0.22em] text-red-100 transition hover:text-white"
        href="/runs"
      >
        Back to runs
      </Link>
      <h3 className="mt-4 text-2xl font-semibold tracking-tight">
        Run could not be loaded.
      </h3>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-red-100/80">
        {message}
      </p>
    </section>
  );
}
