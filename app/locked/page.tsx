import Link from "next/link";
import { ModuleShell } from "@/app/module-shell";
import { requireTenantContext } from "@/lib/tenant";

type Props = { searchParams: Promise<{ module?: string }> };

export default async function LockedModulePage({ searchParams }: Props) {
  const session = await requireTenantContext();
  const params = await searchParams;
  const moduleNumber = params.module === "3" ? 3 : 4;
  return (
    <ModuleShell active="dashboard" organizationName={session.organizationName}
      userName={session.userName} role={session.role}>
      <div className="erp-page">
        <div className="erp-panel" role="status">
          <p className="erp-kicker">Acesso controlado</p>
          <h1>Módulo {moduleNumber} bloqueado</h1>
          <p>Este módulo já possui funcionalidades em desenvolvimento, mas ainda não está liberado para a operação.
             Os módulos 1 (Clientes) e 2 (Vendas) permanecem disponíveis.</p>
          <Link className="secondary-button" href="/">Voltar ao Dashboard</Link>
        </div>
      </div>
    </ModuleShell>
  );
}
