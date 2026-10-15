"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Discount = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  percent: string;
  baseAmount: string;
  discountAmount: string;
  reason: string;
  createdAt: string;
  decisionReason: string | null;
  requestedBy: { name: string };
  decidedBy: { name: string } | null;
};
type DiscountPayload = {
  sale: { stage: "QUOTE" | "ORDER" | "PAID"; totalAmount: string; discountAmount: string };
  requests: Discount[];
  canApprove: boolean;
};

const money = (value: number | string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));

export function DiscountApprovalPanel({
  saleId, canWrite, onChanged, onLockChange,
}: {
  saleId: string;
  canWrite: boolean;
  onChanged: () => Promise<void>;
  onLockChange: (status: "PENDING" | "APPROVED" | null) => void;
}) {
  const [data, setData] = useState<DiscountPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(async () => {
    const response = await fetch(`/api/sales/${saleId}/discounts`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Não foi possível consultar os descontos.");
    setData(result);
    onLockChange(result.requests.find((discount: Discount) =>
      discount.status === "PENDING" || discount.status === "APPROVED")?.status ?? null);
  }, [saleId, onLockChange]);

  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);
    void (async () => {
      try {
        const response = await fetch(`/api/sales/${saleId}/discounts`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Não foi possível consultar os descontos.");
        if (active) {
          setData(result);
          onLockChange(result.requests.find((discount: Discount) =>
            discount.status === "PENDING" || discount.status === "APPROVED")?.status ?? null);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Falha ao consultar descontos.");
      }
    })();
    return () => { active = false; };
  }, [saleId, onLockChange]);

  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/sales/${saleId}/discounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          percent: String(fields.get("percent") ?? "").replace(",", "."),
          reason: String(fields.get("reason") ?? ""),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Solicitação não registrada.");
      await load();
      await onChanged();
      setNotice("Desconto solicitado. Aguarde a decisão da gestão.");
      form.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao solicitar desconto.");
    } finally { setBusy(false); }
  }

  async function decide(discount: Discount, decision: "APPROVE" | "REJECT") {
    if (busy) return;
    if (!window.confirm(decision === "APPROVE"
      ? `Aprovar ${discount.percent}% de desconto (${money(discount.discountAmount)})? O total do orçamento será atualizado.`
      : "Recusar esta solicitação de desconto?")) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/sales/${saleId}/discounts/${discount.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível decidir o desconto.");
      await load();
      await onChanged();
      setNotice(decision === "APPROVE"
        ? "Desconto aprovado e valor líquido atualizado."
        : "Desconto recusado. O orçamento pode ser editado novamente.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao decidir desconto.");
    } finally { setBusy(false); }
  }

  const active = data?.requests.find((discount) =>
    discount.status === "PENDING" || discount.status === "APPROVED");
  const pending = active?.status === "PENDING";
  const approved = active?.status === "APPROVED";
  return (
    <section className="sales-discount-panel">
      <div className="panel-heading">
        <div><p className="erp-kicker">Negociação comercial</p><h2>Desconto com aprovação</h2></div>
        {active && <span className={"status-chip " + (approved ? "success" : "warning")}>
          {approved ? "Aprovado" : "Aguardando gestor"}
        </span>}
      </div>
      <p className="panel-description">Todo desconto exige autorização da gestão. Os preços de tabela e o histórico da solicitação são preservados.</p>
      {error && <p className="erp-alert error" role="alert">{error}</p>}
      {notice && <p className="erp-alert success" role="status">{notice}</p>}
      {data && (
        <>
          {data.sale.discountAmount !== "0" && Number(data.sale.discountAmount) > 0 && (
            <div className="sales-discount-totals">
              <span>Valor de tabela: <strong>{money(Number(data.sale.totalAmount) + Number(data.sale.discountAmount))}</strong></span>
              <span>Desconto aprovado: <strong>- {money(data.sale.discountAmount)}</strong></span>
              <span>Valor líquido: <strong>{money(data.sale.totalAmount)}</strong></span>
            </div>
          )}
          {data.sale.stage === "QUOTE" && canWrite && !active && (
            <form className="sales-discount-form" onSubmit={(event) => {void request(event);}}>
              <label>Desconto (%)
                <input type="number" name="percent" min=".01" max="99.99" step=".01" required placeholder="Ex.: 5" />
              </label>
              <label>Justificativa
                <input name="reason" minLength={5} maxLength={500} required placeholder="Motivo da negociação" />
              </label>
              <button className="secondary-button" type="submit" disabled={busy}>
                {busy ? "Aguarde..." : "Solicitar aprovação"}
              </button>
            </form>
          )}
          {data.requests.length > 0 && (
            <div className="sales-discount-history">
              {data.requests.map((discount) => (
                <div className="sales-discount-history-row" key={discount.id}>
                  <div>
                    <strong>{discount.percent}% · {money(discount.discountAmount)}</strong>
                    <small>{discount.reason} · Solicitado por {discount.requestedBy.name}</small>
                    {discount.decidedBy && <small>Decisão: {discount.decidedBy.name}{discount.decisionReason ? " · " + discount.decisionReason : ""}</small>}
                  </div>
                  <span>{discount.status === "PENDING" ? "Pendente" : discount.status === "APPROVED" ? "Aprovado" : "Recusado"}</span>
                  {discount.status === "PENDING" && data.canApprove && data.sale.stage === "QUOTE" && (
                    <div className="sales-discount-actions">
                      <button className="secondary-button" type="button" disabled={busy}
                        onClick={() => {void decide(discount, "REJECT");}}>Recusar</button>
                      <button className="primary-button" type="button" disabled={busy}
                        onClick={() => {void decide(discount, "APPROVE");}}>Aprovar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {pending && <p className="sales-form-note">A confirmação do pedido e a edição do orçamento ficam bloqueadas até a decisão do gestor.</p>}
          {approved && <p className="sales-form-note">Desconto aprovado. O valor líquido será usado no pedido, pagamentos e comissões. O orçamento não pode mais ser editado.</p>}
        </>
      )}
    </section>
  );
}
