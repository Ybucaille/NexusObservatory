import { DashboardShell } from "@/components/dashboard-shell";
import { SettingsContent } from "@/components/settings/settings-content";

export default function SettingsPage() {
  return (
    <DashboardShell
      activeItem="Settings"
      badge="Provider status"
      title="Settings"
    >
      <SettingsContent />
    </DashboardShell>
  );
}
