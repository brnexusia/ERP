"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CommissionAdjustmentPanel } from "@/app/commissions/commission-adjustment-panel";

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

type Closing = {
  id: string;
  kind: "SELLER" | "REPRESENTATIVE";
  sourceId: string;
  month: string;
  beneficiaryName: string;
  amount: string;
  dueDate: string;
  approvedAt: string;
  approvedBy: { name: string };
  payableId: string;
  payable: { status: "PENDING" | "PAID"; paidAt: string | null; amount: string };
  adjustments: Array<{ id: string }>;
};
export function CommissionsWorkspace({
  canManage, canSettle,
}: { canManage: boolean; canSettle: boolean }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<Report | null>(null);
  const [closings, setClosings] = useState<Closing[]>([]);
  const [correctionClosingId, setCorrectionClosingId] = useState<string | null>(null);
  const [busyClosing, setBusyClosing] = useState<string | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportPayload, sellerPayload, closingPayload] = await Promise.all([
        getJson<{ report: Report }>(`/api/commissions?month=${encodeURIComponent(month)}`),
        canManage
          ? getJson<{ sellers: Seller[] }>("/api/sellers")
          : Promise.resolve({ sellers: [] as Seller[] }),
        getJson<{ closings: Closing[] }>(`/api/commissions/closings?month=${encodeURIComponent(month)}`),
      ]);
      setReport(reportPayload.report);
      setSellers(sellerPayload.sellers);
      setClosings(closingPayload.closings);
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

  const closedMonth = /^20\d{2}-(0[1-9]|1[0-2])$/.test(month) &&
    new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1, 3)) <= new Date();
  const closingFor = (kind: Closing["kind"], sourceId: string) =>
    closings.find((closing) => closing.kind === kind && closing.sourceId === sourceId);

  async function approveClosing(kind: Closing["kind"], sourceId: string, label: string, amount: string) {
    if (!canManage || busyClosing || !closedMonth) return;
    if (!window.confirm(
      `Fechar definitivamente a comissão de ${label} (${money(amount)})? Isso criará uma conta a pagar. O valor não será recalculado depois.`,
    )) return;
    setBusyClosing(sourceId);
    setError(null);
    setNotice(null);
    try {
      await getJson("/api/commissions/closings", {
        method: "POST", body: JSON.stringify({ month, kind, sourceId }),
      });
      setNotice("Fechamento aprovado e conta a pagar criada. O pagamento permanece pendente até confirmação financeira.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao fechar comissão.");
    } finally { setBusyClosing(null); }
  }

  async function markPaid(closing: Closing) {
    if (!canSettle || busyClosing || closing.payable.status !== "PENDING") return;
    if (!window.confirm(
      `Confirmar que ${money(closing.amount)} já foram efetivamente pagos para ${closing.beneficiaryName}? O ERP só registrará a baixa; não fará transferência bancária.`,
    )) return;
    setBusyClosing(closing.sourceId);
    setError(null);
    setNotice(null);
    try {
      await getJson(`/api/finance/payables/${closing.payableId}/settle`, { method: "POST" });
      setNotice("Conta a pagar marcada como quitada. Nenhuma transferência foi iniciada.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao registrar quitação.");
    } finally { setBusyClosing(null); }
  }

  function closingActions(kind: Closing["kind"], sourceId: string, name: string, amount: string) {
    const closing = closingFor(kind, sourceId);
    if (closing) return (
      <div className="commission-closing-actions">
        <span className={"status-chip " + (closing.payable.status === "PAID" ? "success" : "warning")}>
          {closing.payable.status === "PAID" ? "Pago" : "A pagar"}
        </span>
        <small title={`Aprovado por ${closing.approvedBy.name}`}>Aprovado: {closing.approvedBy.name}</small>
        <strong className="commission-current-payable">{money(closing.payable.amount)}</strong>
        {closing.adjustments.length > 0 && <span className="status-chip warning">Correção pendente</span>}
        <button className="secondary-button" type="button"
          onClick={() => setCorrectionClosingId((old) => old === closing.id ? null : closing.id)}>
          {correctionClosingId === closing.id ? "Fechar ajustes" : "Correções"}
        </button>
        {closing.payable.status === "PENDING" && canSettle && !closing.adjustments.length && (
          <button className="secondary-button" type="button" disabled={Boolean(busyClosing)}
            onClick={() => { void markPaid(closing); }}>Marcar pago</button>
        )}
      </div>
    );
    if (canManage && closedMonth && Number(amount) > 0) return (
      <button className="secondary-button" type="button" disabled={Boolean(busyClosing)}
        onClick={() => { void approveClosing(kind, sourceId, name, amount); }}>
        {busyClosing === sourceId ? "Aguarde..." : "Aprovar fechamento"}
      </button>
    );
    return <span className="commission-pending-label">{closedMonth ? "Sem valor para fechar" : "Competência aberta"}</span>;
  }

  return (
    <div className="erp-page commissions-page">
      <header className="erp-page-header">
        <div>
          <p className="erp-kicker">Etapa 2 · Gestão comercial</p>
          <h1>Demonstrativo de comissões</h1>
          <p>Prévia, aprovação do fechamento e quitação financeira: vendedoras por mês e representantes por parcela.</p>
        </div>
        <label className="commission-month-label">
          Competência
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </header>
      <div className="erp-alert neutral">
        As comissões começam como prévia. Depois de encerrada a competência, a gestão pode aprovar
        cada fechamento para gerar uma conta a pagar. A confirmação do pagamento é manual e não transfere dinheiro.
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

      {correctionClosingId && closings.some((row) => row.id === correctionClosingId) && (
        <section className="erp-panel stitch-panel commission-adjustment-section">
          <div className="panel-heading">
            <div><p className="erp-kicker">Auditoria financeira · Módulo 2</p>
              <h2>Correções autorizadas</h2>
            </div>
            <button type="button" className="secondary-button"
              onClick={() => setCorrectionClosingId(null)}>Fechar</button>
          </div>
          <CommissionAdjustmentPanel
            key={correctionClosingId}
            closingId={correctionClosingId}
            onChanged={load}
          />
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
            <thead><tr><th>Vendedora</th><th>Vendas</th><th>Faturamento</th><th>Comissão</th><th>Vencimento</th><th>Fechamento</th></tr></thead>
            <tbody>
              {report?.sellers.map((group) => (
                <tr key={group.sellerMembershipId}>
                  <td><strong>{group.sellerName}</strong></td>
                  <td>{group.sales.length}</td>
                  <td>{money(group.grossSold)}</td>
                  <td><strong>{money(group.commission)}</strong></td>
                  <td>{formattedDate(report.period.sellerDueDate)}</td>
                  <td>{closingActions("SELLER", group.sellerMembershipId, group.sellerName, group.commission)}</td>
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
            <thead><tr><th>Representante</th><th>Cliente</th><th>Forma</th><th>Vencimento</th><th>Parcela</th><th>Taxa</th><th>Comissão</th><th>Fechamento</th></tr></thead>
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
                    <td>{closingActions("REPRESENTATIVE", payment.paymentId, group.representativeName, payment.commission)}</td>
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
