"use client";

import { FormEvent, useEffect, useState } from "react";

type DeliveryMethod = "PICKUP" | "CORREIOS" | "CARRIER";
type Delivery = {
  id: string; method: DeliveryMethod; pickupRegisteredAt: string | null;
  trackingCode: string | null; carrierName: string | null;
  shipmentProofUrl: string | null; deliveryProofUrl: string | null;
  createdAt: string;
};
type Check = { fulfillmentRequired: boolean; fulfillment: null | { status: "SEPARATED" | "VERIFIED" } };
const names: Record<DeliveryMethod, string> = {
  PICKUP: "Retirada na loja", CORREIOS: "Correios", CARRIER: "Transportadora",
};
const display = (value: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";
const localTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
async function read<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(
    typeof data.error === "string" ? data.error : "Falha ao consultar ou salvar entrega.");
  return data as T;
}
export function SaleDeliveryPanel({ saleId, canWrite }: { saleId: string; canWrite: boolean }) {
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [method, setMethod] = useState<DeliveryMethod>("PICKUP");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const base = "/api/sales/" + saleId;

  async function refresh() {
    const [a, b] = await Promise.all([
      read<{ delivery: Delivery | null }>(base + "/delivery"),
      read<Check>(base + "/fulfillment"),
    ]);
    setDelivery(a.delivery);
    setCheck(b);
    if (a.delivery) setMethod(a.delivery.method);
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setNotice(null);
    setDelivery(null);
    setCheck(null);
    void Promise.all([
      read<{ delivery: Delivery | null }>(base + "/delivery"),
      read<Check>(base + "/fulfillment"),
    ]).then(([a, b]) => {
      if (!active) return;
      setDelivery(a.delivery);
      setCheck(b);
      if (a.delivery) setMethod(a.delivery.method);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Falha ao carregar entrega.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [base]);
  const blocked = Boolean(check?.fulfillmentRequired && !delivery &&
    check.fulfillment?.status !== "VERIFIED");
  const ready = canWrite && !busy && !uploading && !loading && Boolean(check) && !blocked;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    let body: Record<string, string>;
    if (method === "PICKUP") {
      const value = String(values.get("pickupRegisteredAt") ?? "");
      if (!value || Number.isNaN(Date.parse(value))) { setError("Informe a data de retirada."); return; }
      body = { method, pickupRegisteredAt: new Date(value).toISOString() };
    } else if (method === "CORREIOS") {
      const trackingCode = String(values.get("trackingCode") ?? "").trim();
      if (!trackingCode) { setError("Informe o rastreamento."); return; }
      body = { method, trackingCode };
    } else {
      const carrierName = String(values.get("carrierName") ?? "").trim();
      if (!carrierName) { setError("Informe a transportadora."); return; }
      body = { method, carrierName };
    }
    if (!window.confirm(delivery
      ? "Atualizar entrega? A mudança de modalidade poderá substituir os dados logísticos anteriores."
      : "Registrar esta entrega para o pedido?")) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await read(base + "/delivery", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await refresh();
      setNotice("Entrega registrada e vinculada ao pedido.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao registrar entrega.");
    } finally { setBusy(false); }
  }
  async function upload(event: FormEvent<HTMLFormElement>, kind: "shipment" | "delivery") {
    event.preventDefault();
    if (!canWrite || !delivery || delivery.method !== "CARRIER" || busy || uploading) return;
    const form = event.currentTarget;
    const file = new FormData(form).get("file");
    if (!(file instanceof File) || !file.size) { setError("Selecione um arquivo."); return; }
    if (!window.confirm("Anexar comprovante privado de " + (kind === "shipment" ? "envio" : "entrega") + "?")) return;
    const data = new FormData();
    data.append("kind", kind);
    data.append("file", file);
    setUploading(true); setError(null); setNotice(null);
    try {
      await read(base + "/delivery/proofs", { method: "POST", body: data });
      await refresh();
      form.reset();
      setNotice("Comprovante anexado com acesso privado.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha no comprovante.");
    } finally { setUploading(false); }
  }

  return (
    <section className="sales-delivery-section" aria-label="Logística e entrega">
      <div className="panel-heading">
        <div><p className="erp-kicker">Módulo 2 · Expedição</p><h2>Logística & Entrega</h2></div>
        <span className={"status-chip " + (delivery ? "success" : "warning")}>
          {loading ? "Carregando..." : delivery ? "Registrada" : "Sem registro"}
        </span>
      </div>
      {error && <p className="erp-alert error" role="alert">{error}</p>}
      {notice && <p className="erp-alert success" role="status">{notice}</p>}
      {blocked && <p className="sales-delivery-note" role="status">
        A primeira entrega exige separação e conferência por outro funcionário.
      </p>}
      {delivery && <div className="sales-delivery-summary">
        <div><span>Modalidade</span><strong>{names[delivery.method]}</strong></div>
        <div><span>Registro</span><strong>{display(delivery.createdAt)}</strong></div>
        <div><span>Referência</span><strong>{delivery.method === "PICKUP"
          ? display(delivery.pickupRegisteredAt)
          : delivery.method === "CORREIOS" ? delivery.trackingCode ?? "—" : delivery.carrierName ?? "—"}</strong></div>
      </div>}
      {canWrite && !loading && check && (
        <form key={delivery?.id ?? saleId} className="sales-delivery-form"
          onSubmit={(event) => { void save(event); }}>
          <label>Modalidade
            <select value={method} onChange={(event) => setMethod(event.target.value as DeliveryMethod)}
              disabled={!ready}>
              {(Object.keys(names) as DeliveryMethod[]).map((kind) =>
                <option value={kind} key={kind}>{names[kind]}</option>)}
            </select>
          </label>
          {method === "PICKUP" && <label>Data e horário da retirada
            <input name="pickupRegisteredAt" type="datetime-local" required disabled={!ready}
              defaultValue={delivery?.method === "PICKUP" ? localTime(delivery.pickupRegisteredAt) : ""} />
          </label>}
          {method === "CORREIOS" && <label>Código de rastreamento
            <input name="trackingCode" required maxLength={120} disabled={!ready}
              defaultValue={delivery?.method === "CORREIOS" ? delivery.trackingCode ?? "" : ""} />
          </label>}
          {method === "CARRIER" && <label>Nome da transportadora
            <input name="carrierName" required maxLength={200} disabled={!ready}
              defaultValue={delivery?.method === "CARRIER" ? delivery.carrierName ?? "" : ""} />
          </label>}
          <button type="submit" className="primary-button" disabled={!ready}>
            {busy ? "Salvando..." : delivery ? "Atualizar entrega" : "Registrar entrega"}
          </button>
        </form>
      )}
      {delivery?.method === "CARRIER" && <div className="sales-delivery-proofs">
        <strong>Comprovantes privados</strong>
        {([
          { kind: "shipment" as const, label: "Envio", stored: Boolean(delivery.shipmentProofUrl) },
          { kind: "delivery" as const, label: "Entrega", stored: Boolean(delivery.deliveryProofUrl) },
        ]).map((item) => <div key={item.kind} className="sales-delivery-proof-row">
          <span>{item.label}: {item.stored ? "Anexado" : "Não anexado"}</span>
          {canWrite && !item.stored && <form onSubmit={(event) => { void upload(event, item.kind); }}>
            <input type="file" name="file" required accept=".pdf,image/jpeg,image/png,image/webp"
              aria-label={"Comprovante de " + item.label.toLowerCase()} disabled={busy || uploading} />
            <button className="secondary-button" type="submit" disabled={busy || uploading}>
              {uploading ? "Enviando..." : "Anexar"}
            </button>
          </form>}
        </div>)}
      </div>}
      <p className="sales-delivery-note">
        O código de rastreio não dispara mensagens. Anexos ficam privados.
      </p>
    </section>
  );
}
