import Link from "next/link";

import type { Run } from "@/lib/api";
import {
  formatDateTime,
  formatLatency,
  formatProviderLabel,
  getRunTokenTotal,
} from "./run-format";
import { StatusBadge } from "./status-badge";

type RunsTableProps = {
  runs: Run[];
  compact?: boolean;
};

export function RunsTable({ runs, compact = false }: RunsTableProps) {
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col className="w-24 xl:w-28" />
          <col className="w-32 xl:w-40" />
          <col className="hidden w-28 2xl:table-column" />
          <col className="w-36 xl:w-44" />
          <col className="w-24 xl:w-28" />
          <col className="hidden w-24 2xl:table-column" />
          <col />
          <col className="w-20 xl:w-24" />
        </colgroup>
        <thead>
          <tr className="border-b border-observatory-line text-xs uppercase tracking-[0.2em] text-observatory-muted">
            <th className="px-3 py-4 font-medium xl:px-4">Status</th>
            <th className="px-3 py-4 font-medium xl:px-4">Time</th>
            <th className="hidden px-3 py-4 font-medium 2xl:table-cell xl:px-4">
              Provider
            </th>
            <th className="px-3 py-4 font-medium xl:px-4">Model</th>
            <th className="px-3 py-4 font-medium xl:px-4">Latency</th>
            <th className="hidden px-3 py-4 font-medium 2xl:table-cell xl:px-4">
              Tokens
            </th>
            <th className="px-3 py-4 font-medium xl:px-4">Prompt</th>
            <th className="px-3 py-4 text-right font-medium xl:px-4">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              className="border-b border-observatory-line/60 transition last:border-0 hover:bg-white/[0.03]"
              key={run.id}
            >
              <td className="px-3 py-4 xl:px-4">
                <StatusBadge status={run.status} />
              </td>
              <td className="px-3 py-4 text-observatory-muted xl:px-4">
                <span
                  className="block truncate"
                  title={formatDateTime(run.created_at)}
                >
                  {formatDateTime(run.created_at)}
                </span>
              </td>
              <td
                className="hidden truncate px-3 py-4 text-observatory-text 2xl:table-cell xl:px-4"
                title={run.provider}
              >
                {formatProviderLabel(run.provider)}
              </td>
              <td className="px-3 py-4 text-observatory-text xl:px-4">
                <span className="block truncate" title={run.model_name}>
                  {run.model_name}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-observatory-muted xl:px-4">
                {formatLatency(run.latency_ms)}
              </td>
              <td className="hidden px-3 py-4 text-observatory-muted 2xl:table-cell xl:px-4">
                {getRunTokenTotal(run).toLocaleString()}
              </td>
              <td className="px-3 py-4 text-observatory-muted xl:px-4">
                <Link
                  className="block truncate transition hover:text-observatory-cyan"
                  href={`/runs/${run.id}`}
                  title={run.prompt}
                >
                  {run.prompt}
                </Link>
              </td>
              <td className="px-3 py-4 text-right xl:px-4">
                <Link
                  className="inline-flex justify-end font-mono text-xs uppercase tracking-[0.12em] text-observatory-cyan transition hover:text-white xl:tracking-[0.18em]"
                  href={`/runs/${run.id}`}
                >
                  {compact ? "Open" : "Inspect"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
