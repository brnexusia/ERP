"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Adjustment = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  direction: "INCREASE" | "DECREASE";
  amount: string;
  reason: string;
  amountBefore: string | null;
  amountAfter: string | null;
  decisionReason: string | null;
  requestedBy: { name: string };
  decidedBy: { name: string } | null;
};
type Payload = {
  closing: { id: string; beneficiaryName: string;
    amount: string; payable: { amount: string; status: "PAID" | "PENDING" } };
  adjustments: Adjustment[];
  canApprove: boolean;
};
const money = (value: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));

export function CommissionAdjustmentPanel({
  closingId, onChanged,
}: { closingId: string; onChanged: () => Promise<void> }) {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(async () => {
    const response = await fetch(`/api/commissions/closings/${closingId}/adjustments`, {
      cache: "no-store",
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Falha ao consultar correções.");
    setData(body as Payload);
  }, [closingId]);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const response = await fetch(`/api/commissions/closings/${closingId}/adjustments`, {
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Falha ao consultar correções.");
        if (mounted) setData(body as Payload);
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : "Falha de consulta.");
      }
    })();
    return () => { mounted = false; };
  }, [closingId]);

  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    if (!window.confirm("Solicitar correção do valor da comissão? O gestor ainda precisará aprovar.")) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/commissions/closings/${closingId}/adjustments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: String(fields.get("direction") ?? ""),
          amount: String(fields.get("amount") ?? ""),
          reason: String(fields.get("reason") ?? ""),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao solicitar.");
      form.reset();
      await load();
      await onChanged();
      setNotice("Solicitação registrada. Aguardando decisão da gestão.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao solicitar.");
    } finally { setBusy(false); }
  }

  async function decide(adjustment: Adjustment, decision: "APPROVE" | "REJECT") {
    if (busy) return;
    if (!window.confirm(decision === "APPROVE"
      ? "Aprovar correção e atualizar a conta a pagar ainda pendente?"
      : "Recusar esta solicitação de correção?")) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch(
        `/api/commissions/closings/${closingId}/adjustments/${adjustment.id}/decision`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha na decisão.");
      await load();
      await onChanged();
      setNotice(decision === "APPROVE" ? "Correção aprovada e conta a pagar atualizada."
        : "Solicitação recusada; conta a pagar preservada.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha na decisão.");
    } finally { setBusy(false); }
  }

  const pending = data?.adjustments.some((row) => row.status === "PENDING");
  return (
    <div className="commission-correction">
      <p className="panel-description">
        O fechamento original não é alterado. Uma correção autorizada ajusta somente a conta
        ainda pendente. Cheque devolvido não gera estorno automático de comissão.
      </p>
      {error && <p role="alert" className="erp-alert error">{error}</p>}
      {notice && <p role="status" className="erp-alert success">{notice}</p>}
      {!data && !error && <p className="empty-state">Consultando correções...</p>}
      {data && <>
        <p className="commission-correction-totals">
          Valor originalmente aprovado: <strong>{money(data.closing.amount)}</strong>
          {" · "}Valor atual da conta: <strong>{money(data.closing.payable.amount)}</strong>
        </p>
        {data.adjustments.length > 0 && (
          <div className="commission-correction-history">
            {data.adjustments.map((item) => (
              <div key={item.id} className="commission-correction-record">
                <div>
                  <strong>{item.direction === "INCREASE" ? "Acréscimo" : "Redução"} de {money(item.amount)}</strong>
                  <small>{item.reason} · Solicitado por {item.requestedBy.name}</small>
                  {item.decidedBy && <small>Decisão: {item.decidedBy.name} · {item.status === "APPROVED" ? "Aprovado" : "Recusado"}</small>}
                  {item.amountBefore && item.amountAfter && <small>
                    Conta antes: {money(item.amountBefore)} · Depois: {money(item.amountAfter)}
                  </small>}
                </div>
                {item.status === "PENDING" && data.canApprove &&
                  <div className="commission-correction-buttons">
                    <button className="secondary-button" type="button" disabled={busy}
                      onClick={() => {void decide(item, "REJECT");}}>Recusar</button>
                    <button className="primary-button" type="button" disabled={busy}
                      onClick={() => {void decide(item, "APPROVE");}}>Aprovar</button>
                  </div>}
                {item.status === "PENDING" && !data.canApprove && <span>Aguardando gestor</span>}
              </div>
            ))}
          </div>
        )}
        {data.closing.payable.status === "PENDING" && !pending && (
          <form className="commission-correction-form" onSubmit={(event) => {void request(event);}}>
            <label>Tipo
              <select name="direction" defaultValue="DECREASE">
                <option value="DECREASE">Reduzir</option><option value="INCREASE">Acrescentar</option>
              </select>
            </label>
            <label>Valor (R$)
              <input name="amount" type="number" min=".01" step=".01" required />
            </label>
            <label>Justificativa
              <input name="reason" minLength={8} maxLength={500} required
                placeholder="Explique a origem e inclua referência documental" />
            </label>
            <button className="secondary-button" type="submit" disabled={busy}>
              Solicitar correção
            </button>
          </form>
        )}
        {data.closing.payable.status === "PAID" &&
          <p className="sales-form-note">Comissão paga: correções monetárias estão bloqueadas para preservar o histórico financeiro.</p>}
        {pending && <p className="sales-form-note">Enquanto houver decisão pendente, a conta não poderá ser marcada como paga.</p>}
      </>}
    </div>
  );
}
