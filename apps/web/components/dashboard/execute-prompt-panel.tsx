"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import {
  executeRun,
  fetchProviderStatus,
  type CustomEndpointProfileStatus,
  type ExecuteRunPayload,
  type Run,
} from "@/lib/api";

type ExecutePromptPanelProps = {
  onExecuted: (run: Run) => Promise<void> | void;
};

type SubmitState =
  | { status: "idle"; error: null; run: null }
  | { status: "loading"; error: null; run: null }
  | { status: "error"; error: string; run: null }
  | { status: "success"; error: null; run: Run };

export function ExecutePromptPanel({ onExecuted }: ExecutePromptPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] =
    useState<ExecuteRunPayload["provider"]>("mock");
  const [model, setModel] = useState("mock-model");
  const [endpointId, setEndpointId] = useState<string | null>(null);
  const [endpointProfiles, setEndpointProfiles] = useState<
    CustomEndpointProfileStatus[]
  >([]);
  const [providerStatusError, setProviderStatusError] = useState<string | null>(
    null,
  );
  const [state, setState] = useState<SubmitState>({
    status: "idle",
    error: null,
    run: null,
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
        const firstProfile = profiles[0];
        setEndpointProfiles(profiles);
        setEndpointId((currentEndpointId) =>
          currentEndpointId ?? firstProfile?.id ?? null,
        );
        if (provider === "custom_endpoint" && firstProfile?.default_model) {
          setModel(firstProfile.default_model);
        }
        setProviderStatusError(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setProviderStatusError(
          error instanceof Error
            ? error.message
            : "Provider status could not be loaded.",
        );
      }
    }

    void loadProviderStatus();

    return () => controller.abort();
  }, [provider]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedPrompt = prompt.trim();
    const trimmedModel = model.trim() || getDefaultModel(provider);

    if (!trimmedPrompt) {
      setState({
        status: "error",
        error: "Prompt is required before executing a run.",
        run: null,
      });
      return;
    }

    setState({ status: "loading", error: null, run: null });

    try {
      const run = await executeRun({
        prompt: trimmedPrompt,
        provider,
        model: trimmedModel,
        endpoint_id: provider === "custom_endpoint" ? endpointId : null,
      });
      setPrompt("");
      setModel(trimmedModel);
      setState({ status: "success", error: null, run });
      await onExecuted(run);
    } catch (error) {
      setState({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Run execution failed unexpectedly.",
        run: null,
      });
    }
  }

  const isLoading = state.status === "loading";
  const selectedEndpoint = endpointProfiles.find(
    (endpointProfile) => endpointProfile.id === endpointId,
  );

  return (
    <section className="rounded-3xl border border-observatory-line bg-observatory-panel/80 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-observatory-cyan">
            Execute Prompt
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight">
            Run an AI execution
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-observatory-muted">
            Send a prompt through a configured provider and store the result as
            an observable run.
          </p>
        </div>
        <div className="rounded-full border border-observatory-line bg-observatory-panelSoft px-3 py-1.5 font-mono text-xs text-observatory-muted">
          mock or custom endpoint
        </div>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-observatory-muted">
            Prompt
          </span>
          <textarea
            className="mt-2 min-h-28 w-full resize-y rounded-2xl border border-observatory-line bg-observatory-ink/80 px-4 py-3 text-sm leading-6 text-observatory-text outline-none transition placeholder:text-observatory-muted/60 focus:border-observatory-cyan/60"
            disabled={isLoading}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask the mock provider to summarize a run, classify a response, or explain a system event."
            value={prompt}
          />
        </label>

        <div className="rounded-2xl border border-observatory-line bg-observatory-ink/35 p-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="block">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-observatory-muted">
                Provider
              </span>
              <select
                className="mt-2 w-full rounded-2xl border border-observatory-line bg-observatory-ink/80 px-4 py-3 text-sm text-observatory-text outline-none transition focus:border-observatory-cyan/60"
                disabled={isLoading}
                onChange={(event) => {
                  const nextProvider = event.target
                    .value as ExecuteRunPayload["provider"];
                  setProvider(nextProvider);
                  setModel(getDefaultModel(nextProvider, selectedEndpoint));
                }}
                value={provider}
              >
                <option value="mock">mock</option>
                <option value="custom_endpoint">Custom endpoint</option>
              </select>
            </label>

            {provider === "custom_endpoint" ? (
              <label className="block min-w-0">
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-observatory-muted">
                  Endpoint profile
                </span>
                <select
                  className="mt-2 w-full rounded-2xl border border-observatory-line bg-observatory-ink/80 px-4 py-3 text-sm text-observatory-text outline-none transition focus:border-observatory-cyan/60"
                  disabled={isLoading || endpointProfiles.length === 0}
                  onChange={(event) => {
                    const nextEndpoint = endpointProfiles.find(
                      (profile) => profile.id === event.target.value,
                    );
                    setEndpointId(event.target.value);
                    setModel(
                      nextEndpoint?.default_model ||
                        getDefaultModel("custom_endpoint"),
                    );
                  }}
                  value={endpointId ?? ""}
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
                  title={selectedEndpoint?.id ?? "default endpoint"}
                >
                  {selectedEndpoint
                    ? `Profile ID: ${selectedEndpoint.id}`
                    : "Uses the backend default endpoint profile."}
                </p>
              </label>
            ) : null}

            <label className="block min-w-0">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-observatory-muted">
                Model
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-observatory-line bg-observatory-ink/80 px-4 py-3 text-sm text-observatory-text outline-none transition placeholder:text-observatory-muted/60 focus:border-observatory-cyan/60"
                disabled={isLoading}
                onChange={(event) => setModel(event.target.value)}
                placeholder={getDefaultModel(provider, selectedEndpoint)}
                title={model}
                value={model}
              />
              <p className="mt-2 text-xs text-observatory-muted">
                {provider === "mock"
                  ? "Mock runs stay local and ignore endpoint profiles."
                  : "Editable per run; defaults from the selected endpoint profile."}
              </p>
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              className="rounded-2xl border border-observatory-cyan/40 bg-observatory-cyan/10 px-5 py-3 font-mono text-xs uppercase tracking-[0.18em] text-observatory-cyan transition hover:bg-observatory-cyan/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? "Running" : "Execute"}
            </button>
          </div>
        </div>
      </form>

      <p className="mt-3 text-xs leading-5 text-observatory-muted">
        Custom endpoints are configured on the backend with
        `CUSTOM_ENDPOINTS_JSON` or the single-endpoint `CUSTOM_ENDPOINT_*`
        variables. They use an OpenAI-compatible chat completions API and can
        target OpenAI, Ollama, LM Studio, vLLM or LocalAI. API keys are never
        sent to the frontend.
      </p>

      {providerStatusError ? (
        <p className="mt-2 text-xs leading-5 text-observatory-amber">
          Endpoint profiles could not be loaded: {providerStatusError}
        </p>
      ) : null}

      {state.status === "error" ? (
        <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-950/20 px-4 py-3 text-sm text-red-100/85">
          {state.error}
        </div>
      ) : null}

      {state.status === "success" ? (
        <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100/90">
          Run #{state.run.id} stored successfully.{" "}
          <Link
            className="font-mono text-xs uppercase tracking-[0.16em] text-observatory-cyan transition hover:text-white"
            href={`/runs/${state.run.id}`}
          >
            Open detail
          </Link>
        </div>
      ) : null}
    </section>
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
