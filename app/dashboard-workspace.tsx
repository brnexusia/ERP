"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type DecimalLike = string | number | null | undefined;

type DashboardData = {
  period?: { start?: string | null; end?: string | null };
  commercial?: {
    sales?: number;
    revenue?: DecimalLike;
    clients?: number;
    averageTicket?: DecimalLike;
    channels?: Record<string, { sales?: number; revenue?: DecimalLike }>;
    sellers?: Array<{
      membershipId?: string;
      sellerName?: string;
      sales?: number;
      revenue?: DecimalLike;
      clients?: number;
      averageTicket?: DecimalLike;
    }>;
  } | null;
  sellerGoals?: {
    summary?: {
      total?: number;
      achieved?: number;
      active?: number;
      upcoming?: number;
      ended?: number;
    };
  } | null;
  clients?: {
    inactivity?: {
      inactivityDays?: number | null;
      alerts?: Array<{
        client?: { id?: string; name?: string; whatsapp?: string };
        lastPurchaseAt?: string;
        daysWithoutPurchase?: number;
      }>;
    };
    topBuyers?: Array<{
      rank?: number;
      purchases?: number;
      totalPurchased?: DecimalLike;
      client?: {
        id?: string;
        name?: string;
        whatsapp?: string;
        segment?: { name?: string } | null;
      };
    }>;
  } | null;
  inventory?: {
    lowStockCount?: number;
    lowStock?: Array<{
      id?: string;
      name?: string;
      sku?: string;
      stock?: {
        quantity?: DecimalLike;
        minimum?: DecimalLike;
      } | null;
    }>;
  } | null;
  finance?: {
    accountsReceivable?: {
      pendingCount?: number;
      pendingAmount?: DecimalLike;
      overdueCount?: number;
      overdueAmount?: DecimalLike;
    };
    cashFlow?: {
      inflow?: DecimalLike;
      outflow?: DecimalLike;
      net?: DecimalLike;
    };
  } | null;
};

function numeric(value: DecimalLike) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: DecimalLike) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(numeric(value));
}

function compactMoney(value: DecimalLike) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numeric(value));
}

