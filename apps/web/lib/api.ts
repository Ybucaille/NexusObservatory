export type RunStatus = "success" | "error" | "running" | "cancelled";

export type Run = {
  id: number;
  created_at: string;
  updated_at: string;
  prompt: string;
  response: string | null;
  model_name: string;
  provider: string;
  status: RunStatus;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost: number | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
};

export type TraceEvent = {
  id: number;
  run_id: number;
  created_at: string;
  type: string;
  title: string;
  message: string;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
};

export type ExecuteRunPayload = {
  prompt: string;
  provider: "mock" | "custom_endpoint";
  model: string;
  endpoint_id?: string | null;
};

export type CompareTarget = {
  provider: ExecuteRunPayload["provider"];
  model: string;
  endpoint_id?: string | null;
};

export type CompareRunsPayload = {
  prompt: string;
  targets: CompareTarget[];
};

export type CompareResult = {
  provider: string;
  model: string;
  status: "success" | "error";
  endpoint_id: string | null;
  endpoint_label: string | null;
  run: Run | null;
  error_message: string | null;
};

export type CompareRunsResponse = {
  results: CompareResult[];
};

export type CustomEndpointProfileStatus = {
  id: string;
  label: string;
  configured: boolean;
  base_url_configured: boolean;
  api_key_configured: boolean;
  default_model: string | null;
};

export type ProviderStatus = {
  name: string;
  available: boolean;
  configured: boolean;
  default_model: string | null;
  base_url_configured: boolean | null;
  api_key_configured: boolean | null;
  endpoint_profiles: CustomEndpointProfileStatus[] | null;
};

export type ProviderStatusResponse = {
  providers: ProviderStatus[];
};

export type EndpointProfile = {
  id: string;
  label: string;
  base_url: string;
  default_model: string | null;
  enabled: boolean;
  api_key_configured: boolean;
  created_at: string;
  updated_at: string;
};

export type EndpointProfileCreatePayload = {
  id: string;
  label: string;
  base_url: string;
  default_model?: string | null;
  enabled: boolean;
  api_key?: string | null;
};

export type EndpointProfileUpdatePayload = {
  label?: string;
  base_url?: string;
  default_model?: string | null;
  enabled?: boolean;
  api_key?: string | null;
  clear_api_key?: boolean;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  }

  return API_BASE_URL.replace(/\/$/, "");
}

export async function fetchRuns(signal?: AbortSignal): Promise<Run[]> {
  const response = await fetch(`${getApiBaseUrl()}/runs`, {
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load runs: ${response.status}`);
  }

  return response.json() as Promise<Run[]>;
}

export async function fetchRun(
  runId: number,
  signal?: AbortSignal,
): Promise<Run> {
  const response = await fetch(`${getApiBaseUrl()}/runs/${runId}`, {
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load run ${runId}: ${response.status}`);
  }

  return response.json() as Promise<Run>;
}

export async function fetchRunTrace(
  runId: number,
  signal?: AbortSignal,
): Promise<TraceEvent[]> {
  const response = await fetch(`${getApiBaseUrl()}/runs/${runId}/trace`, {
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load trace for run ${runId}: ${response.status}`);
  }

  return response.json() as Promise<TraceEvent[]>;
}

export async function executeRun(payload: ExecuteRunPayload): Promise<Run> {
  const response = await fetch(`${getApiBaseUrl()}/runs/execute`, {
    body: JSON.stringify(payload),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Failed to execute run."));
  }

  return response.json() as Promise<Run>;
}

export async function compareRuns(
  payload: CompareRunsPayload,
): Promise<CompareRunsResponse> {
  const response = await fetch(`${getApiBaseUrl()}/runs/compare`, {
    body: JSON.stringify(payload),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Failed to compare runs."));
  }

  return response.json() as Promise<CompareRunsResponse>;
}

export async function fetchProviderStatus(
  signal?: AbortSignal,
): Promise<ProviderStatusResponse> {
  const response = await fetch(`${getApiBaseUrl()}/providers/status`, {
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load provider status: ${response.status}`);
  }

  return response.json() as Promise<ProviderStatusResponse>;
}

export async function fetchEndpointProfiles(
  signal?: AbortSignal,
): Promise<EndpointProfile[]> {
  const response = await fetch(`${getApiBaseUrl()}/endpoint-profiles`, {
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load endpoint profiles: ${response.status}`);
  }

  return response.json() as Promise<EndpointProfile[]>;
}

export async function createEndpointProfile(
  payload: EndpointProfileCreatePayload,
): Promise<EndpointProfile> {
  const response = await fetch(`${getApiBaseUrl()}/endpoint-profiles`, {
    body: JSON.stringify(payload),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, "Failed to create endpoint profile."),
    );
  }

  return response.json() as Promise<EndpointProfile>;
}

export async function updateEndpointProfile(
  profileId: string,
  payload: EndpointProfileUpdatePayload,
): Promise<EndpointProfile> {
  const response = await fetch(
    `${getApiBaseUrl()}/endpoint-profiles/${encodeURIComponent(profileId)}`,
    {
      body: JSON.stringify(payload),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "PATCH",
    },
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(response, `Failed to update endpoint profile ${profileId}.`),
    );
  }

  return response.json() as Promise<EndpointProfile>;
}

export async function deleteEndpointProfile(profileId: string): Promise<void> {
  const response = await fetch(
    `${getApiBaseUrl()}/endpoint-profiles/${encodeURIComponent(profileId)}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(response, `Failed to delete endpoint profile ${profileId}.`),
    );
  }
}

async function readApiError(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") {
      return body.detail;
    }
  } catch {
    return `${fallbackMessage} Status: ${response.status}`;
  }

  return `${fallbackMessage} Status: ${response.status}`;
}
