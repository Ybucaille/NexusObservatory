"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import {
  compareRuns,
  type CompareResult,
  type CompareTarget,
  type ExecuteRunPayload,
} from "@/lib/api";
import { StatusBadge } from "@/components/runs/status-badge";
import {
  formatLatency,
  formatProviderLabel,
  formatTokens,
} from "@/components/runs/run-format";

type TargetDraft = CompareTarget & {
  id: string;
};

type SubmitState =
  | { status: "idle"; error: null; results: CompareResult[] }
  | { status: "loading"; error: null; results: CompareResult[] }
  | { status: "error"; error: string; results: CompareResult[] }
  | { status: "success"; error: null; results: CompareResult[] };

const defaultTargets: TargetDraft[] = [
  { id: "mock-default", provider: "mock", model: "mock-model" },
  {
    id: "custom-endpoint-default",
    provider: "custom_endpoint",
    model: "gpt-4o-mini",
  },
];

export function ModelLabContent() {
  const [prompt, setPrompt] = useState("");
  const [targets, setTargets] = useState<TargetDraft[]>(defaultTargets);
  const [state, setState] = useState<SubmitState>({
    status: "idle",
    error: null,
    results: [],
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedPrompt = prompt.trim();
    const normalizedTargets = targets
      .map((target) => ({
        provider: target.provider,
        model: target.model.trim() || getDefaultModel(target.provider),
      }))
      .filter((target) => target.provider);

    if (!trimmedPrompt) {
      setState({
        status: "error",
        error: "Prompt is required before comparing targets.",
        results: state.results,
      });
      return;
    }

    if (normalizedTargets.length === 0) {
      setState({
        status: "error",
        error: "Add at least one target before running a comparison.",
        results: state.results,
      });
      return;
    }

    setState({ status: "loading", error: null, results: state.results });

    try {
      const comparison = await compareRuns({
        prompt: trimmedPrompt,
        targets: normalizedTargets,
      });
      setTargets((currentTargets) =>
        currentTargets.map((target) => ({
          ...target,
          model: target.model.trim() || getDefaultModel(target.provider),
        })),
      );
      setState({
        status: "success",
        error: null,
        results: comparison.results,
      });
    } catch (error) {
      setState({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Comparison failed unexpectedly.",
        results: state.results,
      });
    }
  }

  const isLoading = state.status === "loading";
  const hasCustomEndpointTarget = targets.some(
    (target) => target.provider === "custom_endpoint",
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-observatory-line bg-observatory-panel/80 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-observatory-cyan">
              Model Lab
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">
              Compare one prompt across targets
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-observatory-muted">
              Run the same prompt against multiple configured execution targets.
              Each successful target is stored as a run with its own trace.
            </p>
          </div>
          <div className="rounded-full border border-observatory-line bg-observatory-panelSoft px-3 py-1.5 font-mono text-xs text-observatory-muted">
            mock + custom endpoint
          </div>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-observatory-muted">
              Prompt
            </span>
            <textarea
              className="mt-2 min-h-32 w-full resize-y rounded-2xl border border-observatory-line bg-observatory-ink/80 px-4 py-3 text-sm leading-6 text-observatory-text outline-none transition placeholder:text-observatory-muted/60 focus:border-observatory-cyan/60"
              disabled={isLoading}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ask the targets to summarize, classify, explain, or rewrite the same input."
              value={prompt}
            />
          </label>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-observatory-muted">
                  Targets
                </p>
                <p className="mt-1 text-xs leading-5 text-observatory-muted">
                  {hasCustomEndpointTarget
                    ? "Custom endpoint targets require backend environment config. They use an OpenAI-compatible chat completions API, and API keys stay server-side."
                    : "Mock targets run locally and do not require backend provider configuration."}
                </p>
              </div>
              <button
                className="rounded-2xl border border-observatory-line bg-observatory-panelSoft px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-observatory-muted transition hover:border-observatory-cyan/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading}
                onClick={addTarget}
                type="button"
              >
                Add target
              </button>
            </div>

            <div className="space-y-3">
              {targets.map((target, index) => (
                <div
                  className="grid gap-3 rounded-2xl border border-observatory-line bg-observatory-ink/45 p-4 md:grid-cols-[minmax(0,12rem)_1fr_auto] md:items-end"
                  key={target.id}
                >
                  <label className="block">
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-observatory-muted">
                      Provider
                    </span>
                    <select
                      className="mt-2 w-full rounded-2xl border border-observatory-line bg-observatory-ink/80 px-4 py-3 text-sm text-observatory-text outline-none transition focus:border-observatory-cyan/60"
                      disabled={isLoading}
                      onChange={(event) =>
                        updateTargetProvider(
                          target.id,
                          event.target.value as ExecuteRunPayload["provider"],
                        )
                      }
                      value={target.provider}
                    >
                      <option value="mock">mock</option>
                      <option value="custom_endpoint">Custom endpoint</option>
                    </select>
                  </label>

                  <label className="block min-w-0">
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-observatory-muted">
                      Model
                    </span>
                    <input
                      className="mt-2 w-full rounded-2xl border border-observatory-line bg-observatory-ink/80 px-4 py-3 text-sm text-observatory-text outline-none transition placeholder:text-observatory-muted/60 focus:border-observatory-cyan/60"
                      disabled={isLoading}
                      onChange={(event) =>
                        updateTargetModel(target.id, event.target.value)
                      }
                      placeholder={getDefaultModel(target.provider)}
                      title={target.model}
                      value={target.model}
                    />
                  </label>

                  <button
                    className="rounded-2xl border border-red-400/25 bg-red-400/5 px-4 py-3 font-mono text-xs uppercase tracking-[0.16em] text-red-100/80 transition hover:bg-red-400/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isLoading || targets.length === 1}
                    onClick={() => removeTarget(target.id)}
                    title={
                      targets.length === 1
                        ? "At least one target is required."
                        : `Remove target ${index + 1}`
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-observatory-muted">
              {hasCustomEndpointTarget
                ? "Replace `gpt-4o-mini` with any model supported by your custom endpoint, such as OpenAI, Ollama, LM Studio, vLLM or LocalAI. Missing config or unavailable models return as target-level errors."
                : "Mock comparisons are fully local and useful for testing Model Lab flow without provider credentials."}
            </p>
            <button
              className="rounded-2xl border border-observatory-cyan/40 bg-observatory-cyan/10 px-5 py-3 font-mono text-xs uppercase tracking-[0.18em] text-observatory-cyan transition hover:bg-observatory-cyan/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? "Comparing" : "Execute comparison"}
            </button>
          </div>
        </form>

        {state.status === "error" ? (
          <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-950/20 px-4 py-3 text-sm text-red-100/85">
            {state.error}
          </div>
        ) : null}
      </section>

      <ComparisonResults isLoading={isLoading} results={state.results} />
    </div>
  );

  function addTarget() {
    setTargets((currentTargets) => [
      ...currentTargets,
      {
        id: `target-${Date.now()}-${currentTargets.length}`,
        provider: "mock",
        model: "mock-model",
      },
    ]);
  }

  function removeTarget(targetId: string) {
    setTargets((currentTargets) =>
      currentTargets.filter((target) => target.id !== targetId),
    );
  }

  function updateTargetProvider(
    targetId: string,
    provider: ExecuteRunPayload["provider"],
  ) {
    setTargets((currentTargets) =>
      currentTargets.map((target) =>
        target.id === targetId
          ? { ...target, provider, model: getDefaultModel(provider) }
          : target,
      ),
    );
  }

  function updateTargetModel(targetId: string, model: string) {
    setTargets((currentTargets) =>
      currentTargets.map((target) =>
        target.id === targetId ? { ...target, model } : target,
      ),
    );
  }
}

function ComparisonResults({
  isLoading,
  results,
}: {
  isLoading: boolean;
  results: CompareResult[];
}) {
  if (isLoading) {
    return (
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-3xl border border-observatory-line bg-observatory-panel/70" />
        <div className="h-80 animate-pulse rounded-3xl border border-observatory-line bg-observatory-panel/70" />
      </section>
    );
  }

  if (results.length === 0) {
    return (
      <section className="rounded-3xl border border-observatory-line bg-observatory-panel/70 px-6 py-14 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-observatory-amber">
          No comparison yet
        </p>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight">
          Results will appear here after execution.
        </h3>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-observatory-muted">
          Start with the mock provider for a local baseline, then compare it
          with configured custom endpoints.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      {results.map((result, index) => (
        <ResultCard
          index={index}
          key={`${result.provider}-${index}`}
          result={result}
        />
      ))}
    </section>
  );
}

function ResultCard({
  index,
  result,
}: {
  index: number;
  result: CompareResult;
}) {
  const [copied, setCopied] = useState(false);
  const run = result.run;
  const response = run?.response || "No response text was returned.";
  const hasResponse = Boolean(run?.response?.trim());
  const model = run?.model_name || result.model || "default";
  const provider = run?.provider || result.provider;
  const providerLabel = formatProviderLabel(provider);

  async function handleCopyResponse() {
    if (!run?.response) {
      return;
    }

    await copyText(run.response);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <article className="min-w-0 rounded-3xl border border-observatory-line bg-observatory-panel/80 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-observatory-cyan">
            Target {index + 1}
          </p>
          <h3
            className="mt-2 truncate text-lg font-semibold tracking-tight"
            title={`${providerLabel} / ${model}`}
          >
            {providerLabel} / {model}
          </h3>
        </div>
        <StatusBadge status={result.status} />
      </div>

      {result.status === "error" ? (
        <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-950/20 p-4 text-sm leading-6 text-red-100/85">
          {result.error_message || "Target failed without a returned message."}
        </div>
      ) : null}

      {run ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="Latency" value={formatLatency(run.latency_ms)} />
            <Metric label="Tokens" value={formatTokens(run.total_tokens)} />
            <Metric label="Run" value={`#${run.id}`} />
          </div>

          <div className="mt-5 rounded-2xl border border-observatory-line bg-observatory-ink/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-observatory-muted">
                Response
              </p>
              {hasResponse ? (
                <button
                  className="rounded-2xl border border-observatory-line bg-observatory-panelSoft px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-observatory-muted transition hover:border-observatory-cyan/50 hover:text-white"
                  onClick={handleCopyResponse}
                  type="button"
                >
                  {copied ? "Copied" : "Copy response"}
                </button>
              ) : null}
            </div>
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-observatory-text">
              {response}
            </pre>
          </div>

          <div className="mt-5 flex justify-end">
            <Link
              className="rounded-2xl border border-observatory-cyan/35 bg-observatory-cyan/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-observatory-cyan transition hover:bg-observatory-cyan/15 hover:text-white"
              href={`/runs/${run.id}`}
            >
              Open run detail
            </Link>
          </div>
        </>
      ) : null}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-observatory-line bg-observatory-ink/50 p-3">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-observatory-muted">
        {label}
      </p>
      <p
        className="mt-2 truncate text-sm font-semibold text-observatory-text"
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function getDefaultModel(provider: ExecuteRunPayload["provider"]): string {
  return provider === "mock" ? "mock-model" : "gpt-4o-mini";
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
