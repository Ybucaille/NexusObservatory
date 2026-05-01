"use client";

import { FormEvent, useEffect, useState } from "react";

import {
  createEndpointProfile,
  deleteEndpointProfile,
  fetchEndpointProfiles,
  fetchProviderStatus,
  updateEndpointProfile,
  type EndpointProfile,
  type ProviderStatus,
  type ProviderStatusResponse,
} from "@/lib/api";
import { formatProviderLabel } from "@/components/runs/run-format";

type LoadState =
  | { status: "loading"; providers: null; profiles: null; error: null }
  | {
      status: "ready";
      providers: ProviderStatusResponse;
      profiles: EndpointProfile[];
      error: null;
    }
  | { status: "error"; providers: null; profiles: null; error: string };

type ProfileDraft = {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  enabled: boolean;
  apiKey: string;
};

const emptyDraft: ProfileDraft = {
  id: "",
  label: "",
  baseUrl: "",
  defaultModel: "",
  enabled: true,
  apiKey: "",
};

export function SettingsContent() {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    providers: null,
    profiles: null,
    error: null,
  });
  const [createDraft, setCreateDraft] = useState<ProfileDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ProfileDraft>(emptyDraft);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function loadSettings(signal?: AbortSignal) {
    try {
      const [providers, profiles] = await Promise.all([
        fetchProviderStatus(signal),
        fetchEndpointProfiles(signal),
      ]);
      setState({ status: "ready", providers, profiles, error: null });
    } catch (error) {
      if (signal?.aborted) {
        return;
      }

      setState({
        status: "error",
        providers: null,
        profiles: null,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load provider settings.",
      });
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadSettings(controller.signal);

    return () => controller.abort();
  }, []);

  if (state.status === "loading") {
    return <SettingsLoadingState />;
  }

  if (state.status === "error") {
    return <SettingsErrorState message={state.error} />;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    try {
      await createEndpointProfile({
        id: createDraft.id.trim(),
        label: createDraft.label.trim(),
        base_url: createDraft.baseUrl.trim(),
        default_model: createDraft.defaultModel.trim() || null,
        enabled: createDraft.enabled,
        api_key: createDraft.apiKey.trim() || null,
      });
      setCreateDraft(emptyDraft);
      setActionMessage("Endpoint profile created.");
      await loadSettings();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Endpoint profile could not be created.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate(clearApiKey = false) {
    if (!editingId) {
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    try {
      await updateEndpointProfile(editingId, {
        label: editDraft.label.trim(),
        base_url: editDraft.baseUrl.trim(),
        default_model: editDraft.defaultModel.trim() || null,
        enabled: editDraft.enabled,
        api_key: clearApiKey ? null : editDraft.apiKey.trim() || undefined,
        clear_api_key: clearApiKey,
      });
      setEditDraft((currentDraft) => ({ ...currentDraft, apiKey: "" }));
      setEditingId(null);
      setActionMessage(
        clearApiKey ? "API key cleared." : "Endpoint profile updated.",
      );
      await loadSettings();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Endpoint profile could not be updated.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(profile: EndpointProfile) {
    const confirmed = window.confirm(
      `Delete endpoint profile "${profile.label}"? This also removes its stored secret reference.`,
    );
    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    try {
      await deleteEndpointProfile(profile.id);
      setEditingId(null);
      setActionMessage("Endpoint profile deleted.");
      await loadSettings();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Endpoint profile could not be deleted.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(profile: EndpointProfile) {
    setEditingId(profile.id);
    setEditDraft({
      id: profile.id,
      label: profile.label,
      baseUrl: profile.base_url,
      defaultModel: profile.default_model ?? "",
      enabled: profile.enabled,
      apiKey: "",
    });
    setActionError(null);
    setActionMessage(null);
  }

  const providers = state.providers.providers;
  const profiles = state.profiles;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-observatory-line bg-observatory-panel/80 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-observatory-cyan">
              Provider Settings
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">
              Custom endpoint profiles
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-observatory-muted">
              Manage local custom endpoints without exposing API keys to the
              frontend. API key values are accepted once, stored server-side,
              and never returned by the API.
            </p>
          </div>
          <div className="rounded-full border border-observatory-line bg-observatory-panelSoft px-3 py-1.5 font-mono text-xs text-observatory-muted">
            local single-user
          </div>
        </div>
      </section>

      {actionError ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-950/20 px-4 py-3 text-sm text-red-100/85">
          {actionError}
        </div>
      ) : null}

      {actionMessage ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100/90">
          {actionMessage}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        {providers.map((provider) => (
          <ProviderCard key={provider.name} provider={provider} />
        ))}
      </section>

      <section className="rounded-3xl border border-observatory-line bg-observatory-panel/80 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-observatory-cyan">
              Managed Profiles
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">
              SQLite metadata, server-side secrets
            </h3>
          </div>
          <StatusPill
            label={`${profiles.length} managed`}
            tone={profiles.length > 0 ? "success" : "warning"}
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {profiles.map((profile) => (
            <ManagedProfileCard
              draft={editDraft}
              isEditing={editingId === profile.id}
              isSaving={isSaving}
              key={profile.id}
              onCancel={() => setEditingId(null)}
              onClearApiKey={() => handleUpdate(true)}
              onDelete={() => handleDelete(profile)}
              onDraftChange={setEditDraft}
              onEdit={() => startEditing(profile)}
              onSubmit={(event) => {
                event.preventDefault();
                void handleUpdate();
              }}
              profile={profile}
            />
          ))}

          {profiles.length === 0 ? (
            <div className="rounded-2xl border border-observatory-line bg-observatory-ink/40 p-5 text-sm leading-6 text-observatory-muted">
              No managed profiles yet. Environment profiles still work as
              bootstrap configuration.
            </div>
          ) : null}
        </div>
      </section>

      <CreateProfileForm
        draft={createDraft}
        isSaving={isSaving}
        onChange={setCreateDraft}
        onSubmit={handleCreate}
      />
    </div>
  );
}

function ProviderCard({ provider }: { provider: ProviderStatus }) {
  const isCustomEndpoint = provider.name === "custom_endpoint";

  return (
    <article
      className={[
        "rounded-3xl border border-observatory-line bg-observatory-panel/80 p-5",
        isCustomEndpoint ? "xl:col-span-2" : "",
      ].join(" ")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-observatory-cyan">
            Provider
          </p>
          <h3
            className="mt-2 truncate text-xl font-semibold tracking-tight"
            title={provider.name}
          >
            {formatProviderLabel(provider.name)}
          </h3>
        </div>
        <div className="flex max-w-full flex-wrap gap-2 sm:justify-end">
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

      {isCustomEndpoint ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ConfigCheck
              configured={Boolean(provider.base_url_configured)}
              label="Any base URL"
            />
            <ConfigCheck
              configured={Boolean(provider.api_key_configured)}
              label="Any API key"
            />
          </div>

          {(provider.endpoint_profiles ?? []).length > 0 ? (
            <div className="space-y-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-observatory-muted">
                  Available endpoint profiles
                </p>
                <p className="mt-1 text-xs leading-5 text-observatory-muted">
                  Includes enabled SQLite profiles plus environment profiles.
                  API key values are omitted.
                </p>
              </div>
              {(provider.endpoint_profiles ?? []).map((endpointProfile) => (
                <div
                  className="rounded-2xl border border-observatory-line bg-observatory-ink/40 p-4"
                  key={endpointProfile.id}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p
                        className="truncate text-base font-semibold text-observatory-text"
                        title={endpointProfile.label}
                      >
                        {endpointProfile.label}
                      </p>
                      <p
                        className="mt-1 truncate font-mono text-xs text-observatory-muted"
                        title={endpointProfile.id}
                      >
                        {endpointProfile.id}
                      </p>
                    </div>
                    <StatusPill
                      label={
                        endpointProfile.configured
                          ? "Configured"
                          : "Missing config"
                      }
                      tone={endpointProfile.configured ? "success" : "warning"}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <DetailTile
                      label="Default model"
                      value={endpointProfile.default_model || "Not configured"}
                    />
                    <ConfigCheck
                      configured={endpointProfile.base_url_configured}
                      label="Base URL"
                    />
                    <ConfigCheck
                      configured={endpointProfile.api_key_configured}
                      label="API key"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ManagedProfileCard({
  draft,
  isEditing,
  isSaving,
  onCancel,
  onClearApiKey,
  onDelete,
  onDraftChange,
  onEdit,
  onSubmit,
  profile,
}: {
  draft: ProfileDraft;
  isEditing: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onClearApiKey: () => void;
  onDelete: () => void;
  onDraftChange: (draft: ProfileDraft) => void;
  onEdit: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  profile: EndpointProfile;
}) {
  if (isEditing) {
    return (
      <form
        className="rounded-2xl border border-observatory-cyan/30 bg-observatory-ink/45 p-4"
        onSubmit={onSubmit}
      >
        <ProfileFields
          draft={draft}
          idEditable={false}
          onChange={onDraftChange}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={primaryButtonClass} disabled={isSaving} type="submit">
            Save changes
          </button>
          <button
            className={secondaryButtonClass}
            disabled={isSaving || !profile.api_key_configured}
            onClick={onClearApiKey}
            type="button"
          >
            Clear API key
          </button>
          <button
            className={secondaryButtonClass}
            disabled={isSaving}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <article className="rounded-2xl border border-observatory-line bg-observatory-ink/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold" title={profile.label}>
            {profile.label}
          </p>
          <p className="mt-1 truncate font-mono text-xs text-observatory-muted">
            {profile.id}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill
            label={profile.enabled ? "Enabled" : "Disabled"}
            tone={profile.enabled ? "success" : "warning"}
          />
          <StatusPill
            label={profile.api_key_configured ? "API key set" : "Missing key"}
            tone={profile.api_key_configured ? "success" : "warning"}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <DetailTile label="Base URL" value={profile.base_url} />
        <DetailTile
          label="Default model"
          value={profile.default_model || "Not configured"}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className={primaryButtonClass} onClick={onEdit} type="button">
          Edit
        </button>
        <button className={dangerButtonClass} onClick={onDelete} type="button">
          Delete
        </button>
      </div>
    </article>
  );
}

function CreateProfileForm({
  draft,
  isSaving,
  onChange,
  onSubmit,
}: {
  draft: ProfileDraft;
  isSaving: boolean;
  onChange: (draft: ProfileDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="rounded-3xl border border-observatory-line bg-observatory-panel/80 p-5">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-observatory-cyan">
        Create Profile
      </p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight">
        Add a local custom endpoint
      </h3>
      <p className="mt-2 text-sm leading-6 text-observatory-muted">
        API key values are submitted to the backend only. They are not rendered
        back into this form after saving.
      </p>

      <form className="mt-5" onSubmit={onSubmit}>
        <ProfileFields draft={draft} idEditable onChange={onChange} />
        <div className="mt-4 flex justify-end">
          <button className={primaryButtonClass} disabled={isSaving} type="submit">
            Create profile
          </button>
        </div>
      </form>
    </section>
  );
}

function ProfileFields({
  draft,
  idEditable,
  onChange,
}: {
  draft: ProfileDraft;
  idEditable: boolean;
  onChange: (draft: ProfileDraft) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <TextInput
        disabled={!idEditable}
        label="Profile ID"
        onChange={(value) => onChange({ ...draft, id: value })}
        placeholder="openai"
        value={draft.id}
      />
      <TextInput
        label="Label"
        onChange={(value) => onChange({ ...draft, label: value })}
        placeholder="OpenAI"
        value={draft.label}
      />
      <TextInput
        label="Base URL"
        onChange={(value) => onChange({ ...draft, baseUrl: value })}
        placeholder="https://api.openai.com/v1"
        value={draft.baseUrl}
      />
      <TextInput
        label="Default model"
        onChange={(value) => onChange({ ...draft, defaultModel: value })}
        placeholder="gpt-4o-mini"
        value={draft.defaultModel}
      />
      <TextInput
        autoComplete="new-password"
        label="API key"
        onChange={(value) => onChange({ ...draft, apiKey: value })}
        placeholder="Set or replace API key"
        type="password"
        value={draft.apiKey}
      />
      <label className="flex items-center gap-3 rounded-2xl border border-observatory-line bg-observatory-ink/40 px-4 py-3">
        <input
          checked={draft.enabled}
          className="h-4 w-4 accent-observatory-cyan"
          onChange={(event) =>
            onChange({ ...draft, enabled: event.target.checked })
          }
          type="checkbox"
        />
        <span className="text-sm text-observatory-muted">Enabled</span>
      </label>
    </div>
  );
}

function TextInput({
  autoComplete,
  disabled = false,
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  autoComplete?: string;
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="font-mono text-xs uppercase tracking-[0.18em] text-observatory-muted">
        {label}
      </span>
      <input
        autoComplete={autoComplete}
        className="mt-2 w-full rounded-2xl border border-observatory-line bg-observatory-ink/80 px-4 py-3 text-sm text-observatory-text outline-none transition placeholder:text-observatory-muted/60 focus:border-observatory-cyan/60 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-observatory-line bg-observatory-ink/50 p-4">
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

function ConfigCheck({
  configured,
  label,
}: {
  configured: boolean;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-observatory-line bg-observatory-ink/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
        "inline-flex shrink-0 whitespace-nowrap rounded-full border px-3 py-1 font-mono text-xs",
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

function SettingsErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-3xl border border-red-400/30 bg-red-950/20 p-6">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-red-200">
        Provider settings unavailable
      </p>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight">
        Settings could not be loaded.
      </h3>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-red-100/80">
        {message}
      </p>
    </section>
  );
}

const primaryButtonClass =
  "rounded-2xl border border-observatory-cyan/40 bg-observatory-cyan/10 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.16em] text-observatory-cyan transition hover:bg-observatory-cyan/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClass =
  "rounded-2xl border border-observatory-line bg-observatory-panelSoft px-4 py-2.5 font-mono text-xs uppercase tracking-[0.16em] text-observatory-muted transition hover:border-observatory-cyan/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-60";

const dangerButtonClass =
  "rounded-2xl border border-red-400/25 bg-red-400/5 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.16em] text-red-100/80 transition hover:bg-red-400/10 hover:text-white";
