"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Item = { id: string; productName: string; sku: string; quantity: string };
type Fulfillment = {
  id: string;
  status: "SEPARATED" | "VERIFIED";
  separatedAt: string;
  verifiedAt: string | null;
  separatedBy: { id: string; name: string };
  verifiedBy: { id: string; name: string } | null;
};
type Payload = { fulfillmentRequired: boolean; fulfillment: Fulfillment | null };

export function FulfillmentPanel({
  saleId,
  items,
  canWrite,
}: {
  saleId: string;
  items: Item[];
  canWrite: boolean;
}) {
  const [details, setDetails] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/sales/${saleId}/fulfillment`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Não foi possível consultar a conferência.");
    setDetails(body as Payload);
  }, [saleId]);

  useEffect(() => {
    let active = true;
    setDetails(null);
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetch(`/api/sales/${saleId}/fulfillment`, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Não foi possível consultar a conferência.");
        if (active) setDetails(body as Payload);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Falha ao consultar conferência.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [saleId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !details) return;
    const current = details.fulfillment;
    if (current?.status === "VERIFIED") return;
    const step = current?.status === "SEPARATED" ? "verify" : "separate";
    const form = event.currentTarget;
    const data = new FormData(form);
    const checked = items.map((item) => ({
      saleItemId: item.id,
      quantity: String(data.get(item.id) ?? "").trim().replace(",", "."),
    }));
    if (checked.some((item) => !item.quantity)) {
      setError("Preencha a quantidade de todos os itens.");
      return;
    }
    if (!window.confirm(step === "verify"
      ? "Confirmar a conferência? Ela deve ser feita por outra pessoa e corresponde às quantidades físicas verificadas."
      : "Confirmar a separação física de todos os itens deste pedido?")) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/sales/${saleId}/fulfillment/${step}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: checked }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível concluir a operação.");
      await refresh();
      form.reset();
      setNotice(step === "verify"
        ? "Conferência concluída. O registro de entrega está liberado."
        : "Separação registrada. Outro funcionário deve conferir todos os itens.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao registrar itens.");
    } finally {
      setBusy(false);
    }
  }

  const fulfillment = details?.fulfillment;
  const status = fulfillment?.status === "VERIFIED" ? "Conferido"
    : fulfillment ? "Aguardando conferência" : "Aguardando separação";

  return (
    <div className="sales-fulfillment">
      <div className="panel-heading">
        <div>
          <p className="erp-kicker">Expedição · Etapa 2</p>
          <h2>Separação e conferência</h2>
        </div>
        <span className={"status-chip " + (fulfillment?.status === "VERIFIED" ? "success" : "warning")}>
          {loading ? "Carregando" : status}
        </span>
      </div>
      {details && !details.fulfillmentRequired && (
        <p className="sales-form-note">
          Pedido anterior à implantação da conferência obrigatória. O histórico logístico existente foi preservado.
        </p>
      )}
      {error && <p role="alert" className="erp-alert error">{error}</p>}
      {notice && <p role="status" className="erp-alert success">{notice}</p>}
      {fulfillment && (
        <div className="sales-fulfillment-history">
          <span>Separado por <strong>{fulfillment.separatedBy.name}</strong> em {new Date(fulfillment.separatedAt).toLocaleString("pt-BR")}</span>
          {fulfillment.verifiedBy && <span>Conferido por <strong>{fulfillment.verifiedBy.name}</strong> em {fulfillment.verifiedAt ? new Date(fulfillment.verifiedAt).toLocaleString("pt-BR") : "—"}</span>}
        </div>
      )}
      {details && !fulfillment?.verifiedAt && canWrite && (
        <form className="sales-fulfillment-form" onSubmit={(event) => {void submit(event);}}>
          <p className="sales-form-note">
            {fulfillment
              ? "Um segundo funcionário deve digitar novamente as quantidades conferidas."
              : "Digite as quantidades realmente separadas. O sistema compara cada item com o pedido."}
          </p>
          <div className="client-table-wrap">
            <table className="client-table">
              <thead><tr><th>Produto</th><th>SKU</th><th>Quantidade do pedido</th><th>Quantidade contada</th></tr></thead>
              <tbody>{items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.productName}</strong></td>
                  <td>{item.sku}</td>
                  <td>{item.quantity}</td>
                  <td>
                    <input aria-label={`Quantidade contada de ${item.productName}`}
                      name={item.id} required type="number" min="0.001" step="0.001"
                      placeholder="Conferir" />
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "Salvando..." : fulfillment ? "Confirmar conferência" : "Registrar separação"}
          </button>
          {fulfillment?.status === "SEPARATED" && (
            <p className="sales-form-note">Quem separou o pedido não pode aprovar a própria conferência.</p>
          )}
        </form>
      )}
      {fulfillment?.status === "VERIFIED" && (
        <p className="sales-form-note">Todos os itens conferidos por outra pessoa. Pode prosseguir com o registro de entrega.</p>
      )}
    </div>
  );
}
