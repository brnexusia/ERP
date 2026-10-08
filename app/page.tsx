import { DashboardWorkspace } from "@/app/dashboard-workspace";
import { ModuleShell } from "@/app/module-shell";
import { requireTenantContext } from "@/lib/tenant";

export default async function HomePage() {
  const session = await requireTenantContext();

  return (
    <ModuleShell
      active="dashboard"
      organizationName={session.organizationName}
      userName={session.userName}
      role={session.role}
    >
      <DashboardWorkspace userName={session.userName} />
    </ModuleShell>
  );
}
