import { requireTenantContext } from "@/lib/tenant";

export default async function HomePage() {
  const session = await requireTenantContext();

  return (
    <main className="foundation-shell">
      <section className="foundation-card">
        <p className="eyebrow">ERP PEDRO</p>
        <h1>Fundação do sistema em construção</h1>
        <p>
          Esta tela é provisória. O layout definitivo só será fechado a partir das fontes oficiais do Stitch.
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
            <dd>Multiempresa desde a base</dd>
          </div>
          <div>
            <dt>Banco</dt>
            <dd>PostgreSQL + Prisma</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>Progresso 1 — Em construção</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
