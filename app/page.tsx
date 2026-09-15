import { OrganizationSwitcher } from "@/app/organization-switcher";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/tenant";

export default async function HomePage() {
  const session = await requireTenantContext();
  const memberships = await db.membership.findMany({
    where: {
      userId: session.userId,
      organization: { status: "ACTIVE" },
    },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="foundation-shell">
      <section className="foundation-card">
        <p className="eyebrow">ERP PEDRO</p>
        <h1>Base funcional validada</h1>
        <p>
          Esta tela continua provisória. O layout definitivo só será fechado a partir das fontes oficiais do Stitch.
        </p>
        <dl>
          <div>
            <dt>Empresa ativa</dt>
            <dd>{session.organizationName}</dd>
          </div>
          <div>
            <dt>Usuário</dt>
            <dd>{session.userName}</dd>
          </div>
          <div>
            <dt>Papel</dt>
            <dd>{session.role}</dd>
          </div>
          <div>
            <dt>Arquitetura</dt>
            <dd>Multiempresa validada</dd>
          </div>
          <div>
            <dt>Banco</dt>
            <dd>PostgreSQL + Prisma</dd>
          </div>
          <div>
            <dt>Fundação</dt>
            <dd>Progresso 1 — Fechado</dd>
          </div>
          <div>
            <dt>Visual</dt>
            <dd>Progresso 2 — Em construção</dd>
          </div>
          <div>
            <dt>Clientes</dt>
            <dd>Progresso 3 — Em construção</dd>
          </div>
        </dl>

        <OrganizationSwitcher
          activeOrganizationId={session.organizationId}
          organizations={memberships.map((membership) => ({
            id: membership.organization.id,
            name: membership.organization.name,
          }))}
        />
      </section>
    </main>
  );
}
