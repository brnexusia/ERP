import { ModuleShell } from "@/app/module-shell";
import { requireTenantContext } from "@/lib/tenant";
import { ClientsWorkspace } from "./clients-workspace";

type PageProps = { searchParams: Promise<{ client?: string | string[] }> };

export default async function ClientsPage({ searchParams }: PageProps) {
  const { client } = await searchParams;
  const initialClientId = typeof client === "string" && /^[a-z0-9]{15,40}$/i.test(client) ? client : null;
  const session = await requireTenantContext();

  return (
    <ModuleShell
      active="clients"
      organizationName={session.organizationName}
      userName={session.userName}
      role={session.role}
    >
      <ClientsWorkspace role={session.role} initialClientId={initialClientId} />
    </ModuleShell>
  );
}
