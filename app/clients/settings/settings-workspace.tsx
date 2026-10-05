"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Segment = { id: string; name: string };
type Integration = {
  id: string;
  provider: string;
  displayName: string;
  status: "DISCONNECTED" | "CONNECTED" | "ERROR" | "DISABLED";
  secretConfigured: boolean;
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
  if (!response.ok) throw new Error(payload?.error ?? "Não foi possível concluir a operação.");
  return payload as T;
}

function integrationText(status: Integration["status"] | undefined) {
  if (status === "CONNECTED") return "Conectado";
  if (status === "ERROR") return "Erro";
  if (status === "DISABLED") return "Desabilitado";
  return "Não conectado";
}

export function ClientSettingsWorkspace({ role }: { role: string }) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [inactivityDays, setInactivityDays] = useState<number | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canManage = ["OWNER", "ADMIN"].includes(role);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [segmentData, settingData, integrationData] = await Promise.all([
        requestJson<{ segments: Segment[] }>("/api/client-segments"),
        requestJson<{ settings: { inactivityDays?: number | null } | null }>("/api/client-settings"),
        canManage
          ? requestJson<{ integrations: Integration[] }>("/api/integrations")
          : Promise.resolve({ integrations: [] as Integration[] }),
      ]);
      setSegments(segmentData.segments);
      setInactivityDays(settingData.settings?.inactivityDays ?? null);
      setIntegrations(integrationData.integrations);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar configurações.");
    }
  }, [canManage]);

  useEffect(() => { void load(); }, [load]);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a operação.");
    } finally {
      setBusy(false);
    }
  }

  const vaxChat = integrations.find((item) => item.provider === "VAXCHAT");
  const vaxLab = integrations.find((item) => item.provider === "VAXLAB");

  return (
    <div className="erp-page">
      <header className="erp-page-header">
        <div>
          <p className="erp-kicker">Etapa 1 · Configuração</p>
          <h1>Clientes & CRM</h1>
          <p>Parâmetros da gestão de clientes e prontidão das integrações iniciais.</p>
        </div>
      </header>

      {error && <div className="erp-alert error">{error}</div>}
      {notice && <div className="erp-alert success">{notice}</div>}

      <div className="settings-grid">
        <section className="erp-panel">
          <div className="panel-heading"><div><p className="erp-kicker">Inatividade</p><h2>Alerta sem compra</h2></div></div>
          <p className="panel-description">
            Defina quantos dias sem compra paga devem gerar um alerta automático para a equipe.
          </p>
          {canManage ? (
          {canManage && (
          <form
            className="action-form"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const raw = String(form.get("inactivityDays") ?? "").trim();
              void run(
                async () => {
                  await requestJson("/api/client-settings", {
                    method: "PATCH",
                    body: JSON.stringify({ inactivityDays: raw ? Number(raw) : null }),
                  });
                },
                "Regra de inatividade atualizada.",
              );
            }}
          >
            <label>Dias sem compra<input name="inactivityDays" type="number" min={1} defaultValue={inactivityDays ?? ""} placeholder="Ex.: 30" /></label>
            <button className="primary-button" disabled={busy}>Salvar regra</button>
          </form>
          ) : (
            <div className="read-only-setting">Regra atual: {inactivityDays ? `${inactivityDays} dias` : "não configurada"} · somente administradores podem alterar.</div>
          )}
        </section>

        <section className="erp-panel">
          <div className="panel-heading"><div><p className="erp-kicker">Segmentação</p><h2>Grupos de clientes</h2></div></div>
          <p className="panel-description">Crie os grupos/perfis usados para classificar a carteira comercial.</p>
          <form
            className="action-form"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void run(
                async () => {
                  await requestJson("/api/client-segments", {
                    method: "POST",
                    body: JSON.stringify({ name: String(form.get("name") ?? "") }),
                  });
                  event.currentTarget.reset();
                },
                "Grupo criado.",
              );
            }}
          >
            <label>Novo grupo<input name="name" required maxLength={80} placeholder="Ex.: Grupo A" /></label>
            <button className="primary-button" disabled={busy}>Adicionar grupo</button>
          </form>
          )}
          <div className="chip-list">
            {segments.length ? segments.map((segment) => <span className="status-chip" key={segment.id}>{segment.name}</span>) : <span className="empty-state">Nenhum grupo cadastrado.</span>}
          </div>
        </section>
      </div>

      <section className="erp-panel">
        <div className="panel-heading">
          <div><p className="erp-kicker">Integrações iniciais do escopo</p><h2>VaxChat e VaxLab</h2></div>
          <span className="status-chip">Etapa 1</span>
        </div>
        <p className="panel-description">
          O ERP já possui o registro seguro e isolado por empresa para as duas integrações. A conexão real só pode ser homologada quando URL, autenticação, credenciais e contrato de eventos das APIs forem fornecidos.
        </p>
        {!canManage && <div className="read-only-setting">O estado técnico das integrações é visível apenas para OWNER/ADMIN.</div>}
        {canManage && <div className="integration-grid">
          {[["VaxChat", vaxChat], ["VaxLab", vaxLab]].map(([name, item]) => {
            const integration = item as Integration | undefined;
            return (
              <article className="integration-card" key={String(name)}>
                <div className="integration-icon">{String(name).slice(0, 2).toUpperCase()}</div>
                <div>
                  <strong>{String(name)}</strong>
                  <p>{integration ? integrationText(integration.status) : "Configuração ainda não cadastrada"}</p>
                  <small>{integration?.secretConfigured ? "Referência de credencial configurada" : "Sem referência de credencial"}</small>
                </div>
                <span className={integration?.status === "CONNECTED" ? "status-dot connected" : "status-dot"} />
              </article>
            );
          })}
        </div>}
        <div className="erp-alert neutral">
          Não marcamos estas integrações como “conectadas” apenas por existir configuração: o fechamento exige chamada real, retorno válido e sincronização homologada.
        </div>
      </section>

      <section className="erp-panel">
        <div className="panel-heading"><div><p className="erp-kicker">Gate de fechamento</p><h2>Estado do Módulo 1</h2></div></div>
        <div className="module-checklist">
          <span className="done">✓ Cadastro completo de clientes</span>
          <span className="done">✓ Linha de crédito e histórico</span>
          <span className="done">✓ Vale e movimentações</span>
          <span className="done">✓ Segmentação por grupo/perfil</span>
          <span className="done">✓ Alerta configurável de inatividade</span>
          <span className="done">✓ CRM e follow-up</span>
          <span className="done">✓ Perfil central do cliente</span>
          <span className="done">✓ Login e controle de acesso</span>
          <span className="pending">• Fidelidade final ao Stitch: aguardando fonte visual completa</span>
          <span className="pending">• VaxChat/VaxLab reais: aguardando contrato técnico/credenciais</span>
        </div>
      </section>
    </div>
  );
}
