"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Stage = "QUOTE" | "ORDER" | "PAID";
type Channel = "WHATSAPP" | "SITE" | "PHYSICAL_STORE";
type PaymentMethod = "PIX" | "CARD" | "BOLETO" | "CHEQUE" | "CASH" | "VALE";
type PaymentStatus = "PENDING" | "PAID";

type Sale = {
  id: string;
  stage: Stage;
  channel: Channel;
  totalAmount: string;
  createdAt: string;
  orderedAt: string | null;
  paidAt: string | null;
  clientId: string;
  sellerMembershipId: string;
  representativeId: string | null;
  representativeRate: string | null;
  client: { id: string; name: string; whatsapp?: string; priceTableKey?: string };
  seller: { id: string; user: { name: string } };
  representative: { id: string; name: string } | null;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    sku: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
  }>;
  payments: Array<{
    id: string;
    method: PaymentMethod;
    status: PaymentStatus;
    amount: string;
    dueDate: string | null;
    settledAt: string | null;
    chequeNumber: string | null;
    chequeBank: string | null;
    chequeHolder: string | null;
  }>;
};
type Client = {
  id: string;
  name: string;
  responsibleSellerMembershipId?: string | null;
  representativeId?: string | null;
};
type Product = { id: string; name: string; sku: string; salePrice: string };
type Seller = { id: string; user: { name: string } };
type Representative = { id: string; name: string };
type QuoteRow = { key: number; productId: string; quantity: string };
type Filters = Stage | "ALL";

const stageText: Record<Stage, string> = {
  QUOTE: "Orçamento",
  ORDER: "Pedido",
  PAID: "Pago",
};
const channelText: Record<Channel, string> = {
  WHATSAPP: "WhatsApp",
  SITE: "Site",
  PHYSICAL_STORE: "Loja física",
};
const methodText: Record<PaymentMethod, string> = {
  PIX: "Pix", CARD: "Cartão", BOLETO: "Boleto",
  CHEQUE: "Cheque", CASH: "Dinheiro", VALE: "Vale",
};
const emptyRow = (key: number): QuoteRow => ({ key, productId: "", quantity: "1" });
const currency = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(Number(value ?? 0));
const dateTime = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
    : "—";
const countMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const paidTotal = (sale: Sale) =>
  sale.payments.filter((payment) => payment.status === "PAID")
    .reduce((total, payment) => total + Number(payment.amount), 0);
const registeredTotal = (sale: Sale) =>
  sale.payments.reduce((total, payment) => total + Number(payment.amount), 0);
const remainingToRegister = (sale: Sale) => countMoney(Math.max(0, Number(sale.totalAmount) - registeredTotal(sale)));

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (typeof payload.error === "string" && payload.error) ||
      "Não foi possível concluir a operação.",
    );
  }
  return payload as T;
}

