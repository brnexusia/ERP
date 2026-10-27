"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import styles from "./finance.module.css";

type Payable = {
  id: string; description: string; amount: string; dueDate: string; paidAt: string | null;
  status: "PENDING" | "PAID"; overdue: boolean; reconciledAmount: string;
};
type Receivable = {
  id: string; amount: string; dueDate: string | null; settledAt: string | null;
  method: string; status: "PENDING" | "PAID"; overdue: boolean; reconciledAmount: string;
  chequeReturn?: { id: string } | null;
  sale: { client: { name: string }; id: string };
};
type BankEntry = {
  id: string; description: string; reference: string | null; amount: string;
  direction: "CREDIT" | "DEBIT"; occurredAt: string; reconciledAmount: string;
  remainingAmount: string; fullyReconciled: boolean;
  reconciliations: Array<{ id: string; amount: string; note: string | null;
    salePayment: { sale: { client: { name: string } } } | null;
    accountPayable: { description: string } | null }>;
};
type Report = {
  accountsReceivable: { pendingCount: number; pendingAmount: string; overdueAmount: string };
  accountsPayable: { pendingCount: number; pendingAmount: string; overdueAmount: string };
  cashFlow: { inflow: string; outflow: string; net: string };
  bankReconciliation: { bankEntryCount: number; reconciliationCount: number; reconciledAmount: string };
};
type CashFlow = {
  totals: { inflow: string; outflow: string; net: string };
  entries: Array<{ sourceId: string; direction: "INFLOW" | "OUTFLOW"; amount: string; description: string; occurredAt: string | null }>;
};
const currency = (amount: string | number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(amount ?? 0));
const date = (value: string | null) =>
  value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
