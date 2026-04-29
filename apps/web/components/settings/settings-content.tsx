"use client";

import { useEffect, useState } from "react";

import {
  fetchProviderStatus,
  type ProviderStatus,
  type ProviderStatusResponse,
} from "@/lib/api";

type LoadState =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: ProviderStatusResponse; error: null }
  | { status: "error"; data: null; error: string };

export function SettingsContent() {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    data: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadProviderStatus() {
      try {
        const data = await fetchProviderStatus(controller.signal);
        setState({ status: "ready", data, error: null });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          data: null,
          error:
            error instanceof Error
              ? error.message
              : "Unable to load provider status.",
        });
      }
    }

    void loadProviderStatus();

    return () => controller.abort();
  }, []);

  if (state.status === "loading") {
    return <SettingsLoadingState />;
  }

  if (state.status === "error") {
    return <SettingsErrorState message={state.error} />;
  }

  const providers = state.data.providers;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-observatory-line bg-observatory-panel/80 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-observatory-cyan">
              Provider Status
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">
              Backend provider readiness
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-observatory-muted">
              These settings are read from the backend environment. API keys
              stay server-side and are never sent to the frontend.
            </p>
          </div>
          <div className="rounded-full border border-observatory-line bg-observatory-panelSoft px-3 py-1.5 font-mono text-xs text-observatory-muted">
            read-only
          </div>
        </div>
      </section>

      {providers.length === 0 ? (
        <SettingsEmptyState />
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {providers.map((provider) => (
            <ProviderCard key={provider.name} provider={provider} />
          ))}
        </section>
      )}
    </div>
  );
}

function ProviderCard({ provider }: { provider: ProviderStatus }) {
  const isOpenAICompatible = provider.name === "openai_compatible";

  return (
    <article className="rounded-3xl border border-observatory-line bg-observatory-panel/80 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-observatory-cyan">
            Provider
          </p>
          <h3 className="mt-2 truncate text-xl font-semibold tracking-tight" title={provider.name}>
            {formatProviderName(provider.name)}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill
            label={provider.available ? "Available" : "Unavailable"}
            tone={provider.available ? "success" : "danger"}
          />
          <StatusPill
            label={provider.configured ? "Configured" : "Missing config"}
            tone={provider.configured ? "success" : "warning"}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <DetailTile
          label="Default model"
          value={provider.default_model || "Not configured"}
        />
        <DetailTile
          label="Configuration"
          value={provider.configured ? "Ready" : "Action needed"}
        />
      </div>

      {isOpenAICompatible ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ConfigCheck
            configured={Boolean(provider.base_url_configured)}
            label="Base URL"
          />
          <ConfigCheck
            configured={Boolean(provider.api_key_configured)}
            label="API key"
          />
        </div>
      ) : null}

      <p className="mt-5 text-sm leading-6 text-observatory-muted">
        {isOpenAICompatible
          ? "Set OpenAI-compatible environment variables on the backend. Secret values are intentionally omitted from this response."
          : "The mock provider runs locally and is always ready for demos and UI validation."}
      </p>
    </article>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-observatory-line bg-observatory-ink/50 p-4">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-observatory-muted">
        {label}
      </p>
      <p className="mt-2 truncate text-sm font-semibold text-observatory-text" title={value}>
        {value}
      </p>
    </div>
  );
}

function ConfigCheck({
  configured,
  label,
}: {
  configured: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-observatory-line bg-observatory-ink/40 px-4 py-3">
      <span className="text-sm text-observatory-muted">{label}</span>
      <StatusPill
        label={configured ? "Configured" : "Missing"}
        tone={configured ? "success" : "warning"}
      />
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "danger" | "success" | "warning";
}) {
  const styles = {
    danger: "border-red-400/30 bg-red-400/10 text-red-200",
    success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    warning: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  };

  return (
    <span
      className={[
        "rounded-full border px-3 py-1 font-mono text-xs",
        styles[tone],
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function SettingsLoadingState() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="h-72 animate-pulse rounded-3xl border border-observatory-line bg-observatory-panel/70" />
      <div className="h-72 animate-pulse rounded-3xl border border-observatory-line bg-observatory-panel/70" />
    </div>
  );
}

function SettingsEmptyState() {
  return (
    <section className="rounded-3xl border border-observatory-line bg-observatory-panel/70 px-6 py-14 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-observatory-amber">
        No providers
      </p>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight">
        No provider status was returned.
      </h3>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-observatory-muted">
        Check that the backend exposes `GET /providers/status`.
      </p>
    </section>
  );
}

function SettingsErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-3xl border border-red-400/30 bg-red-950/20 p-6">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-red-200">
        Provider status unavailable
      </p>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight">
        Settings could not be loaded.
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

function formatProviderName(name: string): string {
  return name === "openai_compatible" ? "openai_compatible" : name;
}
