"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./alerts.module.css";

type AlertsPayload = {
  generatedAt: string;
  permissions: { clients: boolean; inventory: boolean };
  configuredInactivityDays: number | null;
  summary: { total: number; inactiveClients: number; lowStockProducts: number };
  inactiveClients: Array<{
    id: string; name: string; daysWithoutPurchase: number; thresholdDays: number;
    lastPurchaseAt: string | null; responsibleSellerName: string | null;
  }>;
  lowStockProducts: Array<{
    id: string; name: string; sku: string; quantity: string; minimum: string; unitMeasure: string;
  }>;
};

export function AlertsWorkspace() {
  const [data, setData] = useState<AlertsPayload | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/alerts", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível consultar alertas.");
      setData(payload.alerts as AlertsPayload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao consultar alertas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const query = filter.trim().toLocaleLowerCase("pt-BR");
  const clients = useMemo(
    () => (data?.inactiveClients ?? []).filter((item) =>
      [item.name, item.responsibleSellerName ?? ""].some((text) => text.toLocaleLowerCase("pt-BR").includes(query))),
    [data, query],
  );
  const products = useMemo(
    () => (data?.lowStockProducts ?? []).filter((item) =>
      [item.name, item.sku].some((text) => text.toLocaleLowerCase("pt-BR").includes(query))),
    [data, query],
  );

  return <div className="erp-page">
    <header className="erp-page-header stitch-hero">
      <div>
        <p className="erp-kicker">Operação · Atenção necessária</p>
        <h1>Central de alertas</h1>
        <p>Clientes que atingiram os dias de inatividade configurados e produtos no estoque mínimo ou abaixo.</p>
      </div>
      <button type="button" className="secondary-button" disabled={loading} onClick={() => void refresh()}>
        {loading ? "Consultando..." : "Atualizar alertas"}
      </button>
    </header>
    <p className={styles.explain}>
      Alertas calculados automaticamente a partir dos registros reais, no momento da consulta.
      Não há envio de WhatsApp ou e-mail e nenhuma ação de estoque é executada automaticamente.
      Os dias de inatividade respeitam a configuração de cada cliente ou empresa.
    </p>
    {error && <div className="erp-alert error" role="alert">{error}</div>}
    {data && <>
      <div className={styles.metricRow} aria-label="Resumo de alertas">
        <div className={styles.metric}><span>Alertas em aberto</span><strong>{data.summary.total}</strong></div>
        <div className={styles.metric}><span>Clientes inativos</span><strong>{data.summary.inactiveClients}</strong></div>
        <div className={styles.metric}><span>Produtos com estoque baixo</span><strong>{data.summary.lowStockProducts}</strong></div>
      </div>
      <div className={styles.toolbar}>
        <label htmlFor="alerts-search">Buscar alerta</label>
        <input id="alerts-search" value={filter} onChange={(event) => setFilter(event.target.value)}
          placeholder="Cliente, vendedora, produto ou SKU" />
      </div>
      {data.permissions.clients && <section className={styles.group} aria-label="Alertas de inatividade">
        <div className={styles.groupHeader}>
          <h2>Clientes sem compra</h2>
          <small>{clients.length} de {data.summary.inactiveClients} alerta(s)</small>
        </div>
        <div className={styles.list}>{clients.map((item) => <article className={styles.entry} key={item.id}>
          <div><h3>{item.name}</h3>
            <p>{item.daysWithoutPurchase} dia(s) sem compra · alerta configurado em {item.thresholdDays} dia(s)</p>
            {item.responsibleSellerName && <p>Contato comercial: {item.responsibleSellerName}</p>}
            <p>{item.lastPurchaseAt ? `Última compra: ${new Date(item.lastPurchaseAt).toLocaleDateString("pt-BR")}` : "Sem compra registrada — referência: cadastro"}</p>
          </div>
          <Link href={`/clients?client=${encodeURIComponent(item.id)}`}>Consultar cliente</Link>
        </article>)}
        {clients.length === 0 && <p className={styles.empty}>
          {query ? "Nenhum cliente corresponde à pesquisa." : "Nenhum cliente atingiu os dias de inatividade configurados."}
        </p>}</div>
      </section>}
      {data.permissions.inventory && <section className={styles.group} aria-label="Alertas de estoque">
        <div className={styles.groupHeader}>
          <h2>Estoque baixo</h2>
          <small>{products.length} de {data.summary.lowStockProducts} alerta(s)</small>
        </div>
        <div className={styles.list}>{products.map((item) => <article className={styles.entry} key={item.id}>
          <div><h3>{item.name}</h3>
            <p>SKU {item.sku} · quantidade: {item.quantity} {item.unitMeasure} · mínimo: {item.minimum} {item.unitMeasure}</p>
          </div>
          <Link href={`/products?product=${encodeURIComponent(item.id)}`}>Consultar estoque</Link>
        </article>)}
        {products.length === 0 && <p className={styles.empty}>
          {query ? "Nenhum produto corresponde à pesquisa." : "Nenhum produto está no estoque mínimo ou abaixo."}
        </p>}</div>
      </section>}
      <p className={styles.time}>Consulta realizada em {new Date(data.generatedAt).toLocaleString("pt-BR")} · apenas alertas da empresa ativa.</p>
    </>}
    {!data && !error && <div className={styles.empty}>Carregando alertas da empresa...</div>}
  </div>;
}
