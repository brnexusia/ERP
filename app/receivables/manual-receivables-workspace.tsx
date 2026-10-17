"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Client = { id: string; name: string; document: string };
type Receipt = {
  id: string; amount: string; method: string; receivedAt: string;
  note: string | null; recordedBy: { name: string };
};
type Debt = {
  id: string; clientId: string; sourceReference: string;
  description: string; amount: string; dueDate: string; createdAt: string;
  receivedAmount: string; outstandingAmount: string;
  status: "OPEN" | "PARTIAL" | "PAID"; overdue: boolean;
  client: Client; createdBy: { name: string }; receipts: Receipt[];
};

const money = (value: string | number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
const date = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(value));

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store", ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível concluir a operação.");
  return result as T;
}

export function ManualReceivablesWorkspace({ canWrite }: { canWrite: boolean }) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = useRef<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const { receivables } = await fetchJson<{ receivables: Debt[] }>(
      "/api/finance/manual-receivables",
    );
    setDebts(receivables);
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const result = await Promise.all([
          fetchJson<{ receivables: Debt[] }>("/api/finance/manual-receivables"),
          canWrite ? fetchJson<{ clients: Client[] }>("/api/clients")
            : Promise.resolve({ clients: [] as Client[] }),
        ]);
        if (mounted) { setDebts(result[0].receivables); setClients(result[1].clients); }
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : "Falha ao carregar cobranças.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [canWrite]);

  const filtered = debts.filter((item) =>
    (!selectedClient || item.clientId === selectedClient) &&
    (!search.trim() || [item.client.name, item.description, item.sourceReference]
      .some((text) => text.toLowerCase().includes(search.trim().toLowerCase()))));
  const open = debts.filter((item) => item.status !== "PAID");
  const totalOpen = open.reduce((amount, item) => amount + Number(item.outstandingAmount), 0);
  const overdue = open.filter((item) => item.overdue);

  async function createDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const dateValue = String(fields.get("dueDate") ?? "");
    if (!dateValue) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await fetchJson("/api/finance/manual-receivables", {
        method: "POST",
        body: JSON.stringify({
          clientId: String(fields.get("clientId") ?? ""),
          sourceReference: String(fields.get("sourceReference") ?? ""),
          description: String(fields.get("description") ?? ""),
          amount: String(fields.get("amount") ?? ""),
          dueDate: new Date(dateValue + "T12:00:00").toISOString(),
        }),
      });
      await refresh();
      form.reset();
      setShowCreate(false);
      setNotice("Cobrança cadastrada. Ela não gera nova venda ou entrada de caixa.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao cadastrar cobrança.");
    } finally { setBusy(false); }
  }

  async function receive(event: FormEvent<HTMLFormElement>, debt: Debt) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const receivedAt = String(fields.get("receivedAt") ?? "");
    if (!receivedAt || !window.confirm("Confirmar que este dinheiro foi efetivamente recebido?")) return;
    setBusy(true); setError(null); setNotice(null);
    if (!token.current[debt.id]) token.current[debt.id] = crypto.randomUUID();
    try {
      await fetchJson(`/api/finance/manual-receivables/${debt.id}/receipts`, {
        method: "POST",
        body: JSON.stringify({
          method: String(fields.get("method") ?? ""),
          amount: String(fields.get("amount") ?? ""),
          receivedAt: new Date(receivedAt).toISOString(),
          note: String(fields.get("note") ?? "") || null,
          idempotencyKey: token.current[debt.id],
        }),
      });
      delete token.current[debt.id];
      await refresh();
      form.reset();
      setNotice("Recebimento registrado. O saldo da cobrança foi atualizado.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao registrar recebimento.");
    } finally { setBusy(false); }
  }

  return (
    <div className="erp-page manual-receivables-page">
      <header className="erp-page-header">
        <div>
          <p className="erp-kicker">Módulo 2 · Gestão de cobranças</p>
          <h1>Cobranças avulsas</h1>
          <p>Débitos de clientes não vinculados a vendas. Controle de vencimentos e recebimentos parciais.</p>
        </div>
        {canWrite && (
          <button type="button" className="primary-button"
            onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? "Fechar" : "+ Nova cobrança"}
          </button>
        )}
      </header>
      {notice && <p role="status" className="erp-alert success">{notice}</p>}
      {error && <p role="alert" className="erp-alert error">{error}</p>}

      <section className="metric-grid">
        <article className="metric-card"><span>Em aberto</span><strong>{money(totalOpen)}</strong><small>{open.length} cobrança(s) com saldo</small></article>
        <article className="metric-card"><span>Vencidas</span><strong>{overdue.length}</strong><small>Com saldo ainda devido</small></article>
        <article className="metric-card"><span>Quitadas</span><strong>{debts.length - open.length}</strong><small>Recebimentos completos</small></article>
      </section>

      {showCreate && canWrite && (
        <section className="erp-panel stitch-panel">
          <div className="panel-heading"><div><p className="erp-kicker">Novo lançamento</p><h2>Cadastrar débito</h2></div></div>
          <p className="panel-description">
            Use somente para obrigações avulsas. Compras e pedidos devem continuar no módulo de Vendas.
            A referência deve ser única para evitar duplicações.
          </p>
          <form className="manual-debt-form" onSubmit={(event) => {void createDebt(event);}}>
            <label>Cliente
              <select name="clientId" required defaultValue="">
                <option value="">Selecione um cliente...</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name} · {client.document}</option>)}
              </select>
            </label>
            <label>Referência da cobrança
              <input name="sourceReference" required minLength={4} maxLength={80}
                placeholder="Ex.: AJUSTE-2026-001" />
            </label>
            <label>Valor original (R$)
              <input name="amount" type="number" required min=".01" step=".01" placeholder="0,00" />
            </label>
            <label>Vencimento
              <input name="dueDate" type="date" required />
            </label>
            <label className="manual-debt-reason">Motivo / descrição
              <input name="description" required minLength={5} maxLength={500}
                placeholder="Descreva claramente a origem do débito" />
            </label>
            <button type="submit" className="primary-button" disabled={busy || clients.length === 0}>
              {busy ? "Aguarde..." : "Cadastrar cobrança"}
            </button>
          </form>
        </section>
      )}

      <section className="erp-panel stitch-panel">
        <div className="manual-debt-toolbar">
          <div><p className="erp-kicker">Carteira de cobrança</p><h2>Débitos registrados</h2></div>
          <label className="search-field"><span aria-hidden="true">⌕</span>
            <input aria-label="Buscar cobranças" placeholder="Cliente, referência ou motivo..."
              value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label className="manual-debt-filter">Cliente
            <select value={selectedClient} onChange={(event) => setSelectedClient(event.target.value)}>
              <option value="">Todos</option>
              {[...new Map(debts.map((debt) => [debt.client.id, debt.client])).values()]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
        </div>
        {loading && <p className="empty-state">Carregando...</p>}
        {!loading && filtered.length === 0 && <p className="empty-state">Nenhuma cobrança encontrada.</p>}
        <div className="manual-debt-list">
          {filtered.map((debt) => (
            <article className="manual-debt-card" key={debt.id}>
              <div className="manual-debt-head">
                <div>
                  <strong>{debt.client.name}</strong>
                  <small>{debt.sourceReference} · {debt.description}</small>
                </div>
                <span className={"status-chip " + (debt.status === "PAID" ? "success" : debt.overdue ? "warning" : "")}>
                  {debt.status === "PAID" ? "Quitada" : debt.overdue ? "Vencida" : debt.status === "PARTIAL" ? "Parcial" : "Aberta"}
                </span>
              </div>
              <div className="manual-debt-amounts">
                <div><span>Original</span><strong>{money(debt.amount)}</strong></div>
                <div><span>Recebido</span><strong>{money(debt.receivedAmount)}</strong></div>
                <div><span>Em aberto</span><strong>{money(debt.outstandingAmount)}</strong></div>
                <div><span>Vencimento</span><strong>{date(debt.dueDate)}</strong></div>
              </div>
              {debt.receipts.length > 0 && (
                <div className="manual-debt-history">
                  <strong>Histórico de recebimentos</strong>
                  {debt.receipts.map((receipt) => (
                    <small key={receipt.id}>
                      {date(receipt.receivedAt)} · {receipt.method} · {money(receipt.amount)}
                      {" · "}{receipt.recordedBy.name}
                    </small>
                  ))}
                </div>
              )}
              {canWrite && debt.status !== "PAID" && (
                <form className="manual-debt-receipt" onSubmit={(event) => {void receive(event, debt);}}>
                  <label>Valor recebido
                    <input type="number" name="amount" step=".01" min=".01" max={debt.outstandingAmount}
                      required placeholder="R$" />
                  </label>
                  <label>Forma
                    <select name="method" defaultValue="PIX">
                      <option value="PIX">Pix</option><option value="CASH">Dinheiro</option>
                      <option value="CARD">Cartão</option><option value="TRANSFER">Transferência</option>
                    </select>
                  </label>
                  <label>Data do recebimento
                    <input name="receivedAt" type="datetime-local" required />
                  </label>
                  <label>Observação (opcional)
                    <input name="note" maxLength={500} />
                  </label>
                  <button className="secondary-button" type="submit" disabled={busy}>
                    Registrar baixa
                  </button>
                </form>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
