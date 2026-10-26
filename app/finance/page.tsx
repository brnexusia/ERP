import { notFound } from "next/navigation";
import { ModuleShell } from "@/app/module-shell";
import { FinanceWorkspace } from "@/app/finance/finance-workspace";
import { requireTenantContext } from "@/lib/tenant";
import { hasPermission } from "@/lib/auth/permissions";

export default async function FinancePage() {
  const session = await requireTenantContext();
  if (!hasPermission(session.role, "finance:read")) notFound();
  return (
    <ModuleShell active="finance" organizationName={session.organizationName}
      userName={session.userName} role={session.role}>
      <FinanceWorkspace canWrite={hasPermission(session.role, "finance:write")} />
    </ModuleShell>
  );
}
