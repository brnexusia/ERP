import { notFound } from "next/navigation";
import { ModuleShell } from "@/app/module-shell";
import { requireTenantContext } from "@/lib/tenant";
import { hasPermission } from "@/lib/auth/permissions";
import { ReportsWorkspace } from "./reports-workspace";

export default async function ReportsPage() {
  const session = await requireTenantContext();
  if (!hasPermission(session.role, "reports:read") ||
      !hasPermission(session.role, "sales:read") ||
      !hasPermission(session.role, "clients:read")) notFound();
  return (
    <ModuleShell active="reports" organizationName={session.organizationName}
      userName={session.userName} role={session.role}>
      <ReportsWorkspace />
    </ModuleShell>
  );
}
