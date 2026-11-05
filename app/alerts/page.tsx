import { ModuleShell } from "@/app/module-shell";
import { requireTenantContext } from "@/lib/tenant";
import { hasPermission } from "@/lib/auth/permissions";
import { notFound } from "next/navigation";
import { AlertsWorkspace } from "./alerts-workspace";

export default async function AlertsPage() {
  const session = await requireTenantContext();
  const canReadClients = hasPermission(session.role, "clients:read") && hasPermission(session.role, "sales:read");
  const canReadInventory = hasPermission(session.role, "inventory:read");
  if (!canReadClients && !canReadInventory) notFound();
  return (
    <ModuleShell active="alerts" organizationName={session.organizationName}
      userName={session.userName} role={session.role}>
      <AlertsWorkspace />
    </ModuleShell>
  );
}
