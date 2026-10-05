import { ModuleShell } from "@/app/module-shell";
import { requireTenantContext } from "@/lib/tenant";
import { ClientSettingsWorkspace } from "./settings-workspace";

export default async function ClientSettingsPage() {
  const session = await requireTenantContext();

  return (
    <ModuleShell
      active="settings"
      organizationName={session.organizationName}
      userName={session.userName}
      role={session.role}
    >
      <ClientSettingsWorkspace role={session.role} />
    </ModuleShell>
  );
}
