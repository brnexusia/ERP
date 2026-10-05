import Link from "next/link";
import type { ReactNode } from "react";

type ModuleShellProps = {
  children: ReactNode;
  active: "clients" | "settings";
  organizationName: string;
  userName: string;
  role: string;
};

export function ModuleShell({
  children,
  active,
  organizationName,
  userName,
  role,
}: ModuleShellProps) {
  return (
    <div className="erp-shell">
      <aside className="erp-sidebar">
        <div className="erp-brand">
          <span className="erp-brand-mark">EP</span>
          <div>
            <strong>ERP Pedro</strong>
            <small>Gestão comercial</small>
          </div>
        </div>

        <nav className="erp-nav" aria-label="Navegação principal">
          <p className="erp-nav-section">Etapa 1</p>
          <Link className={active === "clients" ? "active" : ""} href="/clients">
            <span aria-hidden>◫</span>
            Clientes & CRM
          </Link>
          <Link className={active === "settings" ? "active" : ""} href="/clients/settings">
            <span aria-hidden>⚙</span>
            Configurações
          </Link>

          <p className="erp-nav-section muted">Próximas etapas</p>
          <span className="erp-nav-disabled">Vendas & Relatórios</span>
          <span className="erp-nav-disabled">Produtos & Estoque</span>
          <span className="erp-nav-disabled">Financeiro & Integrações</span>
        </nav>

        <div className="erp-sidebar-footer">
          <div className="erp-org-pill">
            <span>{organizationName.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{organizationName}</strong>
              <small>{role}</small>
            </div>
          </div>
          <p>{userName}</p>
        </div>
      </aside>
      <main className="erp-main">{children}</main>
    </div>
  );
}
