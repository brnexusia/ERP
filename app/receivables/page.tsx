import { notFound } from "next/navigation";
import { ModuleShell } from "@/app/module-shell";
import { requireTenantContext } from "@/lib/tenant";
import { hasPermission } from "@/lib/auth/permissions";
import { ManualReceivablesWorkspace } from "./manual-receivables-workspace";

export default async function ManualReceivablesPage() {
  const session = await requireTenantContext();
  if (!hasPermission(session.role, "finance:read")) notFound();
  return (
    <ModuleShell
      active="receivables"
      organizationName={session.organizationName}
      userName={session.userName}
      role={session.role}
    >
      <ManualReceivablesWorkspace canWrite={hasPermission(session.role, "finance:write")} />
    </ModuleShell>
  );
}
