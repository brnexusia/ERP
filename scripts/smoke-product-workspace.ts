import assert from "node:assert/strict";
import { db } from "../lib/db";

const base = process.env.APP_URL ?? "http://127.0.0.1:3000";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  if (!email || !password) throw new Error("Seed obrigatória.");

  const organization = await db.organization.findUnique({ where: { slug } });
  const user = await db.user.findUnique({ where: { email } });
  assert.ok(organization && user);

  const anonymous = await fetch(`${base}/products`, { redirect: "manual" });
  assert.equal(anonymous.status, 307, "Workspace não autenticado deve redirecionar.");

  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie);
  const authed = async (path: string, init: RequestInit = {}) =>
    fetch(`${base}${path}`, { ...init, headers: { Cookie: cookie, ...init.headers } });

  // A suíte não deve apagar links públicos preexistentes de uma empresa.
  const priorShare = await db.catalogShare.findUnique({ where: { organizationId: organization.id } });
  let categoryId: string | null = null;
  let productId: string | null = null;
  const stamp = Date.now();
  try {
    const page = await authed("/products");
    assert.equal(page.status, 200, "Workspace autorizado deve carregar.");
    assert.match(await page.text(), /Produtos &(?:amp;)? Estoque/, "Título do módulo deve existir.");

    const categoryResponse = await authed("/api/product-categories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Catálogo Smoke ${stamp}` }),
    });
    assert.equal(categoryResponse.status, 201);
    categoryId = (await categoryResponse.json()).category.id as string;
    const productResponse = await authed("/api/products", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Catálogo Público de Teste", sku: `CATALOG-SMOKE-${stamp}`, categoryId,
        brandManufacturer: "Testes ERP", description: "Produto de teste do catálogo",
        costPrice: "13792.15", salePrice: "29.90", unitMeasure: "UN",
        stock: { quantity: "2", minimum: "1", maximum: "10" },
      }),
    });
    assert.equal(productResponse.status, 201);
    productId = (await productResponse.json()).product.id as string;

    const share = await authed("/api/catalog-share", { method: "POST" });
    assert.equal(share.status, 200);
    const catalog = (await share.json()).catalog as { url: string; token: string };
    assert.equal(new URL(catalog.url).pathname, `/catalog/${catalog.token}`);
    const publicPage = await fetch(catalog.url);
    assert.equal(publicPage.status, 200, "Link compartilhado deve renderizar HTML.");
    assert.match(publicPage.headers.get("content-type") ?? "", /text\/html/);
    const html = await publicPage.text();
    assert.ok(html.includes("Catálogo Público de Teste"));
    assert.ok(html.includes("29,90"), "Preço público deve aparecer.");
    assert.ok(!html.includes("13792.15"), "Custo de aquisição nunca deve ser exposto ao público.");
    assert.ok(!html.includes("costPrice"), "Campo de custo nunca deve estar no HTML público.");

    const invalid = await fetch(`${base}/catalog/token-que-nao-existe`);
    assert.equal(invalid.status, 404);
    console.log("✓ workspace autenticado e redirecionamento anônimo");
    console.log("✓ catálogo público HTML, preço de venda e link de compartilhamento");
    console.log("✓ custo privado não exposto e token inexistente com 404");
  } finally {
    await db.session.deleteMany({ where: { userId: user.id } });
    if (!priorShare) {
      await db.catalogShare.deleteMany({ where: { organizationId: organization.id } });
    }
    if (productId) await db.product.deleteMany({ where: { id: productId, organizationId: organization.id } });
    if (categoryId) await db.productCategory.deleteMany({ where: { id: categoryId, organizationId: organization.id } });
    await db.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
