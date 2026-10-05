"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Client = {
  id: string;
  name: string;
  document: string;
  documentType: "CPF" | "CNPJ";
  whatsapp: string;
  email: string;
  address?: {
    postalCode: string;
    street: string;
    number: string;
    complement?: string | null;
    district: string;
    city: string;
    state: string;
    country: string;
  } | null;
  segment?: { id: string; name: string } | null;
  responsibleSeller?: { user?: { name?: string } } | null;
};

type Segment = { id: string; name: string };
type InactivityAlert = {
  client?: Client;
  lastPurchaseAt: string;
  daysWithoutPurchase: number;
};

type CentralProfile = {
  client: Client;
  commercial?: {
    purchaseCount?: number;
    totalSpent?: string | number;
    averageTicket?: string | number;
    customerType?: string;
    daysWithoutPurchase?: number | null;
    inactivityAlert?: boolean;
  };
  purchases?: Array<Record<string, unknown>>;
  financial?: {
    credit?: {
      creditLimit?: string | number;
      usedAmount?: string | number;
      availableAmount?: string | number;
      movements?: Array<Record<string, unknown>>;
    };
    vale?: {
      balance?: string | number;
      movements?: Array<Record<string, unknown>>;
    };
  };
  relationship?: Array<Record<string, unknown>>;
  paymentHistory?: Array<Record<string, unknown>>;
  support?: Array<Record<string, unknown>>;
};

type CrmEntry = {
  id: string;
  title: string;
  content: string;
  occurredAt: string;
  followUpAt?: string | null;
  completedAt?: string | null;
  createdBy?: { name?: string };
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error ?? "Não foi possível concluir a operação.");
  }
  return payload as T;
}

function money(value: unknown) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function date(value: unknown) {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("pt-BR");
}

function documentLabel(client: Client) {
  return client.documentType === "CNPJ" ? "CNPJ" : "CPF";
}

function purchaseSummary(purchase: Record<string, unknown>) {
  const items = Array.isArray(purchase.items)
    ? (purchase.items as Array<Record<string, unknown>>)
    : [];
  const seller = purchase.seller as { user?: { name?: string } } | undefined;

  return {
    id: String(purchase.id ?? ""),
    paidAt: purchase.paidAt,
    totalAmount: purchase.totalAmount,
    sellerName: seller?.user?.name ?? "—",
    items: items.map((item) => ({
      name: String(item.productName ?? item.sku ?? "Produto"),
      quantity: String(item.quantity ?? "0"),
      lineTotal: item.lineTotal,
    })),
  };
}

