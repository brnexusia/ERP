"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Kind = "ATTENDANCE" | "AFTER_SALES" | "COMPLAINT" | "SAC";
type RecordRow = {
  id: string; kind: Kind; content: string; createdAt: string;
  clientId: string; saleId: string | null;
  client: { id: string; name: string; whatsapp: string };
  createdBy: { id: string; name: string };
  sale: { id: string; stage: string } | null;
};
type Client = { id: string; name: string };
type Sale = { id: string; clientId: string; stage: string };
type History = { records: RecordRow[]; total: number; page: number; pages: number; pageSize: number };
const kinds: Record<Kind, string> = {
  ATTENDANCE: "Atendimento",
  AFTER_SALES: "Pós-venda",
  COMPLAINT: "Reclamação",
  SAC: "SAC",
};
async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store", ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(
    typeof data.error === "string" ? data.error : "Não foi possível completar a operação.",
  );
  return data as T;
}
export function SupportWorkspace({ canWrite }: { canWrite: boolean }) {
  const [history, setHistory] = useState<History | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [clientId, setClientId] = useState("");
  const [saleId, setSaleId] = useState("");
  const [kind, setKind] = useState<Kind>("ATTENDANCE");
  const [selectedKind, setSelectedKind] = useState("");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (selectedKind) params.set("kind", selectedKind);
    if (appliedQuery) params.set("search", appliedQuery);
    return json<History>("/api/support?" + params.toString());
  }, [page, selectedKind, appliedQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setHistory(await fetchHistory()); }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível consultar o histórico.");
    } finally { setLoading(false); }
  }, [fetchHistory]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!canWrite) return;
    let mounted = true;
    void Promise.all([
      json<{ clients: Client[] }>("/api/clients"),
      json<{ sales: Sale[] }>("/api/sales"),
    ]).then(([customers, orders]) => {
      if (mounted) { setClients(customers.clients); setSales(orders.sales); }
    }).catch((reason) => {
      if (mounted) setError(reason instanceof Error ? reason.message : "Falha ao carregar cadastros.");
    });
    return () => { mounted = false; };
  }, [canWrite]);

  const relatedSales = useMemo(() => sales.filter((item) => item.clientId === clientId), [sales, clientId]);
  const date = (value: string) => new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(new Date(value));

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null); setNotice(null); setBusy(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      if (!clientId) throw new Error("Selecione um cliente.");
      await json(`/api/clients/${clientId}/support`, {
        method: "POST",
        body: JSON.stringify({
          kind, saleId: saleId || null,
          content: String(data.get("content") ?? "").trim(),
        }),
      });
      form.reset(); setSaleId(""); setKind("ATTENDANCE");
      setShowCreate(false); setPage(1);
      const params = new URLSearchParams({ page: "1" });
      if (selectedKind) params.set("kind", selectedKind);
      if (appliedQuery) params.set("search", appliedQuery);
      setHistory(await json<History>("/api/support?" + params.toString()));
      setNotice("Atendimento registrado no histórico do cliente.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível registrar.");
    } finally { setBusy(false); }
  }

  return (
    <div className="erp-page support-page">
      <header className="erp-page-header">
        <div>
          <p className="erp-kicker">Operação comercial · Módulo 2</p>
          <h1>Atendimento & SAC</h1>
          <p>Histórico de atendimento, reclamações e pós-venda, relacionado aos clientes e pedidos.</p>
        </div>
        {canWrite && (
          <button className="primary-button" type="button"
            onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? "Fechar" : "+ Registrar atendimento"}
          </button>
        )}
      </header>
      {notice && <p role="status" className="erp-alert success">{notice}</p>}
      {error && <p role="alert" className="erp-alert error">{error}</p>}
      {showCreate && canWrite && (
        <section className="erp-panel stitch-panel">
          <div className="panel-heading"><div>
            <p className="erp-kicker">Novo registro</p><h2>Registrar contato com o cliente</h2>
          </div></div>
          <form className="support-form" onSubmit={(event) => { void create(event); }}>
            <label>Cliente
              <select required value={clientId} onChange={(event) => {
                setClientId(event.target.value); setSaleId("");
              }}>
                <option value="">Selecionar cliente...</option>
                {clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>Categoria
              <select value={kind} onChange={(event) => setKind(event.target.value as Kind)}>
                {(Object.keys(kinds) as Kind[]).map((value) =>
                  <option key={value} value={value}>{kinds[value]}</option>)}
              </select>
            </label>
            <label>Pedido relacionado (opcional)
              <select value={saleId} disabled={!clientId}
                onChange={(event) => setSaleId(event.target.value)}>
                <option value="">Sem pedido vinculado</option>
                {relatedSales.map((item) =>
                  <option key={item.id} value={item.id}>{item.id.slice(0, 12)} · {item.stage}</option>)}
              </select>
            </label>
            <label className="support-content-label">Descrição do atendimento
              <textarea name="content" rows={4} minLength={1} maxLength={5000}
                placeholder="Registre o relato e as orientações prestadas..." required />
            </label>
            <div className="support-form-actions">
              <span>O registro é permanente e fica associado ao histórico do cliente.</span>
              <button className="primary-button" type="submit" disabled={busy || !clientId}>
                {busy ? "Salvando..." : "Salvar atendimento"}
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="erp-panel stitch-panel">
        <div className="support-toolbar">
          <div><p className="erp-kicker">Registro operacional</p><h2>Histórico de atendimentos</h2></div>
          <form className="support-search" onSubmit={(event) => {
            event.preventDefault(); setAppliedQuery(query.trim()); setPage(1);
          }}>
            <label>
              <span className="sr-only">Buscar atendimentos</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)}
                maxLength={120} placeholder="Cliente, WhatsApp ou relato..." />
            </label>
            <button type="submit" className="secondary-button">Buscar</button>
          </form>
          <label className="support-kind-filter">
            <span>Categoria</span>
            <select value={selectedKind} onChange={(event) => {
              setSelectedKind(event.target.value); setPage(1);
            }}>
              <option value="">Todas</option>
              {(Object.keys(kinds) as Kind[]).map((value) =>
                <option key={value} value={value}>{kinds[value]}</option>)}
            </select>
          </label>
        </div>
        {loading && <p className="empty-state">Carregando atendimentos...</p>}
        {!loading && history?.records.length === 0 &&
          <p className="empty-state">Nenhum atendimento encontrado para esses filtros.</p>}
        <div className="support-records">
          {history?.records.map((record) => (
            <article className="support-record" key={record.id}>
              <div className="support-record-header">
                <div>
                  <strong>{record.client.name}</strong>
                  <small>{date(record.createdAt)} · {record.createdBy.name}</small>
                </div>
                <span className="status-chip">{kinds[record.kind]}</span>
              </div>
              <p>{record.content}</p>
              <div className="support-record-footer">
                <Link href={`/clients?clientId=${encodeURIComponent(record.clientId)}`}>
                  Abrir Clientes & CRM
                </Link>
                {record.saleId && <span>Pedido: {record.saleId.slice(0, 12)}</span>}
              </div>
            </article>
          ))}
        </div>
        {history && history.total > 0 &&
          <div className="support-pagination">
            <span>{history.total} registro(s) · Página {history.page} de {history.pages}</span>
            <div>
              <button className="secondary-button" type="button"
                disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>
                Anterior
              </button>
              <button className="secondary-button" type="button"
                disabled={loading || page >= history.pages} onClick={() => setPage((value) => value + 1)}>
                Próxima
              </button>
            </div>
          </div>}
      </section>
    </div>
  );
}
