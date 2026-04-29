import { DashboardShell } from "@/components/dashboard-shell";
import { RunDetailContent } from "@/components/runs/run-detail-content";

export default function RunDetailPage() {
  return (
    <DashboardShell activeItem="Runs" badge="Run detail" title="Run Detail">
      <RunDetailContent />
    </DashboardShell>
  );
}
