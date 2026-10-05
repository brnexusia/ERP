import { ModuleShell } from "@/app/module-shell";
import { ClientsWorkspace } from "@/app/clients/clients-workspace";
import { requireTenantContext } from "@/lib/tenant";

export default async function HomePage() {
  const session = await requireTenantContext();

  return (
    <ModuleShell
      active="clients"
      organizationName={session.organizationName}
      userName={session.userName}
      role={session.role}
    >
      <ClientsWorkspace role={session.role} />
    </ModuleShell>
  );
}
