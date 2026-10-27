import { notFound } from "next/navigation";
import { ModuleShell } from "@/app/module-shell";
import { requireTenantContext } from "@/lib/tenant";
import { hasPermission } from "@/lib/auth/permissions";
import { PromotionsWorkspace } from "./promotions-workspace";

export default async function PromotionsPage() {
  const session = await requireTenantContext();
  if (!hasPermission(session.role, "organization:manage")) notFound();
  return (
    <ModuleShell active="promotions" organizationName={session.organizationName}
      userName={session.userName} role={session.role}>
      <PromotionsWorkspace />
    </ModuleShell>
  );
}