export function ClientsWorkspace({ role }: { role: string }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [alerts, setAlerts] = useState<InactivityAlert[]>([]);
  const [inactivityDays, setInactivityDays] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CentralProfile | null>(null);
  const [crm, setCrm] = useState<CrmEntry[]>([]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canWriteClients = ["OWNER", "ADMIN", "MANAGER", "SELLER", "SUPPORT"].includes(role);
  const canManageCreditLimit = ["OWNER", "ADMIN", "FINANCE"].includes(role);
  const canMoveFinancial = canWriteClients || role === "FINANCE";

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clientData, segmentData, alertData, settingData] = await Promise.all([
        requestJson<{ clients: Client[] }>("/api/clients"),
        requestJson<{ segments: Segment[] }>("/api/client-segments"),
        requestJson<{ inactivity: { inactivityDays: number | null; alerts: InactivityAlert[] } }>(
          "/api/clients/inactivity-alerts",
        ),
        requestJson<{ settings: { inactivityDays?: number | null } | null }>("/api/client-settings"),
      ]);
      setClients(clientData.clients);
      setSegments(segmentData.segments);
      setAlerts(alertData.inactivity.alerts);
      setInactivityDays(settingData.settings?.inactivityDays ?? alertData.inactivity.inactivityDays);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar clientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (clientId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const [profileData, crmData] = await Promise.all([
        requestJson<{ profile: CentralProfile }>(`/api/clients/${clientId}/central-profile`),
        requestJson<{ entries: CrmEntry[] }>(`/api/clients/${clientId}/crm`),
      ]);
      setProfile(profileData.profile);
      setCrm(crmData.entries);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar o perfil do cliente.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else {
      setProfile(null);
      setCrm([]);
    }
  }, [loadDetail, selectedId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) =>
      [client.name, client.document, client.whatsapp, client.email, client.segment?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [clients, search]);

  const alertIds = useMemo(
    () => new Set(alerts.map((entry) => entry.client?.id).filter(Boolean)),
    [alerts],
  );

  async function runAction(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      await loadSummary();
      if (selectedId) await loadDetail(selectedId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a operação.");
    } finally {
      setBusy(false);
    }
  }

  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction(async () => {
      const payload = {
        name: String(form.get("name") ?? ""),
        document: String(form.get("document") ?? ""),
        whatsapp: String(form.get("whatsapp") ?? ""),
        email: String(form.get("email") ?? ""),
        address: {
          postalCode: String(form.get("postalCode") ?? ""),
          street: String(form.get("street") ?? ""),
          number: String(form.get("number") ?? ""),
          complement: String(form.get("complement") ?? "") || null,
          district: String(form.get("district") ?? ""),
          city: String(form.get("city") ?? ""),
          state: String(form.get("state") ?? ""),
          country: "BR",
        },
      };
      const created = await requestJson<{ client: Client }>("/api/clients", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCreateOpen(false);
      setSelectedId(created.client.id);
      event.currentTarget.reset();
    }, "Cliente cadastrado com sucesso.");
  }

  if (profile && selectedId) {
    const credit = profile.financial?.credit;
    const vale = profile.financial?.vale;
    const selected = profile.client;
    const purchases = (profile.purchases ?? []).map(purchaseSummary);

    return (
      <div className="erp-page">
        <header className="erp-page-header">
          <div>
            <button className="text-button" onClick={() => setSelectedId(null)} type="button">
              ← Voltar para clientes
            </button>
            <div className="erp-title-row">
              <div className="client-avatar large">{selected.name.slice(0, 2).toUpperCase()}</div>
              <div>
                <p className="erp-kicker">Perfil central do cliente</p>
                <h1>{selected.name}</h1>
                <p>{documentLabel(selected)} {selected.document} · {selected.whatsapp}</p>
              </div>
            </div>
          </div>
          <span className={profile.commercial?.inactivityAlert ? "status-chip warning" : "status-chip success"}>
            {profile.commercial?.inactivityAlert ? "Inativo" : "Relacionamento ativo"}
          </span>
        </header>

        {error && <div className="erp-alert error">{error}</div>}
        {notice && <div className="erp-alert success">{notice}</div>}

        {detailLoading ? (
          <div className="erp-panel">Carregando perfil...</div>
        ) : (
          <>
            <section className="metric-grid">
              <article className="metric-card">
                <span>Compras pagas</span>
                <strong>{profile.commercial?.purchaseCount ?? 0}</strong>
                <small>Histórico consolidado</small>
              </article>
              <article className="metric-card">
                <span>Total comprado</span>
                <strong>{money(profile.commercial?.totalSpent)}</strong>
                <small>Somente vendas pagas</small>
              </article>
              <article className="metric-card">
                <span>Crédito disponível</span>
                <strong>{money(credit?.availableAmount)}</strong>
                <small>de {money(credit?.creditLimit)} de limite</small>
              </article>
              <article className="metric-card">
                <span>Vale disponível</span>
                <strong>{money(vale?.balance)}</strong>
                <small>Saldo atual</small>
              </article>
            </section>

            <div className="two-column-layout">
              <section className="erp-panel">
                <div className="panel-heading">
                  <div>
                    <p className="erp-kicker">Cadastro</p>
                    <h2>Dados do cliente</h2>
                  </div>
                  <span className="status-chip">{selected.segment?.name ?? "Sem grupo"}</span>
                </div>
                <dl className="detail-list">
                  <div><dt>E-mail</dt><dd>{selected.email}</dd></div>
                  <div><dt>WhatsApp</dt><dd>{selected.whatsapp}</dd></div>
                  <div><dt>Endereço</dt><dd>{selected.address ? `${selected.address.street}, ${selected.address.number} — ${selected.address.city}/${selected.address.state}` : "—"}</dd></div>
                  <div><dt>Última compra</dt><dd>{date(profile.commercial?.daysWithoutPurchase == null ? null : profile.purchases?.[0]?.paidAt)}</dd></div>
                  <div><dt>Dias sem comprar</dt><dd>{profile.commercial?.daysWithoutPurchase ?? "—"}</dd></div>
                </dl>

                {canWriteClients && (
                  <details className="edit-details">
                    <summary>Editar dados cadastrais</summary>
                    <form
                      className="client-form compact-client-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        void runAction(
                          async () => {
                            await requestJson(`/api/clients/${selectedId}`, {
                              method: "PATCH",
                              body: JSON.stringify({
                                name: String(form.get("name") ?? ""),
                                document: String(form.get("document") ?? ""),
                                whatsapp: String(form.get("whatsapp") ?? ""),
                                email: String(form.get("email") ?? ""),
                                address: {
                                  postalCode: String(form.get("postalCode") ?? ""),
                                  street: String(form.get("street") ?? ""),
                                  number: String(form.get("number") ?? ""),
                                  complement: String(form.get("complement") ?? "") || null,
                                  district: String(form.get("district") ?? ""),
                                  city: String(form.get("city") ?? ""),
                                  state: String(form.get("state") ?? ""),
                                  country: selected.address?.country ?? "BR",
                                },
                              }),
                            });
                          },
                          "Cadastro atualizado.",
                        );
                      }}
                    >
                      <label>Nome / razão social<input name="name" defaultValue={selected.name} required /></label>
                      <label>CPF / CNPJ<input name="document" defaultValue={selected.document} required /></label>
                      <label>WhatsApp<input name="whatsapp" defaultValue={selected.whatsapp} required /></label>
                      <label>E-mail<input name="email" defaultValue={selected.email} type="email" required /></label>
                      <label>CEP<input name="postalCode" defaultValue={selected.address?.postalCode ?? ""} required /></label>
                      <label>Rua<input name="street" defaultValue={selected.address?.street ?? ""} required /></label>
                      <label>Número<input name="number" defaultValue={selected.address?.number ?? ""} required /></label>
                      <label>Complemento<input name="complement" defaultValue={selected.address?.complement ?? ""} /></label>
                      <label>Bairro<input name="district" defaultValue={selected.address?.district ?? ""} required /></label>
                      <label>Cidade<input name="city" defaultValue={selected.address?.city ?? ""} required /></label>
                      <label>UF<input name="state" defaultValue={selected.address?.state ?? ""} minLength={2} maxLength={2} required /></label>
                      <div className="form-actions"><button className="primary-button" disabled={busy}>Salvar cadastro</button></div>
                    </form>
                  </details>
                )}

                {canWriteClients && (
                <form
                  className="inline-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void runAction(
                      async () => {
                        await requestJson(`/api/clients/${selectedId}/segment`, {
                          method: "PATCH",
                          body: JSON.stringify({ segmentId: String(form.get("segmentId") || "") || null }),
                        });
                      },
                      "Segmentação atualizada.",
                    );
                  }}
                >
                  <label>
                    Grupo/perfil
                    <select name="segmentId" defaultValue={selected.segment?.id ?? ""}>
                      <option value="">Sem grupo</option>
                      {segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
                    </select>
                  </label>
                  <button className="secondary-button" disabled={busy}>Salvar grupo</button>
                </form>
                )}
              </section>

              <section className="erp-panel">
                <div className="panel-heading">
                  <div>
                    <p className="erp-kicker">Financeiro do cliente</p>
                    <h2>Crédito e vale</h2>
                  </div>
                </div>
                <div className="finance-summary">
                  <div><span>Limite</span><strong>{money(credit?.creditLimit)}</strong></div>
                  <div><span>Utilizado</span><strong>{money(credit?.usedAmount)}</strong></div>
                  <div><span>Disponível</span><strong>{money(credit?.availableAmount)}</strong></div>
                  <div><span>Vale</span><strong>{money(vale?.balance)}</strong></div>
                </div>

                {canManageCreditLimit && (
                <form
                  className="action-form compact"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void runAction(
                      async () => {
                        await requestJson(`/api/clients/${selectedId}/credit`, {
                          method: "PATCH",
                          body: JSON.stringify({ creditLimit: String(form.get("creditLimit") ?? "0") }),
                        });
                      },
                      "Limite de crédito atualizado.",
                    );
                  }}
                >
                  <label>Limite de crédito<input name="creditLimit" inputMode="decimal" defaultValue={String(credit?.creditLimit ?? "0")} /></label>
                  <button className="secondary-button" disabled={busy}>Atualizar limite</button>
                </form>
                )}

                {canMoveFinancial && (
                <div className="split-actions">
                  <form
                    className="action-form compact"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void runAction(
                        async () => {
                          await requestJson(`/api/clients/${selectedId}/credit/movements`, {
                            method: "POST",
                            body: JSON.stringify({
                              amountDelta: String(form.get("amountDelta") ?? ""),
                              note: String(form.get("note") ?? "") || null,
                            }),
                          });
                          event.currentTarget.reset();
                        },
                        "Movimentação de crédito registrada.",
                      );
                    }}
                  >
                    <h3>Movimentar crédito utilizado</h3>
                    <label>Valor (+ usa / − devolve)<input name="amountDelta" inputMode="decimal" required placeholder="100 ou -100" /></label>
                    <label>Observação<input name="note" maxLength={500} /></label>
                    <button className="secondary-button" disabled={busy}>Registrar</button>
                  </form>

                  <form
                    className="action-form compact"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void runAction(
                        async () => {
                          await requestJson(`/api/clients/${selectedId}/vale/movements`, {
                            method: "POST",
                            body: JSON.stringify({
                              amountDelta: String(form.get("amountDelta") ?? ""),
                              note: String(form.get("note") ?? "") || null,
                            }),
                          });
                          event.currentTarget.reset();
                        },
                        "Movimentação de vale registrada.",
                      );
                    }}
                  >
                    <h3>Movimentar vale</h3>
                    <label>Valor (+ adiciona / − utiliza)<input name="amountDelta" inputMode="decimal" required placeholder="50 ou -50" /></label>
                    <label>Observação<input name="note" maxLength={500} /></label>
                    <button className="secondary-button" disabled={busy}>Registrar</button>
                  </form>
                </div>
                )}
              </section>
            </div>

            <section className="erp-panel">
              <div className="panel-heading">
                <div>
                  <p className="erp-kicker">Histórico real</p>
                  <h2>Compras do cliente</h2>
                </div>
                <span className="status-chip">{purchases.length} compra(s) paga(s)</span>
              </div>
              {purchases.length === 0 ? (
                <p className="empty-state">Este cliente ainda não possui compras pagas.</p>
              ) : (
                <div className="client-table-wrap">
                  <table className="client-table">
                    <thead><tr><th>Data</th><th>Itens</th><th>Vendedora</th><th>Total</th></tr></thead>
                    <tbody>
                      {purchases.map((purchase) => (
                        <tr key={purchase.id}>
                          <td>{date(purchase.paidAt)}</td>
                          <td>
                            {purchase.items.map((item, index) => (
                              <small key={`${purchase.id}-${index}`}>
                                {item.quantity}× {item.name} · {money(item.lineTotal)}
                              </small>
                            ))}
                          </td>
                          <td>{purchase.sellerName}</td>
                          <td><strong>{money(purchase.totalAmount)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="erp-panel">
              <div className="panel-heading">
                <div>
                  <p className="erp-kicker">CRM integrado</p>
                  <h2>Relacionamento e follow-up</h2>
                </div>
                <span className="status-chip">{crm.length} atividade(s)</span>
              </div>
              {canWriteClients && (
              <form
                className="crm-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void runAction(
                    async () => {
                      await requestJson(`/api/clients/${selectedId}/crm`, {
                        method: "POST",
                        body: JSON.stringify({
                          title: String(form.get("title") ?? ""),
                          content: String(form.get("content") ?? ""),
                          followUpAt: String(form.get("followUpAt") ?? "")
                            ? new Date(String(form.get("followUpAt"))).toISOString()
                            : null,
                        }),
                      });
                      event.currentTarget.reset();
                    },
                    "Atividade adicionada ao CRM.",
                  );
                }}
              >
                <label>Título<input name="title" required maxLength={160} /></label>
                <label className="wide">Registro<textarea name="content" required rows={3} maxLength={5000} /></label>
                <label>Follow-up<input name="followUpAt" type="datetime-local" /></label>
                <button className="primary-button" disabled={busy}>Adicionar atividade</button>
              </form>
              )}
              <div className="timeline">
                {crm.length === 0 && <p className="empty-state">Nenhuma atividade de relacionamento registrada.</p>}
                {crm.map((entry) => (
                  <article key={entry.id} className="timeline-entry">
                    <span className="timeline-dot" />
                    <div>
                      <div className="timeline-title">
                        <strong>{entry.title}</strong>
                        <time>{date(entry.occurredAt)}</time>
                      </div>
                      <p>{entry.content}</p>
                      <small>
                        {entry.createdBy?.name ?? "Usuário"}
                        {entry.followUpAt ? ` · Follow-up: ${date(entry.followUpAt)}` : ""}
                        {entry.completedAt ? " · Concluído" : ""}
                      </small>
                      {canWriteClients && !entry.completedAt && (
                        <button
                          className="text-button crm-complete"
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            void runAction(
                              async () => {
                                await requestJson(`/api/clients/${selectedId}/crm/${entry.id}`, {
                                  method: "PATCH",
                                  body: JSON.stringify({ completedAt: new Date().toISOString() }),
                                });
                              },
                              "Atividade concluída.",
                            );
                          }}
                        >
                          Marcar como concluída
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="erp-page">
      <header className="erp-page-header">
        <div>
          <p className="erp-kicker">Etapa 1 · Gestão de Clientes</p>
          <h1>Clientes & CRM</h1>
          <p>Cadastro, relacionamento, crédito, vale, segmentação e inatividade em um só lugar.</p>
        </div>
        {canWriteClients && (
          <button className="primary-button" type="button" onClick={() => setCreateOpen((value) => !value)}>
            {createOpen ? "Fechar cadastro" : "+ Novo cliente"}
          </button>
        )}
      </header>

      {error && <div className="erp-alert error">{error}</div>}
      {notice && <div className="erp-alert success">{notice}</div>}

      <section className="metric-grid">
        <article className="metric-card"><span>Clientes cadastrados</span><strong>{clients.length}</strong><small>Base da empresa ativa</small></article>
        <article className="metric-card"><span>Grupos/perfis</span><strong>{segments.length}</strong><small>Segmentação comercial</small></article>
        <article className="metric-card"><span>Alertas de inatividade</span><strong>{alerts.length}</strong><small>{inactivityDays ? `Após ${inactivityDays} dias` : "Regra ainda não configurada"}</small></article>
        <article className="metric-card"><span>Módulo</span><strong>Operacional</strong><small>Dados isolados por empresa</small></article>
      </section>

      {canWriteClients && createOpen && (
        <section className="erp-panel">
          <div className="panel-heading">
            <div><p className="erp-kicker">Novo cadastro</p><h2>Dados completos do cliente</h2></div>
          </div>
          <form className="client-form" onSubmit={createClient}>
            <label>Nome / razão social<input name="name" required minLength={2} /></label>
            <label>CPF / CNPJ<input name="document" required inputMode="numeric" /></label>
            <label>WhatsApp<input name="whatsapp" required inputMode="tel" /></label>
            <label>E-mail<input name="email" required type="email" /></label>
            <label>CEP<input name="postalCode" required inputMode="numeric" /></label>
            <label>Rua / avenida<input name="street" required /></label>
            <label>Número<input name="number" required /></label>
            <label>Complemento<input name="complement" /></label>
            <label>Bairro<input name="district" required /></label>
            <label>Cidade<input name="city" required /></label>
            <label>UF<input name="state" required minLength={2} maxLength={2} /></label>
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setCreateOpen(false)}>Cancelar</button>
              <button className="primary-button" disabled={busy}>Cadastrar cliente</button>
            </div>
          </form>
        </section>
      )}

      <section className="erp-panel">
        <div className="panel-heading">
          <div><p className="erp-kicker">Base de clientes</p><h2>Gestão central</h2></div>
          <label className="search-field">
            <span>⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome, CPF/CNPJ, WhatsApp..." />
          </label>
        </div>

        {loading ? (
          <p className="empty-state">Carregando clientes...</p>
        ) : filtered.length === 0 ? (
          <p className="empty-state">Nenhum cliente encontrado.</p>
        ) : (
          <div className="client-table-wrap">
            <table className="client-table">
              <thead><tr><th>Cliente</th><th>Contato</th><th>Grupo</th><th>Responsável</th><th>Status</th><th /></tr></thead>
              <tbody>
                {filtered.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div className="client-name-cell">
                        <span className="client-avatar">{client.name.slice(0, 2).toUpperCase()}</span>
                        <div><strong>{client.name}</strong><small>{documentLabel(client)} {client.document}</small></div>
                      </div>
                    </td>
                    <td><strong>{client.whatsapp}</strong><small>{client.email}</small></td>
                    <td><span className="status-chip">{client.segment?.name ?? "Sem grupo"}</span></td>
                    <td>{client.responsibleSeller?.user?.name ?? "—"}</td>
                    <td>
                      <span className={alertIds.has(client.id) ? "status-chip warning" : "status-chip success"}>
                        {alertIds.has(client.id) ? "Inativo" : "Ativo"}
                      </span>
                    </td>
                    <td><button className="table-action" onClick={() => setSelectedId(client.id)}>Abrir →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {alerts.length > 0 && (
        <section className="erp-panel">
          <div className="panel-heading">
            <div><p className="erp-kicker">Atenção comercial</p><h2>Clientes sem comprar</h2></div>
            <span className="status-chip warning">{alerts.length} alerta(s)</span>
          </div>
          <div className="alert-list">
            {alerts.slice(0, 8).map((alert) => (
              <button key={alert.client?.id} className="alert-row" onClick={() => alert.client?.id && setSelectedId(alert.client.id)}>
                <span className="client-avatar">{alert.client?.name?.slice(0, 2).toUpperCase() ?? "?"}</span>
                <span><strong>{alert.client?.name}</strong><small>Última compra: {date(alert.lastPurchaseAt)}</small></span>
                <b>{alert.daysWithoutPurchase} dias</b>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
