import { DashboardShell } from "@/components/dashboard-shell";
import { RunsPageContent } from "@/components/runs/runs-page-content";

export default function RunsPage() {
  return (
    <DashboardShell activeItem="Runs" badge="Run history" title="Runs">
      <RunsPageContent />
    </DashboardShell>
  );
}
