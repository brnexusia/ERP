"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type SellerLine = {
  saleId: string;
  orderedAt: string | null;
  amount: string;
  rate: string | null;
  commission: string;
};
type SellerGroup = {
  sellerMembershipId: string;
  sellerName: string;
  grossSold: string;
  commission: string;
  sales: SellerLine[];
};
type RepresentativeGroup = {
  representativeId: string;
  representativeName: string;
  commission: string;
  payments: Array<{
    saleId: string;
    paymentId: string;
    clientName: string;
    dueDate: string | null;
    method: string;
    paymentAmount: string;
    rate: string;
    commission: string;
    status: string;
  }>;
};
type Report = {
  period: { month: string; sellerDueDate: string; timeZone: string };
  sellers: SellerGroup[];
  representatives: RepresentativeGroup[];
  totals: { seller: string; representative: string };
  note: string;
};
type Seller = {
  id: string;
  user: { name: string };
  commissionPercent?: string | null;
};

function money(amount: string | number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(Number(amount ?? 0));
}

function formattedDate(date: string | null) {
  return date ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" })
    .format(new Date(date)) : "—";
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error ?? "Não foi possível carregar os dados.");
  return result as T;
}

export function CommissionsWorkspace({ canManage }: { canManage: boolean }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<Report | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportPayload, sellerPayload] = await Promise.all([
        getJson<{ report: Report }>(`/api/commissions?month=${encodeURIComponent(month)}`),
        canManage
          ? getJson<{ sellers: Seller[] }>("/api/sellers")
          : Promise.resolve({ sellers: [] as Seller[] }),
      ]);
      setReport(reportPayload.report);
      setSellers(sellerPayload.sellers);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar comissões.");
    } finally {
      setLoading(false);
    }
  }, [canManage, month]);

  useEffect(() => { void load(); }, [load]);

  async function updateRate(event: FormEvent<HTMLFormElement>, sellerId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const raw = String(form.get("percent") ?? "").trim();
    setSavingId(sellerId);
    setError(null);
    setNotice(null);
    try {
      await getJson(`/api/sellers/${sellerId}/commission`, {
        method: "PATCH",
        body: JSON.stringify({ percent: raw ? raw.replace(",", ".") : null }),
      });
      setNotice("Percentual atualizado. Será aplicado aos novos pedidos confirmados.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao atualizar percentual.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="erp-page commissions-page">
      <header className="erp-page-header">
        <div>
          <p className="erp-kicker">Etapa 2 · Gestão comercial</p>
          <h1>Demonstrativo de comissões</h1>
          <p>Prévia para conferência: vendedoras por mês e representantes por vencimento da parcela.</p>
        </div>
        <label className="commission-month-label">
          Competência
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </header>
      <div className="erp-alert neutral">
        Esta é uma prévia calculada com os percentuais registrados nas vendas.
        Não gera pagamentos ou contas a pagar automaticamente.
      </div>
      {notice && <div className="erp-alert success">{notice}</div>}
      {error && <div className="erp-alert error">{error}</div>}
      {loading && <p className="empty-state">Atualizando dados...</p>}

      <section className="metric-grid">
        <article className="metric-card">
          <span>Comissões de vendedoras</span>
          <strong>{money(report?.totals.seller)}</strong>
          <small>Vencimento: {formattedDate(report?.period.sellerDueDate ?? null)}</small>
        </article>
        <article className="metric-card">
          <span>Comissões de representantes</span>
          <strong>{money(report?.totals.representative)}</strong>
          <small>Por parcela com vencimento nesta competência</small>
        </article>
        <article className="metric-card">
          <span>Vendedoras com vendas</span>
          <strong>{report?.sellers.length ?? 0}</strong>
          <small>Somente pedidos confirmados, sem orçamentos</small>
        </article>
        <article className="metric-card">
          <span>Representantes com parcelas</span>
          <strong>{report?.representatives.length ?? 0}</strong>
          <small>Cheques, boletos e vales programados</small>
        </article>
      </section>

      {canManage && (
        <section className="erp-panel stitch-panel">
          <div className="panel-heading">
            <div>
              <p className="erp-kicker">Configuração</p>
              <h2>Percentual por vendedora</h2>
            </div>
          </div>
          <p className="panel-description">
            Deixe o percentual vazio para não gerar comissão. A alteração não recalcula pedidos já confirmados.
          </p>
          <div className="commission-seller-settings">
            {sellers.map((seller) => (
              <form key={seller.id} onSubmit={(event) => { void updateRate(event, seller.id); }}>
                <strong>{seller.user.name}</strong>
                <label>
                  Taxa (%)
                  <input type="number" name="percent" min={0} max={100} step=".01"
                    defaultValue={seller.commissionPercent ?? ""} placeholder="Sem comissão" />
                </label>
                <button className="secondary-button" disabled={savingId === seller.id}>
                  {savingId === seller.id ? "Salvando..." : "Salvar"}
                </button>
              </form>
            ))}
            {sellers.length === 0 && <p className="empty-state">Nenhuma vendedora ativa.</p>}
          </div>
        </section>
      )}

      <section className="erp-panel stitch-panel">
        <div className="panel-heading">
          <div>
            <p className="erp-kicker">Fechamento mensal</p>
            <h2>Comissões das vendedoras</h2>
          </div>
          <span className="status-chip">Prévia</span>
        </div>
        <div className="client-table-wrap">
          <table className="client-table">
            <thead><tr><th>Vendedora</th><th>Vendas</th><th>Faturamento</th><th>Comissão</th><th>Vencimento</th></tr></thead>
            <tbody>
              {report?.sellers.map((group) => (
                <tr key={group.sellerMembershipId}>
                  <td><strong>{group.sellerName}</strong></td>
                  <td>{group.sales.length}</td>
                  <td>{money(group.grossSold)}</td>
                  <td><strong>{money(group.commission)}</strong></td>
                  <td>{formattedDate(report.period.sellerDueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!report?.sellers.length && <p className="empty-state">Nenhuma venda confirmada nessa competência.</p>}
        </div>
      </section>

      <section className="erp-panel stitch-panel">
        <div className="panel-heading">
          <div>
            <p className="erp-kicker">Por vencimento</p>
            <h2>Parcelas e comissões dos representantes</h2>
          </div>
        </div>
        <div className="client-table-wrap">
          <table className="client-table">
            <thead><tr><th>Representante</th><th>Cliente</th><th>Forma</th><th>Vencimento</th><th>Parcela</th><th>Taxa</th><th>Comissão</th></tr></thead>
            <tbody>
              {report?.representatives.flatMap((group) =>
                group.payments.map((payment) => (
                  <tr key={payment.paymentId}>
                    <td><strong>{group.representativeName}</strong></td>
                    <td>{payment.clientName}</td>
                    <td>{payment.method}</td>
                    <td>{formattedDate(payment.dueDate)}</td>
                    <td>{money(payment.paymentAmount)}</td>
                    <td>{payment.rate}%</td>
                    <td><strong>{money(payment.commission)}</strong></td>
                  </tr>
                )))}
            </tbody>
          </table>
          {!report?.representatives.length && (
            <p className="empty-state">Nenhuma parcela com vencimento nessa competência.</p>
          )}
        </div>
      </section>
    </div>
  );
}
