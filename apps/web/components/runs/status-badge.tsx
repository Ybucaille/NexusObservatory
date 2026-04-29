import type { RunStatus } from "@/lib/api";

const statusStyles: Record<RunStatus, string> = {
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  error: "border-red-400/30 bg-red-400/10 text-red-200",
  running: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  cancelled: "border-slate-400/30 bg-slate-400/10 text-slate-200",
};

export function StatusBadge({ status }: { status: RunStatus }) {
  return (
    <span
      className={[
        "rounded-full border px-3 py-1 font-mono text-xs capitalize",
        statusStyles[status],
      ].join(" ")}
    >
      {status}
    </span>
  );
}