const iso = (value: string) => {
  if (!value) throw new Error("Informe a data e hora.");
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("Data e hora inválidas.");
  return parsed.toISOString();
};
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store", ...init,
    headers: {
      ...(typeof init?.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Falha na operação financeira.");
  return body as T;
}

export function FinanceWorkspace({ canWrite }: { canWrite: boolean }) {
  const [report, setReport] = useState<Report | null>(null);
  const [cash, setCash] = useState<CashFlow | null>(null);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [entries, setEntries] = useState<BankEntry[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [payableForm, setPayableForm] = useState({ description: "", amount: "", dueDate: "" });
  const [entryForm, setEntryForm] = useState({ direction: "CREDIT" as "CREDIT" | "DEBIT", amount: "", occurredAt: "", description: "", reference: "" });
  const [bankId, setBankId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [reconcileForm, setReconcileForm] = useState({ amount: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (period: { from: string; to: string }) => {
    const params = new URLSearchParams();
    if (period.from) params.set("from", iso(period.from));
    if (period.to) params.set("to", iso(period.to));
    const query = params.toString();
    const [reportResult, cashResult, payableResult, receivableResult, bankResult] = await Promise.all([
      request<{ report: Report }>(`/api/finance/reports${query ? `?${query}` : ""}`),
      request<{ cashFlow: CashFlow }>(`/api/finance/cash-flow${query ? `?${query}` : ""}`),
      request<{ payables: Payable[] }>("/api/finance/payables"),
      request<{ receivables: Receivable[] }>("/api/finance/receivables"),
      request<{ entries: BankEntry[] }>("/api/finance/bank-entries"),
    ]);
    setReport(reportResult.report); setCash(cashResult.cashFlow);
    setPayables(payableResult.payables); setReceivables(receivableResult.receivables);
    setEntries(bankResult.entries);
  }, []);

  useEffect(() => {
    let mounted = true;
    void load(selectedPeriod).catch((cause: unknown) => {
      if (mounted) setError(cause instanceof Error ? cause.message : "Falha ao carregar financeiro.");
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [load, selectedPeriod]);

  async function mutate(action: () => Promise<unknown>, success: string) {
    if (busy || !canWrite) return;
    setBusy(true); setError(null); setNotice(null);
    try { await action(); await load(selectedPeriod); setNotice(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar."); }
    finally { setBusy(false); }
  }

  async function addPayable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate(async () => {
      await request("/api/finance/payables", { method: "POST", body: JSON.stringify({
        description: payableForm.description, amount: payableForm.amount, dueDate: iso(payableForm.dueDate),
      }) });
      setPayableForm({ description: "", amount: "", dueDate: "" });
    }, "Conta a pagar criada.");
  }

  async function settle(id: string) {
    if (!window.confirm("Confirma o registro de pagamento desta conta?")) return;
    await mutate(() => request(`/api/finance/payables/${id}/settle`, { method: "POST" }), "Conta marcada como paga.");
  }

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate(async () => {
      await request("/api/finance/bank-entries", { method: "POST", body: JSON.stringify({
        ...entryForm, reference: entryForm.reference || null, occurredAt: iso(entryForm.occurredAt),
      }) });
      setEntryForm({ direction: "CREDIT", amount: "", occurredAt: "", description: "", reference: "" });
    }, "Lançamento bancário registrado.");
  }

  const selectedBank = entries.find((entry) => entry.id === bankId) ?? null;
  const targets = selectedBank?.direction === "CREDIT"
    ? receivables.filter((row) => row.status === "PAID" && row.method !== "VALE" && !row.chequeReturn && row.settledAt)
      .map((row) => ({ id: row.id, label: `${row.sale.client.name} · ${currency(row.amount)} · ${row.method}` }))
    : payables.filter((row) => row.status === "PAID" && row.paidAt)
      .map((row) => ({ id: row.id, label: `${row.description} · ${currency(row.amount)}` }));

  async function reconcile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBank || !targetId) return;
    await mutate(async () => {
      await request(`/api/finance/bank-entries/${selectedBank.id}/reconcile`, {
        method: "POST", body: JSON.stringify({
          ...(selectedBank.direction === "CREDIT" ? { salePaymentId: targetId } : { accountPayableId: targetId }),
          amount: reconcileForm.amount, note: reconcileForm.note || null,
        }),
      });
      setTargetId(""); setReconcileForm({ amount: "", note: "" });
    }, "Conciliação manual registrada.");
  }

  return (
    <div className="erp-page">
      <header className="erp-page-header stitch-hero">
        <div><p className="erp-kicker">Administração · Financeiro</p>
          <h1>Financeiro</h1>
          <p>Contas, recebimentos, saídas, caixa realizado e conciliação bancária manual.</p>
        </div>
      </header>
      {error && <div className="erp-alert error" role="alert">{error}</div>}
      {notice && <div className="erp-alert success" role="status">{notice}</div>}
      <section className="erp-panel">
        <div className="panel-heading"><h2>Período de análise</h2></div>
        <form className={styles.gridForm} onSubmit={(event) => {
          event.preventDefault();
          if (from && to && new Date(from) > new Date(to)) { setError("Início deve ser anterior ou igual ao fim."); return; }
          setError(null); setSelectedPeriod({ from, to });
        }}>
          <label>De<input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>Até<input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <button type="submit" className="secondary-button">Aplicar período</button>
          <button type="button" className="text-button" onClick={() => { setFrom(""); setTo(""); setSelectedPeriod({ from: "", to: "" }); }}>Todos os períodos</button>
        </form>
      </section>
      {loading && <p className="empty-state">Carregando dados financeiros...</p>}
      {report && <div className="metric-grid">
        <div className="metric-card"><span>Recebimentos realizados</span><strong>{currency(report.cashFlow.inflow)}</strong></div>
        <div className="metric-card"><span>Pagamentos realizados</span><strong>{currency(report.cashFlow.outflow)}</strong></div>
        <div className="metric-card"><span>Saldo realizado</span><strong>{currency(report.cashFlow.net)}</strong></div>
        <div className="metric-card"><span>Contas pendentes a receber</span><strong>{currency(report.accountsReceivable.pendingAmount)}</strong><small>{report.accountsReceivable.pendingCount} registros</small></div>
      </div>}
      {report && <div className={styles.summary}>
        <div className="erp-panel"><span>A receber em atraso</span><strong>{currency(report.accountsReceivable.overdueAmount)}</strong></div>
        <div className="erp-panel"><span>A pagar pendente</span><strong>{currency(report.accountsPayable.pendingAmount)}</strong></div>
        <div className="erp-panel"><span>A pagar em atraso</span><strong>{currency(report.accountsPayable.overdueAmount)}</strong></div>
        <div className="erp-panel"><span>Conciliações</span><strong>{report.bankReconciliation.reconciliationCount}</strong></div>
      </div>}

      <section className="erp-panel">
        <div className="panel-heading"><h2>Contas a receber</h2><Link href="/receivables" className="text-button">Cobranças avulsas</Link></div>
        <div className="client-table-wrap"><table className="client-table"><thead><tr><th>Cliente</th><th>Valor</th><th>Forma</th><th>Vencimento</th><th>Situação</th></tr></thead>
          <tbody>{receivables.map((r) => <tr key={r.id}><td>{r.sale.client.name}</td>
            <td>{currency(r.amount)}</td><td>{r.method}</td><td>{date(r.dueDate)}</td>
            <td><span className={`status-chip ${r.overdue ? "warning" : r.status === "PAID" ? "success" : ""}`}>{r.overdue ? "Vencido" : r.status === "PAID" ? "Pago" : "Pendente"}</span></td>
          </tr>)}</tbody></table>{receivables.length === 0 && <p className="empty-state">Sem contas a receber.</p>}
        </div>
      </section>

      <section className="erp-panel">
        <div className="panel-heading"><h2>Contas a pagar</h2></div>
        {canWrite && <form className={styles.gridForm} onSubmit={(event) => void addPayable(event)}>
          <label>Descrição<input required maxLength={500} value={payableForm.description} onChange={(event) => setPayableForm((s) => ({ ...s, description: event.target.value }))} /></label>
          <label>Valor (R$)<input required inputMode="decimal" value={payableForm.amount} onChange={(event) => setPayableForm((s) => ({ ...s, amount: event.target.value }))} /></label>
          <label>Vencimento<input required type="datetime-local" value={payableForm.dueDate} onChange={(event) => setPayableForm((s) => ({ ...s, dueDate: event.target.value }))} /></label>
          <button type="submit" className="primary-button" disabled={busy}>Criar conta</button>
        </form>}
        <div className="client-table-wrap"><table className="client-table"><thead><tr><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody>{payables.map((row) => <tr key={row.id}><td>{row.description}</td>
            <td>{currency(row.amount)}</td><td>{date(row.dueDate)}</td>
            <td><span className={`status-chip ${row.overdue ? "warning" : row.status === "PAID" ? "success" : ""}`}>{row.status === "PAID" ? "Pago" : row.overdue ? "Vencido" : "Pendente"}</span></td>
            <td>{canWrite && row.status !== "PAID" ? <button type="button" className="table-action" disabled={busy} onClick={() => void settle(row.id)}>Marcar pago</button> : "—"}</td></tr>)}</tbody>
        </table>{payables.length === 0 && <p className="empty-state">Sem contas a pagar.</p>}</div>
      </section>

      <section className="erp-panel">
        <div className="panel-heading"><h2>Fluxo de caixa realizado</h2></div>
        <p className={styles.hint}>Somente entradas recebidas e saídas efetivadas. Lançamentos bancários não duplicam o caixa.</p>
        <div className="client-table-wrap"><table className="client-table"><thead><tr><th>Data</th><th>Origem</th><th>Movimento</th><th>Valor</th></tr></thead>
          <tbody>{cash?.entries.map((row) => <tr key={`${row.sourceId}-${row.direction}`}>
            <td>{date(row.occurredAt)}</td><td>{row.description}</td>
            <td>{row.direction === "INFLOW" ? "Entrada" : "Saída"}</td>
            <td>{currency(row.amount)}</td></tr>)}</tbody>
        </table>{!cash?.entries.length && <p className="empty-state">Sem movimentações realizadas neste período.</p>}</div>
      </section>

      <section className="erp-panel">
        <div className="panel-heading"><h2>Conciliação bancária manual</h2></div>
        <p className={styles.hint}>Registre extrato e associe explicitamente valores a recebimentos pagos ou contas quitadas. Sem integração bancária automática.</p>
        {canWrite && <form className={styles.gridForm} onSubmit={(event) => void addEntry(event)}>
          <label>Natureza<select value={entryForm.direction} onChange={(event) => setEntryForm((s) => ({ ...s, direction: event.target.value as "CREDIT" | "DEBIT" }))}>
            <option value="CREDIT">Crédito (entrada)</option><option value="DEBIT">Débito (saída)</option></select></label>
          <label>Valor (R$)<input required inputMode="decimal" value={entryForm.amount} onChange={(event) => setEntryForm((s) => ({ ...s, amount: event.target.value }))} /></label>
          <label>Ocorrido em<input required type="datetime-local" value={entryForm.occurredAt} onChange={(event) => setEntryForm((s) => ({ ...s, occurredAt: event.target.value }))} /></label>
          <label>Descrição<input required maxLength={500} value={entryForm.description} onChange={(event) => setEntryForm((s) => ({ ...s, description: event.target.value }))} /></label>
          <label>Referência<input maxLength={200} value={entryForm.reference} onChange={(event) => setEntryForm((s) => ({ ...s, reference: event.target.value }))} /></label>
          <button className="primary-button" disabled={busy} type="submit">Adicionar lançamento</button>
        </form>}
        <div className="client-table-wrap"><table className="client-table"><thead><tr><th>Data</th><th>Lançamento</th><th>Valor</th><th>Conciliado</th><th>Restante</th><th>Ação</th></tr></thead>
          <tbody>{entries.map((row) => <tr key={row.id}>
            <td>{date(row.occurredAt)}</td><td>{row.description}<small>{row.direction === "CREDIT" ? "Crédito" : "Débito"} · {row.reference || "Sem referência"}</small></td>
            <td>{currency(row.amount)}</td><td>{currency(row.reconciledAmount)}</td><td>{currency(row.remainingAmount)}</td>
            <td>{canWrite && !row.fullyReconciled ? <button className="table-action" type="button" onClick={() => { setBankId(row.id); setTargetId(""); setReconcileForm({ amount: row.remainingAmount, note: "" }); }}>Conciliar</button> : "—"}</td>
          </tr>)}</tbody></table>{entries.length === 0 && <p className="empty-state">Nenhum lançamento registrado.</p>}</div>
        {canWrite && selectedBank && !selectedBank.fullyReconciled && <form className={styles.reconcile} onSubmit={(event) => void reconcile(event)}>
          <h3>Conciliação · {selectedBank.description}</h3>
          <p className={styles.hint}>Restante do lançamento: {currency(selectedBank.remainingAmount)}. O servidor valida limites e a empresa de origem.</p>
          <label>Registro de origem<select required value={targetId} onChange={(event) => setTargetId(event.target.value)}>
            <option value="">Selecione uma origem quitada</option>
            {targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
          </select></label>
          <label>Valor a conciliar<input required inputMode="decimal" value={reconcileForm.amount} onChange={(event) => setReconcileForm((s) => ({ ...s, amount: event.target.value }))} /></label>
          <label>Observação<input maxLength={500} value={reconcileForm.note} onChange={(event) => setReconcileForm((s) => ({ ...s, note: event.target.value }))} /></label>
          <div className={styles.actions}>
            <button className="secondary-button" type="button" onClick={() => setBankId("")}>Cancelar</button>
            <button className="primary-button" type="submit" disabled={busy || !targetId}>Confirmar conciliação</button>
          </div>
        </form>}
      </section>
    </div>
  );
}
