"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./products.module.css";

type Category = {
  id: string;
  name: string;
  parentId: string | null;
  children: Array<{ id: string; name: string; parentId: string | null }>;
};
type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  categoryId: string;
  subcategoryId: string | null;
  category: { id: string; name: string };
  subcategory: { id: string; name: string } | null;
  brandManufacturer: string;
  description: string;
  technicalAttributes: unknown;
  costPrice?: string;
  salePrice: string;
  unitMeasure: string;
  lowStock: boolean;
  photos: Array<{ id: string; url: string; variation: string | null }>;
  stock: { quantity: string; minimum: string; maximum: string } | null;
};
type Form = {
  name: string; sku: string; barcode: string; categoryId: string; subcategoryId: string;
  brandManufacturer: string; description: string; technicalAttributes: string;
  costPrice: string; salePrice: string; unitMeasure: string;
  quantity: string; minimum: string; maximum: string;
};
const blank = (): Form => ({
  name: "", sku: "", barcode: "", categoryId: "", subcategoryId: "",
  brandManufacturer: "", description: "", technicalAttributes: "",
  costPrice: "", salePrice: "", unitMeasure: "UN",
  quantity: "0", minimum: "0", maximum: "0",
});
const money = (value: string | number | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store", ...init,
    headers: { ...(init?.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(
    typeof payload.error === "string" ? payload.error : "Falha ao executar a operação.",
  );
  return payload as T;
}

function attributesObject(raw: string): Record<string, string | number | boolean> | undefined {
  if (!raw.trim()) return undefined;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Atributos devem ser um objeto JSON válido."); }
  if (typeof parsed !== "object" || !parsed || Array.isArray(parsed)) {
    throw new Error("Atributos devem ser um objeto JSON com valores simples.");
  }
  for (const value of Object.values(parsed)) {
    if (!["string", "number", "boolean"].includes(typeof value) ||
        (typeof value === "number" && !Number.isFinite(value))) {
      throw new Error("Atributos permitem somente texto, números e verdadeiro/falso.");
    }
  }
  return parsed as Record<string, string | number | boolean>;
}

export function ProductsWorkspace({ canWrite, initialProductId }: { canWrite: boolean; initialProductId?: string | null }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialProductId ?? null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [stockForm, setStockForm] = useState({ quantity: "", minimum: "", maximum: "" });
  const [categoryName, setCategoryName] = useState("");
  const [parentCategoryId, setParentCategoryId] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [variation, setVariation] = useState("");
  const [catalogUrl, setCatalogUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [productData, categoryData] = await Promise.all([
      api<{ products: Product[] }>("/api/products"),
      api<{ categories: Category[] }>("/api/product-categories"),
    ]);
    setProducts(productData.products);
    setCategories(categoryData.categories.filter((cat) => !cat.parentId));
  }, []);

  useEffect(() => {
    let live = true;
    void reload().catch((cause: unknown) => {
      if (live) setError(cause instanceof Error ? cause.message : "Erro ao carregar o estoque.");
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [reload]);

  const selected = products.find((item) => item.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return products.filter((item) =>
      (!categoryFilter || item.categoryId === categoryFilter) &&
      (!onlyLowStock || item.lowStock) &&
      (!term || [item.name, item.sku, item.barcode, item.brandManufacturer,
        item.category.name, item.subcategory?.name]
        .some((entry) => entry?.toLocaleLowerCase("pt-BR").includes(term))),
    );
  }, [products, search, categoryFilter, onlyLowStock]);
  const lowStockCount = products.filter((item) => item.lowStock).length;
  const variants = categories.find((category) => category.id === form.categoryId)?.children ?? [];

  const update = (key: keyof Form, value: string) =>
    setForm((current) => ({ ...current, [key]: value, ...(key === "categoryId" ? { subcategoryId: "" } : {}) }));

  function openCreate() {
    setForm(blank());
    setMode("create");
    setError(null);
    setNotice(null);
  }

  function openEdit(item: Product) {
    setSelectedId(item.id);
    setForm({
      name: item.name, sku: item.sku, barcode: item.barcode ?? "",
      categoryId: item.categoryId, subcategoryId: item.subcategoryId ?? "",
      brandManufacturer: item.brandManufacturer, description: item.description,
      technicalAttributes: item.technicalAttributes && typeof item.technicalAttributes === "object"
        ? JSON.stringify(item.technicalAttributes, null, 2) : "",
      costPrice: item.costPrice ?? "", salePrice: item.salePrice, unitMeasure: item.unitMeasure,
      quantity: String(item.stock?.quantity ?? "0"),
      minimum: String(item.stock?.minimum ?? "0"),
      maximum: String(item.stock?.maximum ?? "0"),
    });
    setMode("edit");
    setError(null);
    setNotice(null);
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const attributes = attributesObject(form.technicalAttributes);
      const base = {
        name: form.name.trim(), sku: form.sku.trim(), barcode: form.barcode.trim() || null,
        categoryId: form.categoryId, subcategoryId: form.subcategoryId || null,
        brandManufacturer: form.brandManufacturer.trim(), description: form.description.trim(),
        technicalAttributes: attributes ?? (mode === "edit" ? null : undefined),
        costPrice: form.costPrice, salePrice: form.salePrice, unitMeasure: form.unitMeasure.trim(),
      };
      if (mode === "create") {
        const data = await api<{ product: Product }>("/api/products", {
          method: "POST", body: JSON.stringify({
            ...base, stock: { quantity: form.quantity, minimum: form.minimum, maximum: form.maximum },
          }),
        });
        setSelectedId(data.product.id);
        setNotice("Produto cadastrado. Você pode adicionar imagens no painel do produto.");
      } else if (mode === "edit" && selectedId) {
        await api(`/api/products/${selectedId}`, { method: "PATCH", body: JSON.stringify(base) });
        setNotice("Cadastro do produto atualizado.");
      }
      setMode(null);
      await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar o produto."); }
    finally { setBusy(false); }
  }

  async function submitStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !canWrite || busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await api(`/api/products/${selected.id}/stock`, {
        method: "PATCH", body: JSON.stringify(stockForm),
      });
      await reload();
      setNotice("Estoque atualizado manualmente. A venda não gera baixa automática enquanto a regra estiver indefinida.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao atualizar estoque."); }
    finally { setBusy(false); }
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await api("/api/product-categories", {
        method: "POST", body: JSON.stringify({ name: categoryName.trim(), parentId: parentCategoryId || null }),
      });
      setCategoryName(""); setParentCategoryId("");
      await reload();
      setNotice("Categoria criada.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao criar categoria."); }
    finally { setBusy(false); }
  }

  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !photo || !canWrite || busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const body = new FormData();
      body.set("file", photo);
      if (variation.trim()) body.set("variation", variation.trim());
      await api(`/api/products/${selected.id}/photos`, { method: "POST", body });
      setPhoto(null); setVariation("");
      await reload();
      setNotice("Imagem adicionada ao produto.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao enviar imagem."); }
    finally { setBusy(false); }
  }

  async function shareCatalog() {
    if (!canWrite || busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await api<{ catalog: { url: string } }>("/api/catalog-share", { method: "POST" });
      setCatalogUrl(result.catalog.url);
      setNotice("Link de catálogo gerado. O acesso ao link é público.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao gerar link."); }
    finally { setBusy(false); }
  }

  function pick(item: Product) {
    setSelectedId(item.id); setMode(null); setError(null); setNotice(null);
    setPhoto(null); setVariation("");
    setStockForm({
      quantity: String(item.stock?.quantity ?? "0"),
      minimum: String(item.stock?.minimum ?? "0"),
      maximum: String(item.stock?.maximum ?? "0"),
    });
  }

  return (
    <div className="erp-page">
      <header className="erp-page-header stitch-hero">
        <div><p className="erp-kicker">Operação · Estoque</p>
          <h1>Produtos &amp; Estoque</h1>
          <p>Cadastro, categorias, imagens, saldo físico e alertas de mínimo por empresa.</p>
        </div>
        <div className={styles.actions}><Link href="/products/intelligence" className="secondary-button">Inteligência de produtos</Link>
        {canWrite && <button className="primary-button" onClick={openCreate} type="button">+ Novo produto</button>}</div>
      </header>

      {error && <div className="erp-alert error" role="alert">{error}</div>}
      {notice && <div className="erp-alert success" role="status">{notice}</div>}
      <div className="metric-grid">
        <div className="metric-card"><span>Produtos cadastrados</span><strong>{products.length}</strong></div>
        <div className="metric-card"><span>Estoque baixo</span><strong>{lowStockCount}</strong></div>
        <div className="metric-card"><span>Categorias</span><strong>{categories.length}</strong></div>
        <div className="metric-card"><span>Produtos filtrados</span><strong>{filtered.length}</strong></div>
      </div>

      <section className="erp-panel">
        <div className="panel-heading"><h2>Catálogo de produtos</h2>
          {canWrite && <button type="button" className="secondary-button" disabled={busy} onClick={() => void shareCatalog()}>Gerar link público</button>}
        </div>
        {catalogUrl && <p className={styles.share}>Compartilhe com seus clientes: <a href={catalogUrl} target="_blank" rel="noopener noreferrer">{catalogUrl}</a></p>}
        {!canWrite && <p className={styles.hint}>Edição de estoque e compartilhamento disponíveis para gestão autorizada.</p>}
        <div className={styles.filters}>
          <label>Buscar produto<input value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome, SKU, marca ou código de barras" aria-label="Buscar produto" /></label>
          <label>Categoria<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">Todas</option>{categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select></label>
          <label className={styles.check}><input type="checkbox" checked={onlyLowStock}
            onChange={(event) => setOnlyLowStock(event.target.checked)} /> Somente estoque baixo</label>
        </div>
        {loading ? <p className="empty-state">Carregando produtos...</p> : (
          <div className="client-table-wrap">
            <table className="client-table">
              <thead><tr><th>Produto</th><th>Categoria</th><th>Preço de venda</th><th>Estoque</th><th>Status</th><th>Ação</th></tr></thead>
              <tbody>{filtered.map((item) => (
                <tr key={item.id}>
                  <td><div className="client-name-cell">
                    {item.photos[0]?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className={styles.thumb} src={item.photos[0].url} alt="" />
                    ) : <span className="client-avatar" aria-hidden="true">P</span>}
                    <div><strong>{item.name}</strong><small>{item.sku} · {item.brandManufacturer}</small></div>
                  </div></td>
                  <td>{item.category.name}{item.subcategory ? <small>{item.subcategory.name}</small> : null}</td>
                  <td>{money(item.salePrice)}</td>
                  <td>{item.stock?.quantity ?? "—"} {item.unitMeasure}</td>
                  <td><span className={`status-chip ${item.lowStock ? "warning" : "success"}`}>{item.lowStock ? "Estoque baixo" : "Regular"}</span></td>
                  <td><button type="button" className="table-action" onClick={() => pick(item)}>Detalhes</button></td>
                </tr>
              ))}</tbody>
            </table>
            {filtered.length === 0 && <p className="empty-state">Nenhum produto encontrado.</p>}
          </div>
        )}
      </section>

      {canWrite && <section className="erp-panel">
        <div className="panel-heading"><h2>Categorias e subcategorias</h2></div>
        <form className={styles.categoryForm} onSubmit={(event) => void submitCategory(event)}>
          <label>Nome<input required maxLength={120} value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)} placeholder="Nome da categoria" /></label>
          <label>Categoria principal<select value={parentCategoryId} onChange={(event) => setParentCategoryId(event.target.value)}>
            <option value="">Nova categoria principal</option>
            {categories.map((cat) => <option key={cat.id} value={cat.id}>Subcategoria de {cat.name}</option>)}
          </select></label>
          <button className="secondary-button" type="submit" disabled={busy}>Adicionar</button>
        </form>
      </section>}

      {mode && canWrite && <section className="erp-panel">
        <div className="panel-heading"><h2>{mode === "create" ? "Cadastrar produto" : "Editar produto"}</h2>
          <button className="text-button" type="button" onClick={() => setMode(null)}>Fechar</button></div>
        <form className={styles.form} onSubmit={(event) => void submitProduct(event)}>
          <label>Nome *<input required maxLength={200} value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
          <label>SKU *<input required maxLength={120} value={form.sku} onChange={(event) => update("sku", event.target.value)} /></label>
          <label>Código de barras<input maxLength={120} value={form.barcode} onChange={(event) => update("barcode", event.target.value)} /></label>
          <label>Marca / fabricante *<input required maxLength={200} value={form.brandManufacturer} onChange={(event) => update("brandManufacturer", event.target.value)} /></label>
          <label>Categoria *<select required value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}>
            <option value="">Selecione</option>{categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select></label>
          <label>Subcategoria<select value={form.subcategoryId} onChange={(event) => update("subcategoryId", event.target.value)}>
            <option value="">Sem subcategoria</option>{variants.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select></label>
          <label>Preço de custo (R$) *<input required inputMode="decimal" value={form.costPrice} onChange={(event) => update("costPrice", event.target.value)} /></label>
          <label>Preço de venda (R$) *<input required inputMode="decimal" value={form.salePrice} onChange={(event) => update("salePrice", event.target.value)} /></label>
          <label>Unidade de medida *<input required maxLength={40} value={form.unitMeasure} onChange={(event) => update("unitMeasure", event.target.value)} /></label>
          {mode === "create" && <>
            <label>Estoque atual *<input required inputMode="decimal" value={form.quantity} onChange={(event) => update("quantity", event.target.value)} /></label>
            <label>Estoque mínimo *<input required inputMode="decimal" value={form.minimum} onChange={(event) => update("minimum", event.target.value)} /></label>
            <label>Estoque máximo *<input required inputMode="decimal" value={form.maximum} onChange={(event) => update("maximum", event.target.value)} /></label>
          </>}
          <label className={styles.wide}>Descrição *<textarea required rows={3} maxLength={10000} value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
          <label className={styles.wide}>Atributos técnicos (JSON opcional)<textarea rows={3} value={form.technicalAttributes} onChange={(event) => update("technicalAttributes", event.target.value)} placeholder='{"material":"metal","antialergico":true}' /></label>
          <div className={styles.actions}><button type="button" className="secondary-button" onClick={() => setMode(null)}>Cancelar</button>
            <button type="submit" className="primary-button" disabled={busy}>{busy ? "Salvando..." : "Salvar produto"}</button></div>
        </form>
      </section>}

      {selected && !mode && <section className="erp-panel">
        <div className="panel-heading"><h2>Produto · {selected.name}</h2>
          <div className={styles.actions}>
            {canWrite && <button type="button" className="secondary-button" onClick={() => openEdit(selected)}>Editar cadastro</button>}
            <button type="button" className="text-button" onClick={() => setSelectedId(null)}>Fechar</button>
          </div>
        </div>
        <dl className={styles.details}>
          <div><dt>SKU</dt><dd>{selected.sku}</dd></div>
          <div><dt>Código de barras</dt><dd>{selected.barcode ?? "—"}</dd></div>
          <div><dt>Categoria</dt><dd>{selected.category.name}{selected.subcategory ? ` / ${selected.subcategory.name}` : ""}</dd></div>
          <div><dt>Fabricante</dt><dd>{selected.brandManufacturer}</dd></div>
          <div><dt>Preço de venda</dt><dd>{money(selected.salePrice)}</dd></div>
          {canWrite && selected.costPrice !== undefined && <div><dt>Preço de custo</dt><dd>{money(selected.costPrice)}</dd></div>}
        </dl>
        <p className={styles.description}>{selected.description}</p>
        {selected.technicalAttributes != null && <pre className={styles.attributes}>{JSON.stringify(selected.technicalAttributes, null, 2)}</pre>}
        {selected.photos.length > 0 && <div className={styles.photos}>{selected.photos.map((item) => (
          <figure key={item.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt={item.variation ? `${selected.name}, ${item.variation}` : selected.name} />
            <figcaption>{item.variation ?? "Produto"}</figcaption>
          </figure>
        ))}</div>}
        {canWrite && <>
          <div className={styles.divider} />
          <h3>Atualizar estoque físico</h3>
          <p className={styles.hint}>Atualização manual e auditada. Não configura baixa automática por venda.</p>
          <form className={styles.stockForm} onSubmit={(event) => void submitStock(event)}>
            {(["quantity", "minimum", "maximum"] as const).map((key) => (
              <label key={key}>{({ quantity: "Quantidade", minimum: "Mínimo", maximum: "Máximo" })[key]}
                <input required inputMode="decimal" value={stockForm[key]}
                  onChange={(event) => setStockForm((value) => ({ ...value, [key]: event.target.value }))} /></label>
            ))}
            <button type="submit" className="secondary-button" disabled={busy}>Salvar estoque</button>
          </form>
          <div className={styles.divider} />
          <h3>Adicionar imagem</h3>
          <form className={styles.stockForm} onSubmit={(event) => void uploadPhoto(event)}>
            <label>Arquivo de imagem<input type="file" required accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></label>
            <label>Variação (opcional)<input maxLength={120} value={variation} onChange={(event) => setVariation(event.target.value)} /></label>
            <button type="submit" className="secondary-button" disabled={!photo || busy}>Enviar imagem</button>
          </form>
        </>}
      </section>}
    </div>
  );
}
