import type { Run } from "@/lib/api";

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatCompactDateTime(value: string): {
  date: string;
  time: string;
} {
  const date = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
  const time = new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

  return { date, time };
}

export function formatLatency(value: number | null): string {
  return value === null ? "--" : `${value} ms`;
}

export function formatTokens(value: number | null): string {
  return (value ?? 0).toLocaleString();
}

export function getRunTokenTotal(run: Run): number {
  return run.total_tokens ?? 0;
}
