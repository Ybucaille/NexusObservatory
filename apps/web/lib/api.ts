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
