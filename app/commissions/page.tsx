import { notFound } from "next/navigation";
import { ModuleShell } from "@/app/module-shell";
import { requireTenantContext } from "@/lib/tenant";
import { CommissionsWorkspace } from "@/app/commissions/commissions-workspace";

export default async function CommissionsPage() {
  const session = await requireTenantContext();
  if (!["OWNER", "ADMIN", "MANAGER", "FINANCE"].includes(session.role)) notFound();
  return (
    <ModuleShell
      active="commissions"
      organizationName={session.organizationName}
      userName={session.userName}
      role={session.role}
    >
      <CommissionsWorkspace
        canManage={["OWNER", "ADMIN", "MANAGER"].includes(session.role)}
        canSettle={["OWNER", "ADMIN", "FINANCE"].includes(session.role)}
      />
    </ModuleShell>
  );
}
