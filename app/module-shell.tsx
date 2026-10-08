import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/app/logout-button";

type ModuleShellProps = {
  children: ReactNode;
  active: "dashboard" | "clients" | "settings";
  organizationName: string;
  userName: string;
  role: string;
};

type NavIconProps = {
  kind: "dashboard" | "clients" | "sales" | "inventory" | "reports" | "support" | "finance" | "integrations" | "settings";
};

function NavIcon({ kind }: NavIconProps) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (kind === "dashboard") {
    return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
  }
  if (kind === "clients") {
    return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  }
  if (kind === "sales") {
    return <svg {...common}><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></svg>;
  }
  if (kind === "inventory") {
    return <svg {...common}><path d="m21 8-9 5-9-5" /><path d="M3 8l9-5 9 5v8l-9 5-9-5Z" /><path d="M12 13v8" /></svg>;
  }
  if (kind === "reports") {
    return <svg {...common}><path d="M4 19V9" /><path d="M10 19V5" /><path d="M16 19v-7" /><path d="M22 19V3" /></svg>;
  }
  if (kind === "support") {
    return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8" /><path d="M8 13h5" /></svg>;
  }
  if (kind === "finance") {
    return <svg {...common}><path d="M3 6h18" /><path d="M6 10h12" /><path d="M5 3h14l2 3v15H3V6Z" /><path d="M9 15h6" /></svg>;
  }
  if (kind === "integrations") {
    return <svg {...common}><path d="M8 12h8" /><path d="M12 8v8" /><circle cx="12" cy="12" r="3" /><circle cx="4" cy="12" r="2" /><circle cx="20" cy="12" r="2" /><circle cx="12" cy="4" r="2" /><circle cx="12" cy="20" r="2" /></svg>;
  }
  return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.37.33.71.6 1 .3.3.68.5 1.1.6h.1v4h-.1c-.42.1-.8.3-1.1.6-.27.29-.48.63-.6 1Z" /></svg>;
}

function userInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "");
}

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
          <span className="erp-brand-mark">P</span>
          <div>
            <strong>Pedro ERP</strong>
            <small>Gestão comercial</small>
          </div>
        </div>

        <nav className="erp-nav" aria-label="Navegação principal">
          <p className="erp-nav-section">Principal</p>
          <Link className={active === "dashboard" ? "active" : ""} href="/">
            <NavIcon kind="dashboard" />
            <span>Dashboard Geral</span>
          </Link>
          <Link className={active === "clients" ? "active" : ""} href="/clients">
            <NavIcon kind="clients" />
            <span>Clientes & CRM</span>
          </Link>

          <p className="erp-nav-section">Operação</p>
          <span className="erp-nav-disabled"><NavIcon kind="sales" /><span>Vendas & Pedidos</span><b>02</b></span>
          <span className="erp-nav-disabled"><NavIcon kind="inventory" /><span>Produtos & Estoque</span><b>03</b></span>
          <span className="erp-nav-disabled"><NavIcon kind="reports" /><span>Relatórios & BI</span></span>
          <span className="erp-nav-disabled"><NavIcon kind="support" /><span>Atendimento & SAC</span></span>

          <p className="erp-nav-section">Administração</p>
          <span className="erp-nav-disabled"><NavIcon kind="finance" /><span>Financeiro</span><b>04</b></span>
          <span className="erp-nav-disabled"><NavIcon kind="integrations" /><span>Integrações</span><b>04</b></span>
          <Link className={active === "settings" ? "active" : ""} href="/clients/settings">
            <NavIcon kind="settings" />
            <span>Configurações</span>
          </Link>
        </nav>

        <div className="erp-sidebar-footer">
          <div className="erp-org-pill">
            <span>{userInitials(userName).toUpperCase()}</span>
            <div>
              <strong>{userName}</strong>
              <small>{organizationName} · {role}</small>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <section className="erp-workspace">
        <header className="erp-topbar">
          <div className="erp-topbar-brand">
            <span className="erp-topbar-dot" />
            <span>{organizationName}</span>
          </div>
          <div className="erp-topbar-actions">
            <span className="erp-live-pill"><i /> Sistema online</span>
            <span className="erp-user-chip">{userInitials(userName).toUpperCase()}</span>
          </div>
        </header>
        <main className="erp-main">{children}</main>
      </section>
    </div>
  );
}
