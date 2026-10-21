import { notFound } from "next/navigation";
import { ModuleShell } from "@/app/module-shell";
import { requireTenantContext } from "@/lib/tenant";
import { hasPermission } from "@/lib/auth/permissions";
import { SupportWorkspace } from "./support-workspace";

export default async function SupportPage() {
  const session = await requireTenantContext();
  if (!hasPermission(session.role, "clients:read")) notFound();
  return (
    <ModuleShell active="support" organizationName={session.organizationName}
      userName={session.userName} role={session.role}>
      <SupportWorkspace canWrite={hasPermission(session.role, "clients:write")} />
    </ModuleShell>
  );
}