export function SalesWorkspace({ canWrite }: { canWrite: boolean }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filters>("ALL");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [clientId, setClientId] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [representativeId, setRepresentativeId] = useState("");
  const [channel, setChannel] = useState<Channel>("WHATSAPP");
  const [rows, setRows] = useState<QuoteRow[]>([emptyRow(0)]);
  const [keyCounter, setKeyCounter] = useState(1);
  const [editQuote, setEditQuote] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("PAID");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = sales.find((sale) => sale.id === selectedId) ?? null;
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const load = useCallback(async () => {
    const main = await requestJson<{ sales: Sale[] }>("/api/sales");
    setSales(main.sales);
    if (canWrite) {
      const metadata = await Promise.all([
        requestJson<{ clients: Client[] }>("/api/clients"),
        requestJson<{ sellers: Seller[] }>("/api/sellers"),
        requestJson<{ products: Product[] }>("/api/products"),
        requestJson<{ representatives: Representative[] }>("/api/representatives"),
      ]);
      setClients(metadata[0].clients);
      setSellers(metadata[1].sellers);
      setProducts(metadata[2].products);
      setRepresentatives(metadata[3].representatives);
    }
  }, [canWrite]);

  useEffect(() => {
    let active = true;
    const begin = async () => {
      setLoading(true);
      try {
        // This component can unmount on navigation; no background writes occur.
        if (active) await load();
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Falha ao carregar vendas.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void begin();
    return () => { active = false; };
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sales.filter((sale) =>
      (filter === "ALL" || sale.stage === filter) &&
      (!term || [sale.id, sale.client.name, sale.seller.user.name,
        ...sale.items.flatMap((item) => [item.productName, item.sku])]
        .some((value) => value.toLowerCase().includes(term))),
    );
  }, [filter, sales, search]);

  const sums = useMemo(() => ({
    quotes: sales.filter((sale) => sale.stage === "QUOTE").length,
    orders: sales.filter((sale) => sale.stage === "ORDER").length,
    paid: sales.filter((sale) => sale.stage === "PAID").length,
    revenue: sales.filter((sale) => sale.stage === "PAID")
      .reduce((total, sale) => total + Number(sale.totalAmount), 0),
  }), [sales]);

  const draftTotal = rows.reduce((total, row) =>
    total + Number(productById.get(row.productId)?.salePrice ?? 0) * Number(row.quantity || 0), 0);

  function resetDraft() {
    setRows([emptyRow(0)]);
    setKeyCounter(1);
    setClientId("");
    setSellerId("");
    setRepresentativeId("");
    setChannel("WHATSAPP");
    setEditQuote(false);
  }

  function useClient(value: string) {
    setClientId(value);
    const client = clients.find((entry) => entry.id === value);
    setSellerId(client?.responsibleSellerMembershipId ?? "");
    setRepresentativeId(client?.representativeId ?? "");
  }

  function appendRow() {
    setRows((current) => [...current, emptyRow(keyCounter)]);
    setKeyCounter((value) => value + 1);
  }

  function changeRow(key: number, prop: "productId" | "quantity", value: string) {
    setRows((current) => current.map((row) =>
      row.key === key ? { ...row, [prop]: value } : row));
  }

  function collectItems() {
    const items = rows
      .filter((row) => row.productId || row.quantity !== "1")
      .map((row) => ({ productId: row.productId, quantity: row.quantity.replace(",", ".") }));
    if (items.length === 0 || items.some((item) => !item.productId || !(Number(item.quantity) > 0))) {
      throw new Error("Selecione um produto e uma quantidade válida em cada linha.");
    }
    return items;
  }

  async function runAction(action: () => Promise<string>, fallback?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const message = await action();
      await load();
      setNotice(message || fallback || "Operação concluída.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha na operação.");
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(sale: Sale) {
    setShowCreate(false);
    setSelectedId(sale.id);
    setClientId(sale.clientId);
    setSellerId(sale.sellerMembershipId);
    setRepresentativeId(sale.representativeId ?? "");
    setChannel(sale.channel);
    setRows(sale.items.map((item, index) => ({
      key: index, productId: item.productId, quantity: String(item.quantity),
    })));
    setKeyCounter(sale.items.length);
    setEditQuote(true);
    setError(null);
  }

  async function createQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(async () => {
      if (!clientId) throw new Error("Selecione um cliente.");
      const result = await requestJson<{ sale: Sale }>("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          clientId,
          channel,
          items: collectItems(),
          ...(sellerId ? { sellerMembershipId: sellerId } : {}),
          representativeId: representativeId || null,
        }),
      });
      resetDraft();
      setSelectedId(result.sale.id);
      setShowCreate(false);
      return "Orçamento criado. Você pode conferir antes de confirmar o pedido.";
    });
  }

  async function saveQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || selected.stage !== "QUOTE") return;
    const id = selected.id;
    await runAction(async () => {
      await requestJson("/api/sales/" + id, {
        method: "PATCH",
        body: JSON.stringify({
          channel,
          items: collectItems(),
          sellerMembershipId: sellerId,
          representativeId: representativeId || null,
        }),
      });
      setEditQuote(false);
      return "Orçamento atualizado.";
    });
  }

  async function confirmSale() {
    if (!selected || !window.confirm("Confirmar este orçamento como pedido? Após confirmar, os itens não poderão ser editados.")) return;
    const id = selected.id;
    await runAction(async () => {
      await requestJson("/api/sales/" + id + "/order", { method: "POST" });
      setEditQuote(false);
      return "Pedido confirmado. Agora é possível registrar pagamentos.";
    });
  }

  async function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || selected.stage !== "ORDER") return;
    const id = selected.id;
    const form = event.currentTarget;
    const data = new FormData(form);
    const amount = String(data.get("amount") ?? "").trim().replace(",", ".");
    const due = String(data.get("dueDate") ?? "").trim();
    const supportsDue = ["BOLETO", "CHEQUE", "VALE"].includes(paymentMethod);
    if (supportsDue && paymentStatus === "PENDING" && !due) {
      setError("Informe o vencimento do pagamento pendente.");
      return;
    }
    await runAction(async () => {
      const cheque = paymentMethod === "CHEQUE" ? {
        chequeNumber: String(data.get("chequeNumber") ?? "").trim() || null,
        chequeBank: String(data.get("chequeBank") ?? "").trim() || null,
        chequeHolder: String(data.get("chequeHolder") ?? "").trim() || null,
      } : {};
      await requestJson("/api/sales/" + id + "/payments", {
        method: "POST",
        body: JSON.stringify({
          method: paymentMethod,
          status: paymentStatus,
          amount,
          ...(supportsDue && due ? { dueDate: new Date(due + "T12:00:00").toISOString() } : {}),
          ...cheque,
        }),
      });
      form.reset();
      setPaymentMethod("PIX");
      setPaymentStatus("PAID");
      return "Pagamento registrado.";
    });
  }

  async function settlePayment(paymentId: string) {
    if (!selected || !window.confirm("Confirmar a quitação desta parcela? A operação movimentará o crédito ou vale do cliente, quando aplicável.")) return;
    const saleId = selected.id;
    await runAction(async () => {
      await requestJson("/api/sales/" + saleId + "/payments/" + paymentId, {
        method: "PATCH",
        body: JSON.stringify({ status: "PAID" }),
      });
      return "Parcela quitada.";
    });
  }

  return (
    <div className="erp-page sales-page">
      <header className="erp-page-header sales-page-header">
        <div>
          <p className="erp-kicker">Operação comercial · Módulo 2</p>
          <h1>Vendas & Pedidos</h1>
          <p>Orçamentos, pedidos e pagamentos reunidos no histórico de cada cliente.</p>
        </div>
        {canWrite && (
          <button type="button" className="primary-button" onClick={() => {
            resetDraft(); setShowCreate((previous) => !previous); setError(null);
          }}>{showCreate ? "Fechar" : "+ Novo orçamento"}</button>
        )}
      </header>

      {error && <div className="erp-alert error" role="alert">{error}</div>}
      {notice && <div className="erp-alert success" role="status">{notice}</div>}

      <div className="metric-grid sales-kpis">
        <article className="metric-card"><span>Orçamentos</span><strong>{sums.quotes}</strong><small>Aguardando confirmação</small></article>
        <article className="metric-card"><span>Pedidos em aberto</span><strong>{sums.orders}</strong><small>Com pagamento pendente ou parcial</small></article>
        <article className="metric-card"><span>Pedidos pagos</span><strong>{sums.paid}</strong><small>Concluídos</small></article>
        <article className="metric-card"><span>Faturamento pago</span><strong>{currency(sums.revenue)}</strong><small>Somente pedidos quitados</small></article>
      </div>

      {canWrite && showCreate && (
        <section className="erp-panel stitch-panel">
          <div className="panel-heading"><div><p className="erp-kicker">Novo registro</p><h2>Criar orçamento</h2></div></div>
          <QuoteForm
            clientId={clientId} clients={clients} sellers={sellers} representatives={representatives}
            sellerId={sellerId} representativeId={representativeId} channel={channel}
            rows={rows} products={products} total={draftTotal} busy={busy}
            onClient={useClient} onSeller={setSellerId} onRepresentative={setRepresentativeId}
            onChannel={setChannel} onChangeRow={changeRow} onAddRow={appendRow}
            onRemoveRow={(key) => setRows((current) => current.length > 1 ? current.filter((row) => row.key !== key) : current)}
            onSubmit={createQuote}
            submitText="Criar orçamento"
          />
        </section>
      )}

      <section className="erp-panel stitch-panel">
        <div className="sales-toolbar">
          <div>
            <p className="erp-kicker">Carteira comercial</p>
            <h2>Histórico de vendas</h2>
          </div>
          <label className="search-field">
            <span aria-hidden>⌕</span>
            <input aria-label="Buscar vendas" value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cliente, produto, código ou vendedora..." />
          </label>
        </div>
        <div className="sales-tabs" role="group" aria-label="Filtrar por etapa">
          {(["ALL", "QUOTE", "ORDER", "PAID"] as Filters[]).map((status) => (
            <button key={status} type="button"
              className={filter === status ? "sales-tab active" : "sales-tab"}
              aria-pressed={filter === status}
              onClick={() => setFilter(status)}>
              {status === "ALL" ? "Todas" : stageText[status]}
            </button>
          ))}
        </div>
        {loading ? <p className="empty-state">Carregando vendas...</p> : (
          <div className="client-table-wrap">
            <table className="client-table sales-table">
              <thead><tr><th>Cliente</th><th>Registro</th><th>Vendedora</th><th>Canal</th><th>Valor</th><th>Etapa</th><th></th></tr></thead>
              <tbody>
                {filtered.map((sale) => (
                  <tr key={sale.id} className={selectedId === sale.id ? "sales-selected-row" : ""}>
                    <td><strong>{sale.client.name}</strong><small>{sale.items.length} item(ns) distintos</small></td>
                    <td>{dateTime(sale.createdAt)}</td>
                    <td>{sale.seller.user.name}</td>
                    <td>{channelText[sale.channel]}</td>
                    <td><strong>{currency(sale.totalAmount)}</strong></td>
                    <td><span className={"status-chip sales-stage-" + sale.stage.toLowerCase()}>{stageText[sale.stage]}</span></td>
                    <td><button type="button" className="table-action" onClick={() => {
                      setSelectedId(sale.id); setEditQuote(false); setShowCreate(false); setError(null);
                    }}>Detalhes →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="empty-state">Nenhuma venda encontrada.</p>}
          </div>
        )}
      </section>

      {selected && (
        <section className="erp-panel stitch-panel sales-details">
          <div className="panel-heading">
            <div>
              <p className="erp-kicker">Acompanhamento do pedido</p>
              <h2>{selected.client.name}</h2>
            </div>
            <div className="sales-detail-actions">
              <span className={"status-chip sales-stage-" + selected.stage.toLowerCase()}>{stageText[selected.stage]}</span>
              <button type="button" className="secondary-button" onClick={() => {setSelectedId(null);setEditQuote(false);}}>Fechar detalhes</button>
            </div>
          </div>
          <div className="sales-detail-meta">
            <div><span>Vendedora</span><strong>{selected.seller.user.name}</strong></div>
            <div><span>Canal</span><strong>{channelText[selected.channel]}</strong></div>
            <div><span>Representante</span><strong>{selected.representative?.name ?? "Não vinculado"}</strong></div>
            <div><span>Total</span><strong>{currency(selected.totalAmount)}</strong></div>
          </div>

          {editQuote && selected.stage === "QUOTE" && canWrite ? (
            <QuoteForm
              clientId={clientId} clients={clients} sellers={sellers} representatives={representatives}
              sellerId={sellerId} representativeId={representativeId} channel={channel}
              rows={rows} products={products} total={draftTotal} busy={busy}
              onClient={useClient} onSeller={setSellerId} onRepresentative={setRepresentativeId}
              onChannel={setChannel} onChangeRow={changeRow} onAddRow={appendRow}
              onRemoveRow={(key) => setRows((current) => current.length > 1 ? current.filter((row) => row.key !== key) : current)}
              onSubmit={saveQuote} submitText="Salvar orçamento" hideClient
            />
          ) : (
            <div className="client-table-wrap">
              <table className="client-table">
                <thead><tr><th>Produto</th><th>SKU</th><th>Quantidade</th><th>Valor unitário</th><th>Subtotal</th></tr></thead>
                <tbody>{selected.items.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.productName}</strong></td>
                    <td>{item.sku}</td><td>{String(item.quantity)}</td>
                    <td>{currency(item.unitPrice)}</td><td>{currency(item.lineTotal)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {selected.stage === "QUOTE" && canWrite && (
            <div className="sales-order-actions">
              <button className="secondary-button" type="button" disabled={busy}
                onClick={() => editQuote ? setEditQuote(false) : beginEdit(selected)}>
                {editQuote ? "Cancelar edição" : "Editar orçamento"}
              </button>
              {!editQuote && <button className="primary-button" type="button" disabled={busy} onClick={() => {void confirmSale();}}>
                Confirmar pedido
              </button>}
            </div>
          )}

          {selected.stage !== "QUOTE" && (
            <div className="sales-payment-area">
              <div className="panel-heading">
                <div><p className="erp-kicker">Financeiro comercial</p><h2>Pagamentos</h2></div>
              </div>
              <div className="sales-payment-summary">
                <div><span>Valor total</span><strong>{currency(selected.totalAmount)}</strong></div>
                <div><span>Quitado</span><strong>{currency(paidTotal(selected))}</strong></div>
                <div><span>Restante a registrar</span><strong>{currency(remainingToRegister(selected))}</strong></div>
              </div>
              <div className="client-table-wrap">
                <table className="client-table">
                  <thead><tr><th>Forma</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th></tr></thead>
                  <tbody>{selected.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td><strong>{methodText[payment.method]}</strong></td>
                      <td>{currency(payment.amount)}</td>
                      <td>{dateTime(payment.dueDate)}</td>
                      <td><span className={"status-chip " + (payment.status === "PAID" ? "success" : "warning")}>
                        {payment.status === "PAID" ? "Quitado" : "Pendente"}
                      </span></td>
                      <td>{canWrite && selected.stage === "ORDER" && payment.status === "PENDING" &&
                        <button className="table-action" type="button" disabled={busy}
                          onClick={() => {void settlePayment(payment.id);}}>Quitar</button>}</td>
                    </tr>
                  ))}</tbody>
                </table>
                {selected.payments.length === 0 && <p className="empty-state">Nenhum pagamento registrado.</p>}
              </div>

              {selected.stage === "ORDER" && canWrite && remainingToRegister(selected) > 0 && (
                <form className="sales-payment-form" onSubmit={addPayment}>
                  <div className="sales-payment-form-head"><strong>Novo pagamento</strong><span>Máximo: {currency(remainingToRegister(selected))}</span></div>
                  <label>Forma
                    <select value={paymentMethod} onChange={(event) => {setPaymentMethod(event.target.value as PaymentMethod);}}>
                      {(Object.keys(methodText) as PaymentMethod[]).map((method) => (
                        <option key={method} value={method}>{methodText[method]}</option>
                      ))}
                    </select>
                  </label>
                  <label>Valor (R$)
                    <input name="amount" type="number" min=".01" max={remainingToRegister(selected)}
                      step=".01" required defaultValue={remainingToRegister(selected).toFixed(2)} />
                  </label>
                  <label>Status
                    <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus)}>
                      <option value="PAID">Quitado</option><option value="PENDING">Pendente</option>
                    </select>
                  </label>
                  {(["BOLETO", "CHEQUE", "VALE"] as PaymentMethod[]).includes(paymentMethod) && (
                    <label>Vencimento
                      <input type="date" name="dueDate" required={paymentStatus === "PENDING"} />
                    </label>
                  )}
                  {paymentMethod === "CHEQUE" && <>
                    <label>Nº do cheque<input name="chequeNumber" maxLength={60} /></label>
                    <label>Banco<input name="chequeBank" maxLength={120} /></label>
                    <label>Titular<input name="chequeHolder" maxLength={200} /></label>
                  </>}
                  <button type="submit" className="primary-button" disabled={busy}>Registrar pagamento</button>
                  <p className="sales-payment-help">Boleto e cheque pendentes exigem crédito autorizado; vale quitado exige saldo disponível. A validação ocorre no servidor.</p>
                </form>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function QuoteForm({
  clientId, clients, sellers, representatives, sellerId, representativeId,
  channel, rows, products, total, busy,
  onClient, onSeller, onRepresentative, onChannel, onChangeRow, onAddRow, onRemoveRow,
  onSubmit, submitText, hideClient = false,
}: {
  clientId: string;
  clients: Client[];
  sellers: Seller[];
  representatives: Representative[];
  sellerId: string;
  representativeId: string;
  channel: Channel;
  rows: QuoteRow[];
  products: Product[];
  total: number;
  busy: boolean;
  onClient: (value: string) => void;
  onSeller: (value: string) => void;
  onRepresentative: (value: string) => void;
  onChannel: (value: Channel) => void;
  onChangeRow: (key: number, prop: "productId" | "quantity", value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (key: number) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  submitText: string;
  hideClient?: boolean;
}) {
  return (
    <form className="sales-quote-form" onSubmit={(event) => {void onSubmit(event);}}>
      <div className="sales-quote-fields">
        {!hideClient && <label>Cliente
          <select required value={clientId} onChange={(event) => onClient(event.target.value)}>
            <option value="">Selecionar cliente...</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>}
        <label>Vendedora
          <select required value={sellerId} onChange={(event) => onSeller(event.target.value)}>
            <option value="">Selecionar vendedora...</option>
            {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.user.name}</option>)}
          </select>
        </label>
        <label>Canal de venda
          <select value={channel} onChange={(event) => onChannel(event.target.value as Channel)}>
            {(Object.keys(channelText) as Channel[]).map((channelValue) => (
              <option key={channelValue} value={channelValue}>{channelText[channelValue]}</option>
            ))}
          </select>
        </label>
        <label>Representante (opcional)
          <select value={representativeId} onChange={(event) => onRepresentative(event.target.value)}>
            <option value="">Sem representante</option>
            {representatives.map((rep) => <option key={rep.id} value={rep.id}>{rep.name}</option>)}
          </select>
        </label>
      </div>
      <div className="sales-line-header"><strong>Produtos do orçamento</strong><span>Preços atuais do cadastro</span></div>
      <div className="sales-line-items">
        {rows.map((row) => {
          const product = products.find((item) => item.id === row.productId);
          const subtotal = Number(product?.salePrice ?? 0) * Number(row.quantity || 0);
          return (
            <div className="sales-line-item" key={row.key}>
              <label>Produto
                <select required value={row.productId} onChange={(event) => onChangeRow(row.key, "productId", event.target.value)}>
                  <option value="">Selecione um produto...</option>
                  {products.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}
                </select>
              </label>
              <label>Quantidade
                <input type="number" min=".001" max="999999999999" step=".001" required
                  value={row.quantity} onChange={(event) => onChangeRow(row.key, "quantity", event.target.value)} />
              </label>
              <div className="sales-line-subtotal"><span>Subtotal</span><strong>{currency(subtotal)}</strong></div>
              <button className="sales-remove-line" type="button" title="Remover linha" aria-label="Remover produto"
                disabled={rows.length === 1} onClick={() => onRemoveRow(row.key)}>×</button>
            </div>
          );
        })}
      </div>
      <div className="sales-quote-footer">
        <button className="secondary-button" type="button" onClick={onAddRow}>+ Adicionar produto</button>
        <div><span>Total estimado</span><strong>{currency(total)}</strong></div>
        <button className="primary-button" type="submit" disabled={busy || clients.length === 0 || products.length === 0 || sellers.length === 0}>
          {busy ? "Aguarde..." : submitText}
        </button>
      </div>
      {!hideClient && (clients.length === 0 || products.length === 0 || sellers.length === 0) &&
        <p className="sales-form-note">Cadastre ao menos um cliente, uma vendedora e um produto antes de criar o orçamento.</p>}
    </form>
  );
}
