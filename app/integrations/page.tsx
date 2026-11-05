import { notFound } from "next/navigation";
import { ModuleShell } from "@/app/module-shell";
import { IntegrationsWorkspace } from "@/app/integrations/integrations-workspace";
import { requireTenantContext } from "@/lib/tenant";
import { hasPermission } from "@/lib/auth/permissions";

export default async function IntegrationsPage() {
  const session = await requireTenantContext();
  if (!hasPermission(session.role, "integrations:manage")) notFound();
  return (
    <ModuleShell active="integrations" organizationName={session.organizationName}
      userName={session.userName} role={session.role}>
      <IntegrationsWorkspace />
    </ModuleShell>
  );
}
