"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import styles from "./promotions.module.css";

type Kind = "PRODUCT" | "CATEGORY" | "PROGRESSIVE_VALUE" | "PROGRESSIVE_QUANTITY";
type Draft = {
  id: string; name: string; kind: Kind; notes: string | null;
  createdAt: string; product: { id: string; name: string; sku: string } | null;
  category: { id: string; name: string } | null;
};
type Product = { id: string; name: string; sku: string };
type Category = { id: string; name: string; parentId: string | null };
const kindNames: Record<Kind, string> = {
  PRODUCT: "Por produto", CATEGORY: "Por categoria",
  PROGRESSIVE_VALUE: "Progressiva por valor", PROGRESSIVE_QUANTITY: "Progressiva por quantidade",
};
async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    cache: "no-store", ...init, headers: {
      ...(typeof init?.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(typeof body.error === "string" ? body.error : "Operação não concluída.");
  return body as T;
}
export function PromotionsWorkspace() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ name: "", kind: "PRODUCT" as Kind, productId: "", categoryId: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      requestJson<{ drafts: Draft[] }>("/api/promotions"),
      requestJson<{ products: Product[] }>("/api/products"),
      requestJson<{ categories: Category[] }>("/api/product-categories"),
    ]);
    setDrafts(a.drafts); setProducts(b.products); setCategories(c.categories);
  }, []);
  useEffect(() => {
    let mounted = true;
    void load().catch((cause: unknown) => {
      if (mounted) setError(cause instanceof Error ? cause.message : "Falha ao carregar.");
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [load]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null); setNotice(null); setBusy(true);
    try {
      const data = {
        name: form.name,
        kind: form.kind,
        notes: form.notes || null,
        ...(form.kind === "PRODUCT" ? { productId: form.productId } : {}),
        ...(form.kind === "CATEGORY" ? { categoryId: form.categoryId } : {}),
      };
      await requestJson("/api/promotions", { method: "POST", body: JSON.stringify(data) });
      setForm({ name: "", kind: "PRODUCT", productId: "", categoryId: "", notes: "" });
      await load();
      setNotice("Rascunho registrado. Nenhuma promoção foi aplicada às vendas.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao salvar."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (busy || !window.confirm("Excluir este rascunho? Nenhuma venda será alterada.")) return;
    setError(null); setNotice(null); setBusy(true);
    try {
      await requestJson(`/api/promotions/${id}`, { method: "DELETE" });
      await load();
      setNotice("Rascunho excluído.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao excluir."); }
    finally { setBusy(false); }
  }
  return (
    <div className="erp-page">
      <header className="erp-page-header stitch-hero">
        <div><p className="erp-kicker">Administração · Promoções</p>
          <h1>Promoções</h1>
          <p>Catálogo de intenções comerciais para aprovação das regras de preço.</p></div>
      </header>
      <div className={styles.alert} role="note">
        <strong>Somente rascunhos:</strong> nenhum item desta página está ativo ou altera preços, pedidos ou descontos.
        O escopo oficial prevê promoções por produto, categoria, valor e quantidade, mas faltam fórmulas, vigência,
        prioridade, combinação e arredondamento. Essas decisões devem ser aprovadas antes da ativação.
      </div>
      {error && <div className="erp-alert error" role="alert">{error}</div>}
      {notice && <div className="erp-alert success" role="status">{notice}</div>}
      <div className="metric-grid">
        <div className="metric-card"><span>Rascunhos cadastrados</span><strong>{drafts.length}</strong></div>
        <div className="metric-card"><span>Por produto</span><strong>{drafts.filter((x) => x.kind === "PRODUCT").length}</strong></div>
        <div className="metric-card"><span>Por categoria</span><strong>{drafts.filter((x) => x.kind === "CATEGORY").length}</strong></div>
        <div className="metric-card"><span>Progressivas</span><strong>{drafts.filter((x) => x.kind.startsWith("PROGRESSIVE")).length}</strong></div>
      </div>
      <section className="erp-panel">
        <div className="panel-heading"><h2>Registrar ideia de promoção</h2></div>
        <form className={styles.form} onSubmit={(event) => void save(event)}>
          <label>Identificação<input required maxLength={160} value={form.name}
            onChange={(event) => setForm((s) => ({ ...s, name: event.target.value }))} /></label>
          <label>Tipo de promoção<select value={form.kind}
            onChange={(event) => setForm((s) => ({ ...s, kind: event.target.value as Kind, productId: "", categoryId: "" }))}>
            {Object.entries(kindNames).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select></label>
          {form.kind === "PRODUCT" && <label>Produto<select required value={form.productId}
            onChange={(event) => setForm((s) => ({ ...s, productId: event.target.value }))}>
            <option value="">Selecione o produto</option>
            {products.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}
          </select></label>}
          {form.kind === "CATEGORY" && <label>Categoria<select required value={form.categoryId}
            onChange={(event) => setForm((s) => ({ ...s, categoryId: event.target.value }))}>
            <option value="">Selecione a categoria</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>}
          <label className={styles.wide}>Observações sem efeito de cálculo<textarea maxLength={2000} rows={3}
            value={form.notes} onChange={(event) => setForm((s) => ({ ...s, notes: event.target.value }))} /></label>
          <div className={styles.actions}><button type="submit" className="primary-button" disabled={busy}>
            {busy ? "Salvando..." : "Salvar rascunho"}
          </button></div>
        </form>
      </section>
      <section className="erp-panel">
        <div className="panel-heading"><h2>Tabela de rascunhos</h2></div>
        {loading ? <p className="empty-state">Carregando...</p> : <div className="client-table-wrap">
          <table className="client-table"><thead><tr><th>Nome</th><th>Tipo</th><th>Escopo</th><th>Status</th><th>Registro</th><th>Ação</th></tr></thead>
            <tbody>{drafts.map((item) => <tr key={item.id}>
              <td><strong>{item.name}</strong>{item.notes && <small>{item.notes}</small>}</td>
              <td>{kindNames[item.kind]}</td>
              <td>{item.product ? `${item.product.name} · ${item.product.sku}` : item.category?.name ?? "Não definido"}</td>
              <td><span className="status-chip warning">Rascunho — não aplicado</span></td>
              <td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(item.createdAt))}</td>
              <td><button type="button" className="table-action" disabled={busy}
                onClick={() => void remove(item.id)}>Excluir</button></td>
            </tr>)}</tbody>
          </table>{drafts.length === 0 && <p className="empty-state">Nenhum rascunho registrado.</p>}
        </div>}
      </section>
      <p className={styles.hint}>A engine de descontos exige aprovação explícita dos critérios comerciais antes de entrar no fluxo Orçamento → Pedido → Pagamento.</p>
    </div>
  );
}
