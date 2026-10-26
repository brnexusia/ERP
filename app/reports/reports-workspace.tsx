"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Amount = string | number;
type CommercialReport = {
  period: { start: string | null; end: string | null };
  sales: number; revenue: Amount; clients: number; averageTicket: Amount;
  channels: Record<"WHATSAPP" | "SITE" | "PHYSICAL_STORE", { sales: number; revenue: Amount }>;
  ticketByClientAge: {
    newClients: { sales: number; averageTicket: Amount };
    existingClients: { sales: number; averageTicket: Amount };
  } | null;
  sellers: Array<{
    membershipId: string; sellerName: string; sales: number;
    revenue: Amount; clients: number; averageTicket: Amount;
  }>;
};
type Ranking = {
  rank: number; purchases: number; totalPurchased: Amount;
  lastPurchaseAt: string | null;
  client: { id: string; name: string; whatsapp: string };
};
type Lifecycle = {
  inactivityDays: number | null;
  summary: { totalClients: number; withoutPurchase: number; newClients: number;
    recurringClients: number; stoppedBuying: number | null };
  clients: Array<{
    client: { id: string; name: string };
    customerType: "NEW" | "RECURRING" | "NO_PURCHASE";
    purchaseCount: number; totalPurchased: Amount;
    stoppedBuying: boolean | null; daysWithoutPurchase: number | null;
  }>;
};
type Comparison = {
  basis: "PAID_SALES";
  metric: "REVENUE" | "PURCHASES";
  summary: { totalClients: number; reduced: number; increased: number; unchanged: number };
  clients: Array<{
    client: { id: string; name: string };
    selectedMetric: { previousValue: Amount; currentValue: Amount; absoluteChange: Amount;
      percentChange: Amount | null; direction: "REDUCED" | "INCREASED" | "UNCHANGED" };
  }>;
};
type Overview = { commercial: CommercialReport; ranking: Ranking[]; lifecycle: Lifecycle };

