import { ModuleShell } from "@/app/module-shell";
import { requireTenantContext } from "@/lib/tenant";
import { ClientsWorkspace } from "./clients-workspace";

export default async function ClientsPage() {
  const session = await requireTenantContext();

  return (
    <ModuleShell
      active="clients"
      organizationName={session.organizationName}
      userName={session.userName}
      role={session.role}
    >
      <ClientsWorkspace />
    </ModuleShell>
  );
}
