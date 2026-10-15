"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Payment = {
  id: string; method: string; status: string; amount: string;
  chequeNumber: string | null; chequeReturn?: { id: string } | null;
};
type Incident = {
  id: string; salePaymentId: string; returnedAt: string; reason: string;
  outstandingAmount: string; recoveredAmount: string; recoveryStatus: "OPEN" | "RECOVERED";
  recordedBy: { name: string };
  payment: { id: string; amount: string; chequeNumber: string | null };
  recoveries: Array<{
    id: string; method: string; amount: string; receivedAt: string;
    recordedBy: { name: string };
  }>;
};

const money = (value: string | number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
const when = (value: string) => new Date(value).toLocaleString("pt-BR");

export function ChequeReturnsPanel({
  saleId, payments, canManage, onChanged,
}: {
  saleId: string;
  payments: Payment[];
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const recoveryToken = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await fetch(`/api/sales/${saleId}/cheque-returns`, { cache: "no-store" });
    const body = await result.json();
    if (!result.ok) throw new Error(body.error ?? "Não foi possível consultar os cheques.");
    setIncidents(body.returnedCheques as Incident[]);
  }, [saleId]);

  useEffect(() => {
    let active = true;
    setIncidents([]);
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetch(`/api/sales/${saleId}/cheque-returns`, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Falha ao consultar os cheques.");
        if (active) setIncidents(body.returnedCheques as Incident[]);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Falha na consulta.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [saleId]);

  const paidCheques = payments.filter((payment) => payment.method === "CHEQUE" &&
    payment.status === "PAID" &&
    !incidents.some((incident) => incident.salePaymentId === payment.id));

  async function send(url: string, body: unknown, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível registrar a operação.");
      await refresh();
      await onChanged();
      setNotice(success);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao registrar.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function returnCheque(event: FormEvent<HTMLFormElement>, paymentId: string) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (!window.confirm("Registrar a devolução deste cheque? Isso abrirá um valor a recuperar e um estorno contábil no fluxo de caixa.")) return;
    const done = await send(`/api/sales/${saleId}/payments/${paymentId}/return`, {
      reason: String(data.get("reason") ?? ""),
      returnedAt: new Date(String(data.get("returnedAt"))).toISOString(),
    }, "Devolução registrada. O cheque permanece vinculado ao pagamento original.");
    if (done) form.reset();
  }

  async function recoverCheque(event: FormEvent<HTMLFormElement>, incident: Incident) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (!window.confirm("Confirmar o valor efetivamente recebido nesta recuperação?")) return;
    if (!recoveryToken.current) recoveryToken.current = crypto.randomUUID();
    const done = await send(
      `/api/sales/${saleId}/payments/${incident.salePaymentId}/recoveries`, {
        method: String(data.get("method")),
        amount: String(data.get("amount")),
        receivedAt: new Date(String(data.get("receivedAt"))).toISOString(),
        note: String(data.get("note") ?? "") || null,
        idempotencyKey: recoveryToken.current,
      },
      "Recuperação registrada e saldo em aberto atualizado.",
    );
    if (done) { recoveryToken.current = null; form.reset(); }
  }

  if (!loading && incidents.length === 0 && paidCheques.length === 0) return null;

  return (
    <section className="sales-cheque-panel">
      <div className="panel-heading">
        <div>
          <p className="erp-kicker">Financeiro · Cobrança</p>
          <h2>Cheques devolvidos</h2>
        </div>
      </div>
      <p className="panel-description">
        Devoluções e recuperações são registradas à parte, preservando o cheque e a conciliação bancária originais.
      </p>
      {error && <p role="alert" className="erp-alert error">{error}</p>}
      {notice && <p role="status" className="erp-alert success">{notice}</p>}
      {loading && <p className="empty-state">Consultando cheques...</p>}
      {incidents.map((incident) => (
        <div key={incident.id} className="sales-cheque-record">
          <div className="sales-cheque-summary">
            <div>
              <strong>Cheque {incident.payment.chequeNumber ?? incident.salePaymentId.slice(0, 8)}</strong>
              <small>Devolvido em {when(incident.returnedAt)} · {incident.reason}</small>
              <small>Registrado por {incident.recordedBy.name}</small>
            </div>
            <div>
              <strong>{money(incident.outstandingAmount)}</strong>
              <small>{incident.recoveryStatus === "OPEN" ? "Em aberto" : "Totalmente recuperado"}</small>
              <small>Recuperado: {money(incident.recoveredAmount)}</small>
            </div>
          </div>
          {incident.recoveries.length > 0 && <div className="sales-cheque-history">
            {incident.recoveries.map((recovery) => (
              <small key={recovery.id}>
                {when(recovery.receivedAt)} · {recovery.method} · {money(recovery.amount)} · {recovery.recordedBy.name}
              </small>
            ))}
          </div>}
          {canManage && incident.recoveryStatus === "OPEN" && (
            <form className="sales-cheque-form" onSubmit={(event) => {void recoverCheque(event, incident);}}>
              <label>Valor recebido (R$)
                <input name="amount" type="number" step=".01" min=".01"
                  max={incident.outstandingAmount} required />
              </label>
              <label>Forma
                <select name="method" defaultValue="PIX">
                  <option value="PIX">Pix</option>
                  <option value="CASH">Dinheiro</option>
                  <option value="CARD">Cartão</option>
                  <option value="TRANSFER">Transferência</option>
                </select>
              </label>
              <label>Recebido em
                <input name="receivedAt" type="datetime-local" required />
              </label>
              <label>Observação
                <input name="note" maxLength={500} placeholder="Opcional" />
              </label>
              <button className="primary-button" type="submit" disabled={busy}>
                Registrar recuperação
              </button>
            </form>
          )}
        </div>
      ))}
      {canManage && paidCheques.map((payment) => (
        <form className="sales-cheque-form sales-cheque-new" key={payment.id}
          onSubmit={(event) => {void returnCheque(event, payment.id);}}>
          <strong>Devolver cheque {payment.chequeNumber ?? payment.id.slice(0, 8)} · {money(payment.amount)}</strong>
          <label>Motivo
            <input name="reason" minLength={5} maxLength={500} required placeholder="Motivo informado pelo banco" />
          </label>
          <label>Data da devolução
            <input name="returnedAt" type="datetime-local" required />
          </label>
          <button className="secondary-button" type="submit" disabled={busy}>
            Registrar devolução
          </button>
        </form>
      ))}
    </section>
  );
}
