import { ModuleShell } from "@/app/module-shell";
import { ProductsWorkspace } from "@/app/products/products-workspace";
import { requireTenantContext } from "@/lib/tenant";
import { hasPermission } from "@/lib/auth/permissions";

export default async function ProductsPage() {
  const session = await requireTenantContext();
  return (
    <ModuleShell active="products" organizationName={session.organizationName}
      userName={session.userName} role={session.role}>
      <ProductsWorkspace canWrite={hasPermission(session.role, "inventory:write")} />
    </ModuleShell>
  );
}
