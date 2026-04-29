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
  provider: "mock" | "openai_compatible";
  model: string;
};

export type CompareTarget = {
  provider: ExecuteRunPayload["provider"];
  model: string;
};

export type CompareRunsPayload = {
  prompt: string;
  targets: CompareTarget[];
};

export type CompareResult = {
  provider: string;
  model: string;
  status: "success" | "error";
  run: Run | null;
  error_message: string | null;
};

export type CompareRunsResponse = {
  results: CompareResult[];
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
