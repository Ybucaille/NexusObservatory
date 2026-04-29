import { DashboardShell } from "@/components/dashboard-shell";
import { ModelLabContent } from "@/components/lab/model-lab-content";

export default function ModelLabPage() {
  return (
    <DashboardShell
      activeItem="Model Lab"
      badge="Comparison lab"
      title="Model Lab"
    >
      <ModelLabContent />
    </DashboardShell>
  );
}
