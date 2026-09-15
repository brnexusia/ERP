export default function HomePage() {
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
