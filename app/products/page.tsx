import { ModuleShell } from "@/app/module-shell";
import { ProductsWorkspace } from "@/app/products/products-workspace";
import { requireTenantContext } from "@/lib/tenant";
import { hasPermission } from "@/lib/auth/permissions";
import { notFound } from "next/navigation";

type PageProps = { searchParams: Promise<{ product?: string | string[] }> };

export default async function ProductsPage({ searchParams }: PageProps) {
  const { product } = await searchParams;
  const initialProductId = typeof product === "string" && /^[a-z0-9]{15,40}$/i.test(product) ? product : null;
  const session = await requireTenantContext();
  if (!hasPermission(session.role, "inventory:read")) notFound();
  return (
    <ModuleShell active="products" organizationName={session.organizationName}
      userName={session.userName} role={session.role}>
      <ProductsWorkspace canWrite={hasPermission(session.role, "inventory:write")} initialProductId={initialProductId} />
    </ModuleShell>
  );
}
