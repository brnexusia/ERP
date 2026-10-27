import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicCatalog } from "@/modules/products/service";
import styles from "./catalog.module.css";

type Props = { params: Promise<{ token: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const catalog = await getPublicCatalog(token);
  return {
    title: catalog ? `Catálogo · ${catalog.organization.name}` : "Catálogo indisponível",
    robots: { index: false, follow: false },
  };
}

const money = (value: { toString(): string }) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value.toString()));

export default async function PublicCatalogPage({ params }: Props) {
  const { token } = await params;
  const catalog = await getPublicCatalog(token);
  if (!catalog) notFound();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo} aria-hidden="true">{catalog.organization.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <span className={styles.eyebrow}>Catálogo de produtos</span>
          <h1>{catalog.organization.name}</h1>
          <p>Consulte os produtos disponíveis para a sua escolha.</p>
        </div>
      </header>
      <section aria-label="Produtos do catálogo">
        <div className={styles.titleRow}>
          <h2>Produtos</h2>
          <span>{catalog.products.length} {catalog.products.length === 1 ? "item" : "itens"}</span>
        </div>
        {catalog.products.length === 0 ? (
          <p className={styles.empty}>Nenhum produto cadastrado neste catálogo.</p>
        ) : (
          <div className={styles.grid}>
            {catalog.products.map((product) => {
              const firstPhoto = product.photos[0];
              return (
                <article key={product.id} className={styles.card}>
                  <div className={styles.photo}>
                    {firstPhoto?.url ? (
                      // Imagens podem vir do storage público do ERP ou de URL cadastrada.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={firstPhoto.url} alt={product.name} loading="lazy" />
                    ) : <span aria-hidden="true">◇</span>}
                  </div>
                  <div className={styles.body}>
                    <span className={styles.category}>{product.category}{product.subcategory ? ` · ${product.subcategory}` : ""}</span>
                    <h3>{product.name}</h3>
                    <p className={styles.sku}>SKU: {product.sku}</p>
                    {product.description && <p className={styles.description}>{product.description}</p>}
                    <div className={styles.footer}>
                      <strong>{money(product.salePrice)}</strong>
                      <span className={product.stockAvailable ? styles.available : styles.unavailable}>
                        {product.stockAvailable ? "Em estoque" : "Indisponível"}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <footer className={styles.bottom}>Informações e disponibilidade sujeitas a confirmação com a empresa.</footer>
    </main>
  );
}