function initials(name?: string) {
  if (!name) return "—";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function asISO(date: string, end = false) {
  return new Date(date + (end ? "T23:59:59.999-03:00" : "T00:00:00.000-03:00")).toISOString();
}

async function loadDashboard(start = "", end = "") {
  const params = new URLSearchParams();
  if (start && end) {
    params.set("start", asISO(start));
    params.set("end", asISO(end, true));
  }
  const response = await fetch("/api/dashboard" + (params.size ? "?" + params.toString() : ""), { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error ?? "Não foi possível carregar o dashboard.");
  }
  return payload.dashboard as DashboardData;
}

export function DashboardWorkspace({ userName }: { userName: string }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [applied, setApplied] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (first: string, last: string) => {
    setLoading(true);
    setError(null);
    try {
      const next = await loadDashboard(first, last);
      setDashboard(next);
      setApplied({ start: first, end: last });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh("", ""); }, [refresh]);

  function applyPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (!!start !== !!end) {
      setError("Informe as duas datas ou limpe o filtro para consultar todo o histórico.");
      return;
    }
    if (start && end && end < start) {
      setError("A data final deve ser igual ou posterior à inicial.");
      return;
    }
    void refresh(start, end);
  }

  function clearPeriod() {
    setStart("");
    setEnd("");
    void refresh("", "");
  }

  const periodLabel = applied.start && applied.end
    ? `${new Date(applied.start + "T12:00:00-03:00").toLocaleDateString("pt-BR")} a ${new Date(applied.end + "T12:00:00-03:00").toLocaleDateString("pt-BR")}`
    : "Todo o histórico";

  const sellers = dashboard?.commercial?.sellers ?? [];
  const maxSellerRevenue = Math.max(1, ...sellers.map((seller) => numeric(seller.revenue)));
  const sellerSeries = sellers.slice(0, 5);
  const sellerLinePoints = sellerSeries.length <= 1
    ? "50,50"
    : sellerSeries
        .map((seller, index) => {
          const x = 8 + (index / Math.max(1, sellerSeries.length - 1)) * 84;
          const y = 88 - (numeric(seller.revenue) / maxSellerRevenue) * 64;
          return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ");
  const channels = dashboard?.commercial?.channels ?? {};
  const channelRows = [
    ["WhatsApp", channels.WHATSAPP],
    ["Site", channels.SITE],
    ["Loja física", channels.PHYSICAL_STORE],
  ] as const;
  const channelTotal = Math.max(1, channelRows.reduce((sum, [, item]) => sum + numeric(item?.revenue), 0));
  const whatsappShare = (numeric(channels.WHATSAPP?.revenue) / channelTotal) * 100;
  const siteShare = (numeric(channels.SITE?.revenue) / channelTotal) * 100;

  const donutStyle = useMemo(
    () => ({
      background: `conic-gradient(#987024 0 ${whatsappShare}%, #d3ae61 ${whatsappShare}% ${whatsappShare + siteShare}%, #e9e1d1 ${whatsappShare + siteShare}% 100%)`,
    }),
    [siteShare, whatsappShare],
  );

  const topBuyers = dashboard?.clients?.topBuyers ?? [];
  const inactivity = dashboard?.clients?.inactivity?.alerts ?? [];
  const lowStock = dashboard?.inventory?.lowStock ?? [];

  return (
    <div className="erp-page dashboard-page">
      <header className="erp-page-header stitch-hero">
        <div>
          <p className="erp-kicker">Visão geral da operação</p>
          <h1>Olá, {userName.split(" ")[0]}. Bem-vindo ao seu ERP.</h1>
          <p>Acompanhe clientes, vendas e alertas importantes em uma única visão.</p>
        </div>
        <div className="dashboard-header-actions">
          <form className="dashboard-period-form" onSubmit={applyPeriod} aria-label="Filtrar o dashboard por período">
            <label>De<input type="date" value={start} onChange={(event) => setStart(event.target.value)}
              aria-label="Data inicial" disabled={loading} /></label>
            <label>Até<input type="date" value={end} min={start || undefined}
              onChange={(event) => setEnd(event.target.value)}
              aria-label="Data final" disabled={loading} /></label>
            <button className="secondary-button" type="submit" disabled={loading}>Aplicar</button>
            <button className="text-button" type="button" disabled={loading} onClick={clearPeriod}>Todo o histórico</button>
          </form>
          <span className="stitch-period-pill" aria-live="polite">{periodLabel}</span>
          <a className="primary-button" href="/clients">+ Novo cliente</a>
        </div>
      </header>

      {error && <div className="erp-alert error" role="alert">{error}</div>}

      {!dashboard ? (
        <section className="erp-panel dashboard-loading">Carregando indicadores...</section>
      ) : (
        <>
          <section className="dashboard-metrics" aria-busy={loading}>
            <article className="stitch-metric-card">
              <div className="metric-card-head"><span>Faturamento</span><i>R$</i></div>
              <strong>{money(dashboard.commercial?.revenue)}</strong>
              <div className="metric-card-foot"><small>Vendas efetivamente pagas</small><b>Filtro</b></div>
            </article>
            <article className="stitch-metric-card">
              <div className="metric-card-head"><span>Vendas</span><i>↗</i></div>
              <strong>{dashboard.commercial?.sales ?? 0}</strong>
              <div className="metric-card-foot"><small>Pedidos concluídos</small><b>Período</b></div>
            </article>
            <article className="stitch-metric-card">
              <div className="metric-card-head"><span>Clientes atendidos</span><i>◉</i></div>
              <strong>{dashboard.commercial?.clients ?? 0}</strong>
              <div className="metric-card-foot"><small>Clientes únicos</small><b>Ativos</b></div>
            </article>
            <article className="stitch-metric-card">
              <div className="metric-card-head"><span>Ticket médio</span><i>◇</i></div>
              <strong>{money(dashboard.commercial?.averageTicket)}</strong>
              <div className="metric-card-foot"><small>Por venda concluída</small><b>Média</b></div>
            </article>
            <article className="stitch-metric-card">
              <div className="metric-card-head"><span>Estoque baixo</span><i>!</i></div>
              <strong>{dashboard.inventory?.lowStockCount ?? 0}</strong>
              <div className="metric-card-foot"><small>Estoque atual, independente do período</small><b>Atenção</b></div>
            </article>
            <article className="stitch-metric-card">
              <div className="metric-card-head"><span>Saldo realizado</span><i>↕</i></div>
              <strong>{money(dashboard.finance?.cashFlow?.net)}</strong>
              <div className="metric-card-foot"><small>Entradas menos saídas no período</small><b>Caixa</b></div>
            </article>
          </section>

          <section className="dashboard-grid dashboard-grid-main">
            <article className="erp-panel stitch-panel dashboard-performance">
              <div className="panel-heading">
                <div>
                  <p className="erp-kicker">Performance comercial</p>
                  <h2>Resultado por vendedora</h2>
                </div>
                <span className="status-chip">Faturamento</span>
              </div>

              <div className="dashboard-summary-strip">
                <div>
                  <span>Faturamento total</span>
                  <strong>{money(dashboard.commercial?.revenue)}</strong>
                </div>
                <div>
                  <span>Metas ativas</span>
                  <strong>{dashboard.sellerGoals?.summary?.active ?? 0}</strong>
                </div>
                <div>
                  <span>Metas atingidas</span>
                  <strong>{dashboard.sellerGoals?.summary?.achieved ?? 0}</strong>
                </div>
              </div>

              <div className="seller-chart-shell">
                {sellers.length === 0 ? (
                  <p className="empty-state">Nenhuma venda paga registrada ainda.</p>
                ) : (
                  <>
                    <svg className="seller-line-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                      <polyline points={sellerLinePoints} />
                      {sellerSeries.map((seller, index) => {
                        const x = sellerSeries.length <= 1 ? 50 : 8 + (index / Math.max(1, sellerSeries.length - 1)) * 84;
                        const y = 88 - (numeric(seller.revenue) / maxSellerRevenue) * 64;
                        return <circle key={seller.membershipId ?? index} cx={x} cy={y} r="1.15" />;
                      })}
                    </svg>
                    <div className="seller-bars">
                      {sellerSeries.map((seller, index) => {
                        const height = Math.max(10, (numeric(seller.revenue) / maxSellerRevenue) * 100);
                        return (
                          <div className="seller-bar-column" key={seller.membershipId ?? index}>
                            <div className="seller-bar-value">{compactMoney(seller.revenue)}</div>
                            <div className="seller-bar-track">
                              <span style={{ height: `${height}%` }} />
                            </div>
                            <strong>{seller.sellerName ?? "Vendedora"}</strong>
                            <small>{seller.sales ?? 0} venda(s)</small>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </article>

            <article className="erp-panel stitch-panel channel-panel">
              <div className="panel-heading">
                <div>
                  <p className="erp-kicker">Canais de venda</p>
                  <h2>Origem do faturamento</h2>
                </div>
              </div>
              <div className="channel-donut-wrap">
                <div className="channel-donut" style={donutStyle}>
                  <div>
                    <strong>{dashboard.commercial?.sales ?? 0}</strong>
                    <span>vendas</span>
                  </div>
                </div>
                <div className="channel-legend">
                  {channelRows.map(([label, item], index) => (
                    <div key={label}>
                      <i className={`channel-dot channel-dot-${index + 1}`} />
                      <span>{label}</span>
                      <strong>{money(item?.revenue)}</strong>
                      <small>{item?.sales ?? 0} venda(s)</small>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </section>

          <section className="dashboard-grid dashboard-grid-cards">
            <article className="erp-panel stitch-panel">
              <div className="panel-heading">
                <div>
                  <p className="erp-kicker">Clientes VIP</p>
                  <h2>Maiores compradores</h2>
                </div>
                <a className="text-button" href="/clients">Ver clientes</a>
              </div>
              <div className="dashboard-list">
                {topBuyers.length === 0 ? (
                  <p className="empty-state">O ranking aparecerá após as primeiras vendas pagas.</p>
                ) : topBuyers.slice(0, 4).map((entry, index) => (
                  <div className="dashboard-list-row" key={entry.client?.id ?? index}>
                    <span className="client-avatar">{initials(entry.client?.name)}</span>
                    <div>
                      <strong>{entry.client?.name ?? "Cliente"}</strong>
                      <small>{entry.purchases ?? 0} compra(s) · {entry.client?.segment?.name ?? "Sem grupo"}</small>
                    </div>
                    <b>{money(entry.totalPurchased)}</b>
                  </div>
                ))}
              </div>
            </article>

            <article className="erp-panel stitch-panel">
              <div className="panel-heading">
                <div>
                  <p className="erp-kicker">Relacionamento · Situação atual</p>
                  <h2>Clientes para reativar</h2>
                </div>
                <span className="status-chip warning">{inactivity.length}</span>
              </div>
              <div className="dashboard-list">
                {inactivity.length === 0 ? (
                  <p className="empty-state">Nenhum alerta de inatividade no momento.</p>
                ) : inactivity.slice(0, 4).map((entry, index) => (
                  <div className="dashboard-list-row" key={entry.client?.id ?? index}>
                    <span className="client-avatar muted-avatar">{initials(entry.client?.name)}</span>
                    <div>
                      <strong>{entry.client?.name ?? "Cliente"}</strong>
                      <small>{entry.daysWithoutPurchase ?? 0} dias sem comprar</small>
                    </div>
                    <span className="status-chip warning">Reativar</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="erp-panel stitch-panel attention-panel">
              <div className="panel-heading">
                <div>
                  <p className="erp-kicker">Atenção necessária · Saldos atuais</p>
                  <h2>Pendências da operação</h2>
                </div>
              </div>
              <div className="attention-list">
                <div><span>!</span><p><strong>Estoque baixo</strong><small>{dashboard.inventory?.lowStockCount ?? 0} produto(s) abaixo do mínimo.</small></p></div>
                <div><span>R$</span><p><strong>Contas a receber</strong><small>{money(dashboard.finance?.accountsReceivable?.pendingAmount)} em aberto.</small></p></div>
                <div><span>↻</span><p><strong>Clientes inativos</strong><small>{inactivity.length} cliente(s) aguardando ação comercial.</small></p></div>
              </div>
            </article>
          </section>

          <section className="erp-panel stitch-panel">
            <div className="panel-heading">
              <div>
                <p className="erp-kicker">Visão rápida</p>
                <h2>Produtos com estoque baixo</h2>
              </div>
              <span className="status-chip">{lowStock.length} item(ns)</span>
            </div>
            {lowStock.length === 0 ? (
              <p className="empty-state">Nenhum produto com estoque abaixo do mínimo.</p>
            ) : (
              <div className="client-table-wrap">
                <table className="client-table stitch-table">
                  <thead><tr><th>Produto</th><th>SKU</th><th>Saldo atual</th><th>Mínimo</th><th>Status</th></tr></thead>
                  <tbody>
                    {lowStock.slice(0, 6).map((entry, index) => (
                      <tr key={entry.id ?? index}>
                        <td><strong>{entry.name ?? "Produto"}</strong></td>
                        <td>{entry.sku ?? "—"}</td>
                        <td>{String(entry.stock?.quantity ?? 0)}</td>
                        <td>{String(entry.stock?.minimum ?? 0)}</td>
                        <td><span className="status-chip warning">Repor</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
