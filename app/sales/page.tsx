import { ModuleShell } from "@/app/module-shell";
import { requireTenantContext } from "@/lib/tenant";
import { SalesWorkspace } from "@/app/sales/sales-workspace";

export default async function SalesPage() {
  const session = await requireTenantContext();
  return (
    <ModuleShell
      active="sales"
      organizationName={session.organizationName}
      userName={session.userName}
      role={session.role}
    >
      <SalesWorkspace
        canWrite={["OWNER", "ADMIN", "MANAGER", "SELLER"].includes(session.role)}
      />
    </ModuleShell>
  );
}