const channelNames = {
  WHATSAPP: "WhatsApp", SITE: "Site", PHYSICAL_STORE: "Loja física",
} as const;
const currency = (value: Amount | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(Number(value ?? 0));
const integer = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
const percent = (value: number) => new Intl.NumberFormat("pt-BR",
  { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value) + "%";
const barWidth = (value: number) => Math.max(0, Math.min(100, value)).toFixed(2) + "%";
const date = (value: string | null | undefined) =>
  value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short",
    timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";
const dayToISO = (day: string, end = false) =>
  new Date(day + (end ? "T23:59:59.999-03:00" : "T00:00:00.000-03:00")).toISOString();
async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(
    typeof payload.error === "string" ? payload.error : "Não foi possível carregar o relatório.",
  );
  return payload as T;
}
function periodQuery(start: string, end: string) {
  const p = new URLSearchParams();
  if (start && end) {
    p.set("start", dayToISO(start));
    p.set("end", dayToISO(end, true));
  }
  return p.toString();
}
async function getOverview(start: string, end: string): Promise<Overview> {
  const query = periodQuery(start, end);
  const [commercial, ranking, lifecycle] = await Promise.all([
    getJson<{ report: CommercialReport }>("/api/reports/commercial" + (query ? "?" + query : "")),
    getJson<{ report: { ranking: Ranking[] } }>("/api/reports/clients/ranking" + (query ? "?" + query : "")),
    getJson<{ report: Lifecycle }>("/api/reports/clients/classification"),
  ]);
  return { commercial: commercial.report, ranking: ranking.report.ranking,
    lifecycle: lifecycle.report };
}

export function ReportsWorkspace() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [applied, setApplied] = useState({ start: "", end: "" });
  const [overview, setOverview] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [comparisonBusy, setComparisonBusy] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [comparisonInputs, setComparisonInputs] = useState({
    metric: "REVENUE" as "REVENUE" | "PURCHASES",
    previousStart: "", previousEnd: "", currentStart: "", currentEnd: "",
  });
  const [clientSearch, setClientSearch] = useState("");

  const loadOverview = useCallback(async () => {
    setBusy(true);
    setError(null);
    try { setOverview(await getOverview(applied.start, applied.end)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao consultar indicadores."); }
    finally { setBusy(false); }
  }, [applied.start, applied.end]);

  useEffect(() => { void loadOverview(); }, [loadOverview]);

  function applyPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if ((start && !end) || (!start && end) || (start && end && end < start)) {
      setError("Informe as duas datas, com fim igual ou posterior ao início, ou deixe ambas vazias.");
      return;
    }
    setApplied({ start, end });
    // Refresh even if the selected dates remain unchanged.
    if (start === applied.start && end === applied.end) void loadOverview();
  }

  async function compare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { previousStart, previousEnd, currentStart, currentEnd, metric } = comparisonInputs;
    setComparisonError(null);
    if (!previousStart || !previousEnd || !currentStart || !currentEnd ||
        previousEnd < previousStart || currentEnd < currentStart) {
      setComparisonError("Informe os dois períodos completos, com início anterior ao fim.");
      return;
    }
    setComparisonBusy(true);
    try {
      const args = new URLSearchParams({
        metric,
        previousStart: dayToISO(previousStart), previousEnd: dayToISO(previousEnd, true),
        currentStart: dayToISO(currentStart), currentEnd: dayToISO(currentEnd, true),
      });
      const result = await getJson<{ report: Comparison }>(
        "/api/reports/clients/purchase-comparison?" + args.toString(),
      );
      setComparison(result.report);
    } catch (cause) {
      setComparison(null);
      setComparisonError(cause instanceof Error ? cause.message : "Falha na comparação.");
    } finally { setComparisonBusy(false); }
  }

  const commercial = overview?.commercial;
  const ranking = overview?.ranking ?? [];
  const lifecycle = overview?.lifecycle;
  const channelRows = commercial
    ? (Object.keys(channelNames) as Array<keyof typeof channelNames>).map((channel) => ({
      name: channelNames[channel], count: commercial.channels[channel].sales,
      revenue: Number(commercial.channels[channel].revenue),
    })) : [];
  const largest = Math.max(1, ...channelRows.map((row) => row.revenue));
  const sellerLargest = Math.max(1, ...(commercial?.sellers ?? []).map((row) => Number(row.revenue)));
  const matchedRanking = useMemo(() =>
    ranking.filter((row) => row.client.name.toLowerCase().includes(clientSearch.toLowerCase().trim())),
    [ranking, clientSearch]);
  const reducedClients = comparison?.clients.filter((row) =>
    row.selectedMetric.direction === "REDUCED") ?? [];

  return (
    <div className="erp-page reports-page">
      <header className="erp-page-header">
        <div>
          <p className="erp-kicker">Módulo 2 · Inteligência comercial</p>
          <h1>Relatórios & BI</h1>
          <p>Vendas pagas, canais, desempenho comercial e comportamento de compra.</p>
        </div>
      </header>

      <section className="erp-panel stitch-panel">
        <div className="panel-heading">
          <div><p className="erp-kicker">Filtros</p><h2>Período de vendas</h2></div>
        </div>
        <form className="reports-period-form" onSubmit={applyPeriod}>
          <label>Início
            <input type="date" value={start} max={end || undefined}
              onChange={(event) => setStart(event.target.value)} />
          </label>
          <label>Fim
            <input type="date" value={end} min={start || undefined}
              onChange={(event) => setEnd(event.target.value)} />
          </label>
          <button className="primary-button" type="submit" disabled={busy}>Atualizar relatório</button>
          <button className="secondary-button" type="button" disabled={busy}
            onClick={() => {
              setStart(""); setEnd(""); setApplied({ start: "", end: "" });
              if (!applied.start && !applied.end) void loadOverview();
            }}>Limpar período</button>
        </form>
        <p className="reports-helper">
          {applied.start && applied.end
            ? "Vendas liquidadas de " + applied.start.split("-").reverse().join("/") +
              " até " + applied.end.split("-").reverse().join("/") + "."
            : "Período: todo o histórico de vendas pagas. Escolha início e fim para limitar o relatório."}
          {" "}Indicadores de clientes sem compra usam todo o histórico, independentemente do filtro.
        </p>
      </section>
      {error && <p className="erp-alert error" role="alert">{error}</p>}
      {busy && <p className="empty-state" role="status">Carregando indicadores...</p>}

      {commercial && (
        <>
          <section className="metric-grid reports-summary">
            <article className="metric-card">
              <span>Faturamento pago</span><strong>{currency(commercial.revenue)}</strong>
              <small>Pedidos integralmente quitados</small>
            </article>
            <article className="metric-card">
              <span>Vendas</span><strong>{integer(commercial.sales)}</strong>
              <small>Somente operações concluídas</small>
            </article>
            <article className="metric-card">
              <span>Ticket médio</span><strong>{currency(commercial.averageTicket)}</strong>
              <small>Valor médio por venda paga</small>
            </article>
            <article className="metric-card">
              <span>Clientes compradores</span><strong>{integer(commercial.clients)}</strong>
              <small>Clientes únicos no período</small>
            </article>
          </section>

          <div className="reports-two-columns">
            <section className="erp-panel stitch-panel">
              <div className="panel-heading">
                <div><p className="erp-kicker">Origem comercial</p><h2>Vendas por canal</h2></div>
              </div>
              <div className="reports-bar-list">
                {channelRows.map((row) => (
                  <div className="reports-bar-item" key={row.name}>
                    <div className="reports-bar-meta">
                      <strong>{row.name}</strong><span>{integer(row.count)} venda(s) · {currency(row.revenue)}</span>
                    </div>
                    <div className="reports-bar-track">
                      <div style={{ width: barWidth(row.revenue / largest * 100) }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="erp-panel stitch-panel">
              <div className="panel-heading">
                <div><p className="erp-kicker">Perfil de compra</p><h2>Ticket por tipo de cliente</h2></div>
              </div>
              {commercial.ticketByClientAge ? (
                <div className="reports-ticket-rows">
                  <div><span>Novos clientes</span>
                    <strong>{currency(commercial.ticketByClientAge.newClients.averageTicket)}</strong>
                    <small>{commercial.ticketByClientAge.newClients.sales} venda(s)</small></div>
                  <div><span>Clientes anteriores</span>
                    <strong>{currency(commercial.ticketByClientAge.existingClients.averageTicket)}</strong>
                    <small>{commercial.ticketByClientAge.existingClients.sales} venda(s)</small></div>
                </div>
              ) : <p className="empty-state">Selecione um período com data inicial para comparar novos e antigos.</p>}
            </section>
          </div>

          <section className="erp-panel stitch-panel">
            <div className="panel-heading"><div><p className="erp-kicker">Equipe</p><h2>Desempenho por vendedora</h2></div></div>
            <div className="client-table-wrap">
              <table className="client-table">
                <thead><tr><th>Vendedora</th><th>Vendas pagas</th><th>Faturamento</th><th>Clientes únicos</th><th>Ticket médio</th><th>Comparativo</th></tr></thead>
                <tbody>{commercial.sellers.map((seller) => (
                  <tr key={seller.membershipId}>
                    <td><strong>{seller.sellerName}</strong></td>
                    <td>{integer(seller.sales)}</td>
                    <td>{currency(seller.revenue)}</td>
                    <td>{integer(seller.clients)}</td>
                    <td>{currency(seller.averageTicket)}</td>
                    <td><div className="reports-mini-track"><span
                      style={{ width: barWidth(Number(seller.revenue) / sellerLargest * 100) }} /></div></td>
                  </tr>
                ))}</tbody>
              </table>
              {commercial.sellers.length === 0 && <p className="empty-state">Nenhuma venda paga no período.</p>}
            </div>
          </section>

          <section className="erp-panel stitch-panel">
            <div className="reports-section-top">
              <div><p className="erp-kicker">Relacionamento</p><h2>Ranking de compradores</h2></div>
              <label className="search-field">
                <span aria-hidden>⌕</span>
                <input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)}
                  aria-label="Buscar no ranking" placeholder="Buscar cliente" />
              </label>
            </div>
            <div className="client-table-wrap">
              <table className="client-table">
                <thead><tr><th>Posição</th><th>Cliente</th><th>Compras</th><th>Total pago</th><th>Última compra</th></tr></thead>
                <tbody>{matchedRanking.slice(0, 30).map((row) => (
                  <tr key={row.client.id}>
                    <td>#{row.rank}</td><td><strong>{row.client.name}</strong></td>
                    <td>{row.purchases}</td><td>{currency(row.totalPurchased)}</td>
                    <td>{date(row.lastPurchaseAt)}</td>
                  </tr>
                ))}</tbody>
              </table>
              {matchedRanking.length === 0 && <p className="empty-state">Nenhum comprador encontrado.</p>}
            </div>
            {matchedRanking.length > 30 && <p className="reports-helper">
              Exibidos os primeiros 30 resultados. Refine a busca para localizar outros clientes.
            </p>}
          </section>
        </>
      )}

      {lifecycle && (
        <section className="erp-panel stitch-panel">
          <div className="panel-heading"><div><p className="erp-kicker">Clientes · histórico completo</p><h2>Classificação da carteira</h2></div></div>
          <div className="reports-lifecycle-grid">
            <div><span>Clientes cadastrados</span><strong>{integer(lifecycle.summary.totalClients)}</strong></div>
            <div><span>Sem compras</span><strong>{integer(lifecycle.summary.withoutPurchase)}</strong></div>
            <div><span>Uma compra</span><strong>{integer(lifecycle.summary.newClients)}</strong></div>
            <div><span>Recorrentes</span><strong>{integer(lifecycle.summary.recurringClients)}</strong></div>
            <div><span>Sem comprar há X dias</span><strong>{lifecycle.summary.stoppedBuying === null
              ? "Não configurado" : integer(lifecycle.summary.stoppedBuying)}</strong></div>
          </div>
          <p className="reports-helper">A classificação usa todo o histórico pago. O alerta de inatividade depende do limite de dias configurado por empresa.</p>
        </section>
      )}

      <section className="erp-panel stitch-panel">
        <div className="panel-heading">
          <div><p className="erp-kicker">Comparação explícita</p><h2>Clientes que reduziram compras</h2></div>
        </div>
        <p className="reports-helper">Informe os dois períodos e a métrica. O ERP não presume janelas nem um percentual mínimo de queda.</p>
        <form className="reports-comparison-form" onSubmit={(event) => { void compare(event); }}>
          <label>Métrica
            <select value={comparisonInputs.metric}
              onChange={(event) => setComparisonInputs((value) => ({
                ...value, metric: event.target.value as Comparison["metric"],
              }))}>
              <option value="REVENUE">Valor comprado</option><option value="PURCHASES">Número de compras</option>
            </select>
          </label>
          {(["previousStart", "previousEnd", "currentStart", "currentEnd"] as const).map((name) => (
            <label key={name}>{({
              previousStart: "Anterior · início", previousEnd: "Anterior · fim",
              currentStart: "Atual · início", currentEnd: "Atual · fim",
            } as const)[name]}
              <input type="date" required value={comparisonInputs[name]}
                onChange={(event) => setComparisonInputs((value) => ({ ...value, [name]: event.target.value }))} />
            </label>
          ))}
          <button type="submit" className="primary-button" disabled={comparisonBusy}>
            {comparisonBusy ? "Calculando..." : "Comparar períodos"}
          </button>
        </form>
        {comparisonError && <p className="erp-alert error" role="alert">{comparisonError}</p>}
        {comparison && (
          <>
            <div className="reports-lifecycle-grid reports-comparison-summary">
              <div><span>Reduziram</span><strong>{comparison.summary.reduced}</strong></div>
              <div><span>Aumentaram</span><strong>{comparison.summary.increased}</strong></div>
              <div><span>Estáveis</span><strong>{comparison.summary.unchanged}</strong></div>
            </div>
            <div className="client-table-wrap">
              <table className="client-table">
                <thead><tr><th>Cliente</th><th>Anterior</th><th>Atual</th><th>Variação</th></tr></thead>
                <tbody>{reducedClients.slice(0, 30).map((row) => (
                  <tr key={row.client.id}>
                    <td><strong>{row.client.name}</strong></td>
                    <td>{comparison.metric === "REVENUE"
                      ? currency(row.selectedMetric.previousValue)
                      : row.selectedMetric.previousValue}</td>
                    <td>{comparison.metric === "REVENUE"
                      ? currency(row.selectedMetric.currentValue)
                      : row.selectedMetric.currentValue}</td>
                    <td><span className="reports-negative-change">
                      {row.selectedMetric.percentChange === null ? "—"
                        : percent(Number(row.selectedMetric.percentChange))}
                    </span></td>
                  </tr>
                ))}</tbody>
              </table>
              {reducedClients.length === 0 && <p className="empty-state">Não houve redução nesta comparação.</p>}
            </div>
            {reducedClients.length > 30 && <p className="reports-helper">Exibidos 30 clientes com redução.</p>}
          </>
        )}
      </section>
    </div>
  );
}
