"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./integrations.module.css";

type Provider = "VAXCHAT" | "VAXLAB" | "GOPAGE" | "SHOPVAX" | "WHATSAPP" | "PAYMENT_GATEWAY" | "ECOMMERCE";
type Integration = {
  id: string;
  provider: Provider;
  key: string;
  displayName: string;
  status: "DISABLED" | "DISCONNECTED" | "CONNECTED" | "ERROR";
  secretConfigured: boolean;
  updatedAt: string;
};
type Form = {
  provider: Provider;
  key: string;
  displayName: string;
  enabled: boolean;
};
const providers: Record<Provider, string> = {
  VAXCHAT: "VaxChat", VAXLAB: "VaxLab", GOPAGE: "GoPage", SHOPVAX: "ShopVax",
  WHATSAPP: "WhatsApp", PAYMENT_GATEWAY: "Gateway de pagamentos", ECOMMERCE: "E-commerce",
};
const statuses: Record<Integration["status"], string> = {
  DISABLED: "Desabilitada", DISCONNECTED: "Não conectada",
  CONNECTED: "Conectada (estado informado pelo runtime)", ERROR: "Erro",
};
const empty = (): Form => ({ provider: "VAXCHAT", key: "", displayName: "", enabled: false });

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store", ...init,
    headers: { ...(typeof init?.body === "string" ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Falha ao registrar integração.");
  return payload as T;
}

export function IntegrationsWorkspace() {
  const [records, setRecords] = useState<Integration[]>([]);
  const [form, setForm] = useState<Form>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [visibleForm, setVisibleForm] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const result = await api<{ integrations: Integration[] }>("/api/integrations");
    setRecords(result.integrations);
  }, []);

  useEffect(() => {
    let live = true;
    void reload().catch((cause: unknown) => {
      if (live) setError(cause instanceof Error ? cause.message : "Erro ao carregar o registro de integrações.");
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("pt-BR");
    return records.filter((entry) => !q || [entry.key, providers[entry.provider], entry.displayName]
      .some((text) => text.toLocaleLowerCase("pt-BR").includes(q)));
  }, [records, search]);

  function openCreate() {
    setEditingId(null); setForm(empty()); setVisibleForm(true);
    setError(null); setNotice(null);
  }
  function openEdit(entry: Integration) {
    setEditingId(entry.id);
    setForm({ provider: entry.provider, key: entry.key,
      displayName: entry.displayName, enabled: entry.status !== "DISABLED" });
    setVisibleForm(true); setError(null); setNotice(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setNotice(null); setError(null);
    try {
      // Apenas metadados do registro. Sem secretRef, token, webhook, URL ou settings inventados.
      const result = await api<{ integration: Integration }>("/api/integrations", {
        method: "POST", body: JSON.stringify(form),
      });
      setNotice(result.integration.status === "DISCONNECTED"
        ? "Registro salvo. Conexão real ainda não configurada."
        : "Registro atualizado. O status registrado não substitui um teste real com o provedor.");
      setVisibleForm(false); setEditingId(null); setForm(empty());
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o registro.");
    } finally { setBusy(false); }
  }

  return (
    <div className="erp-page">
      <header className="erp-page-header stitch-hero">
        <div><p className="erp-kicker">Administração · Integrações</p>
          <h1>Integrações</h1>
          <p>Registro administrativo de provedores por empresa, sem simular conexão ativa.</p>
        </div>
        <button type="button" className="primary-button" onClick={openCreate}>+ Novo registro</button>
      </header>
      <div className="erp-alert neutral" role="note">
        Esta página registra provedores e estado administrativo, mas <strong>não conecta APIs</strong>.
        Endpoints, autenticação, webhooks, credenciais e testes reais precisam do contrato de cada serviço.
        Não cole senhas ou tokens em nomes/chaves.
      </div>
      {error && <div className="erp-alert error" role="alert">{error}</div>}
      {notice && <div className="erp-alert success" role="status">{notice}</div>}
      <div className="metric-grid">
        <div className="metric-card"><span>Registros</span><strong>{records.length}</strong></div>
        <div className="metric-card"><span>Habilitados</span><strong>{records.filter((r) => r.status !== "DISABLED").length}</strong></div>
        <div className="metric-card"><span>Não conectados</span><strong>{records.filter((r) => r.status === "DISCONNECTED").length}</strong></div>
        <div className="metric-card"><span>Com falha registrada</span><strong>{records.filter((r) => r.status === "ERROR").length}</strong></div>
      </div>
      <section className="erp-panel">
        <div className="panel-heading"><h2>Provedores registrados</h2></div>
        <div className={styles.filters}>
          <label>Localizar<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Provedor, nome ou chave" /></label>
        </div>
        {loading ? <p className="empty-state">Carregando registros...</p> : (
          <div className="client-table-wrap">
            <table className="client-table">
              <thead><tr><th>Provedor</th><th>Identificação</th><th>Estado</th><th>Referência de segredo</th><th>Ação</th></tr></thead>
              <tbody>{filtered.map((entry) => <tr key={entry.id}>
                <td>{providers[entry.provider]}</td>
                <td><strong>{entry.displayName}</strong><small>{entry.key}</small></td>
                <td><span className={`status-chip ${entry.status === "ERROR" ? "warning" : entry.status === "CONNECTED" ? "success" : ""}`}>{statuses[entry.status]}</span></td>
                <td>{entry.secretConfigured ? "Configurada (oculta)" : "Não cadastrada"}</td>
                <td><button type="button" className="table-action" onClick={() => openEdit(entry)}>Editar registro</button></td>
              </tr>)}</tbody>
            </table>
            {filtered.length === 0 && <p className="empty-state">Nenhuma integração cadastrada neste filtro.</p>}
          </div>
        )}
      </section>
      {visibleForm && <section className="erp-panel">
        <div className="panel-heading">
          <h2>{editingId ? "Atualizar identificação e estado" : "Novo registro de provedor"}</h2>
          <button className="text-button" type="button" onClick={() => setVisibleForm(false)}>Fechar</button>
        </div>
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <label>Provedor<select disabled={Boolean(editingId)} value={form.provider}
            onChange={(event) => setForm((f) => ({ ...f, provider: event.target.value as Provider }))}>
            {Object.entries(providers).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select></label>
          <label>Chave interna<input required readOnly={Boolean(editingId)} maxLength={80} pattern="[A-Za-z0-9][A-Za-z0-9_-]*"
            placeholder="Ex.: vaxchat-principal" value={form.key}
            onChange={(event) => setForm((f) => ({ ...f, key: event.target.value }))} /></label>
          <label>Nome de exibição<input required maxLength={120}
            value={form.displayName} onChange={(event) => setForm((f) => ({ ...f, displayName: event.target.value }))} /></label>
          <label className={styles.check}><input type="checkbox" checked={form.enabled}
            onChange={(event) => setForm((f) => ({ ...f, enabled: event.target.checked }))} />
            Habilitar registro administrativo (não ativa conexão)</label>
          <div className={styles.actions}>
            <button type="button" className="secondary-button" onClick={() => setVisibleForm(false)}>Cancelar</button>
            <button type="submit" className="primary-button" disabled={busy}>{busy ? "Salvando..." : "Salvar registro"}</button>
          </div>
        </form>
        <p className={styles.help}>Provedores atuais: VaxChat, VaxLab, GoPage, ShopVax, WhatsApp, gateways e e-commerce.
          Nenhum valor sensível é solicitado ou mostrado nesta tela.</p>
      </section>}
    </div>
  );
}
