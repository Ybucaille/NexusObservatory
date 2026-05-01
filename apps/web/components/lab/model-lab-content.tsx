"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import {
  compareRuns,
  fetchProviderStatus,
  type CompareResult,
  type CompareTarget,
  type CustomEndpointProfileStatus,
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
];

export function ModelLabContent() {
  const [prompt, setPrompt] = useState("");
  const [targets, setTargets] = useState<TargetDraft[]>(defaultTargets);
  const [endpointProfiles, setEndpointProfiles] = useState<
    CustomEndpointProfileStatus[]
  >([]);
  const [providerStatusError, setProviderStatusError] = useState<string | null>(
    null,
  );
  const [hasInitializedTargets, setHasInitializedTargets] = useState(false);
  const [state, setState] = useState<SubmitState>({
    status: "idle",
    error: null,
    results: [],
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadProviderStatus() {
      try {
        const status = await fetchProviderStatus(controller.signal);
        const customEndpointStatus = status.providers.find(
          (providerStatus) => providerStatus.name === "custom_endpoint",
        );
        const profiles = customEndpointStatus?.endpoint_profiles ?? [];
        const configuredProfile = profiles.find((profile) => profile.configured);
        setEndpointProfiles(profiles);
        setProviderStatusError(null);

        if (!hasInitializedTargets) {
          setTargets(
            configuredProfile
              ? [
                  defaultTargets[0],
                  {
                    id: `custom-endpoint-${configuredProfile.id}`,
                    provider: "custom_endpoint",
                    model: getDefaultModel("custom_endpoint", configuredProfile),
                    endpoint_id: configuredProfile.id,
                  },
                ]
              : defaultTargets,
          );
          setHasInitializedTargets(true);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setProviderStatusError(
          error instanceof Error
            ? error.message
            : "Provider status could not be loaded.",
        );
        setHasInitializedTargets(true);
      }
    }

    void loadProviderStatus();

    return () => controller.abort();
  }, [hasInitializedTargets]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedPrompt = prompt.trim();
    const normalizedTargets = targets
      .map((target) => ({
        provider: target.provider,
        model:
          target.model.trim() ||
          getDefaultModel(
            target.provider,
            getEndpointProfile(endpointProfiles, target.endpoint_id),
          ),
        endpoint_id:
          target.provider === "custom_endpoint" ? target.endpoint_id : null,
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
          model:
            target.model.trim() ||
            getDefaultModel(
              target.provider,
              getEndpointProfile(endpointProfiles, target.endpoint_id),
            ),
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
                    ? "Custom endpoint targets use backend endpoint profiles from an OpenAI-compatible chat completions API. API keys stay server-side."
                    : "Mock targets run locally and do not require backend provider configuration."}
                </p>
                {providerStatusError ? (
                  <p className="mt-1 text-xs leading-5 text-observatory-amber">
                    Endpoint profiles could not be loaded: {providerStatusError}
                  </p>
                ) : null}
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
                  className="rounded-2xl border border-observatory-line bg-observatory-ink/45 p-4"
                  key={target.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-observatory-cyan">
                        Target {index + 1}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-observatory-muted">
                        Choose provider, endpoint profile and model separately.
                      </p>
                    </div>
                    <button
                      className="rounded-2xl border border-red-400/25 bg-red-400/5 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.16em] text-red-100/80 transition hover:bg-red-400/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
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

                  <div className="mt-4 grid gap-4 lg:grid-cols-3">
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

                    {target.provider === "custom_endpoint" ? (
                      <label className="block min-w-0">
                        <span className="font-mono text-xs uppercase tracking-[0.18em] text-observatory-muted">
                          Endpoint profile
                        </span>
                        <select
                          className="mt-2 w-full rounded-2xl border border-observatory-line bg-observatory-ink/80 px-4 py-3 text-sm text-observatory-text outline-none transition focus:border-observatory-cyan/60"
                          disabled={isLoading || endpointProfiles.length === 0}
                          onChange={(event) =>
                            updateTargetEndpoint(target.id, event.target.value)
                          }
                          value={target.endpoint_id ?? ""}
                        >
                          {endpointProfiles.length === 0 ? (
                            <option value="">Default endpoint</option>
                          ) : (
                            endpointProfiles.map((endpointProfile) => (
                              <option
                                key={endpointProfile.id}
                                value={endpointProfile.id}
                              >
                                {endpointProfile.label}
                              </option>
                            ))
                          )}
                        </select>
                        <p
                          className="mt-2 truncate text-xs text-observatory-muted"
                          title={target.endpoint_id ?? "default endpoint"}
                        >
                          {target.endpoint_id
                            ? `Profile ID: ${target.endpoint_id}`
                            : "Uses the backend default endpoint profile."}
                        </p>
                      </label>
                    ) : null}

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
                        placeholder={getDefaultModel(
                          target.provider,
                          getEndpointProfile(
                            endpointProfiles,
                            target.endpoint_id,
                          ),
                        )}
                        title={target.model}
                        value={target.model}
                      />
                      <p className="mt-2 text-xs text-observatory-muted">
                        {target.provider === "mock"
                          ? "Local mock model; no endpoint profile required."
                          : "Editable model for the selected endpoint profile."}
                      </p>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-observatory-muted">
              {hasCustomEndpointTarget
                ? "Select a custom endpoint profile, then use any model supported by that backend. Missing config or unavailable models return as target-level errors."
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
        endpoint_id: null,
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
          ? {
              ...target,
              provider,
              endpoint_id:
                provider === "custom_endpoint"
                  ? getDefaultEndpoint(endpointProfiles)?.id ?? null
                  : null,
              model: getDefaultModel(
                provider,
                getDefaultEndpoint(endpointProfiles),
              ),
            }
          : target,
      ),
    );
  }

  function updateTargetEndpoint(targetId: string, endpointId: string) {
    const endpointProfile = getEndpointProfile(endpointProfiles, endpointId);
    setTargets((currentTargets) =>
      currentTargets.map((target) =>
        target.id === targetId
          ? {
              ...target,
              endpoint_id: endpointId || null,
              model: getDefaultModel("custom_endpoint", endpointProfile),
            }
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
  const endpointLabel =
    stringMetadata(run?.metadata, "endpoint_label") || result.endpoint_label;
  const targetTitle = endpointLabel
    ? `${providerLabel} (${endpointLabel}) / ${model}`
    : `${providerLabel} / ${model}`;

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
            title={targetTitle}
          >
            {targetTitle}
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

function getDefaultModel(
  provider: ExecuteRunPayload["provider"],
  endpointProfile?: CustomEndpointProfileStatus,
): string {
  if (provider === "mock") {
    return "mock-model";
  }

  return endpointProfile?.default_model || "gpt-4o-mini";
}

function getDefaultEndpoint(
  endpointProfiles: CustomEndpointProfileStatus[],
): CustomEndpointProfileStatus | undefined {
  return (
    endpointProfiles.find((endpointProfile) => endpointProfile.configured) ||
    endpointProfiles[0]
  );
}

function getEndpointProfile(
  endpointProfiles: CustomEndpointProfileStatus[],
  endpointId?: string | null,
): CustomEndpointProfileStatus | undefined {
  return endpointProfiles.find(
    (endpointProfile) => endpointProfile.id === endpointId,
  );
}

function stringMetadata(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
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
