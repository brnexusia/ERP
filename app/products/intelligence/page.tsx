import { notFound } from "next/navigation";
import { ModuleShell } from "@/app/module-shell";
import { ProductIntelligenceWorkspace } from "./product-intelligence-workspace";
import { requireTenantContext } from "@/lib/tenant";
import { hasPermission } from "@/lib/auth/permissions";

export default async function ProductIntelligencePage() {
  const session = await requireTenantContext();
  if (!hasPermission(session.role, "inventory:read") || !hasPermission(session.role, "sales:read")) notFound();
  return (
    <ModuleShell active="products" organizationName={session.organizationName}
      userName={session.userName} role={session.role}>
      <ProductIntelligenceWorkspace />
    </ModuleShell>
  );
}
