import assert from "node:assert/strict";
import { db } from "../lib/db";

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";

function cookiePair(setCookie: string | null): string {
  if (!setCookie) throw new Error("Login não retornou cookie de sessão.");
  return setCookie.split(";", 1)[0];
}

async function requestJson(
  path: string,
  cookie: string | null,
  options: { method?: string; body?: unknown } = {},
) {
  return fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: "manual",
  });
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  if (!email || !password) throw new Error("Credenciais seed são obrigatórias.");

  const organization = await db.organization.findUnique({ where: { slug } });
  const user = await db.user.findUnique({ where: { email } });
  assert.ok(organization && user, "Seed base não encontrado.");

  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  assert.equal(login.status, 200);
  const cookie = cookiePair(login.headers.get("set-cookie"));

  let productId: string | null = null;
  let categoryId: string | null = null;
  let subcategoryId: string | null = null;
  let secondOrganizationId: string | null = null;

  try {
    const categoryResponse = await requestJson("/api/product-categories", cookie, {
      method: "POST",
      body: { name: "Acessórios Teste" },
    });
    assert.equal(categoryResponse.status, 201, `Categoria falhou: ${categoryResponse.status}`);
    categoryId = (await categoryResponse.json()).category.id;

    const subcategoryResponse = await requestJson("/api/product-categories", cookie, {
      method: "POST",
      body: { name: "Brincos Teste", parentId: categoryId },
    });
    assert.equal(subcategoryResponse.status, 201);
    subcategoryId = (await subcategoryResponse.json()).category.id;

    const productResponse = await requestJson("/api/products", cookie, {
      method: "POST",
      body: {
        name: "Brinco Produto Teste",
        sku: "ERP-TEST-001",
        barcode: "7890000000001",
        categoryId,
        subcategoryId,
        brandManufacturer: "Marca Teste",
        description: "Produto criado no smoke test do ERP.",
        technicalAttributes: { material: "metal", peso: 10, antialergico: true },
        photos: [
          { url: "https://example.test/produto.jpg" },
          { url: "https://example.test/produto-dourado.jpg", variation: "Dourado" },
        ],
        costPrice: "10.50",
        salePrice: "29.90",
        unitMeasure: "UN",
        stock: { quantity: "5", minimum: "6", maximum: "20" },
      },
    });
    assert.equal(productResponse.status, 201, `Produto falhou: ${productResponse.status}`);
    const created = (await productResponse.json()).product;
    productId = created.id;
    assert.equal(created.lowStock, true);
    assert.equal(created.photos.length, 2);
    assert.equal(created.subcategory.id, subcategoryId);

    const duplicateSku = await requestJson("/api/products", cookie, {
      method: "POST",
      body: {
        name: "Duplicado",
        sku: "ERP-TEST-001",
        categoryId,
        brandManufacturer: "Marca Teste",
        description: "Duplicado para validar conflito.",
        costPrice: "1.00",
        salePrice: "2.00",
        unitMeasure: "UN",
        stock: { quantity: "1", minimum: "0", maximum: "10" },
      },
    });
    assert.equal(duplicateSku.status, 409, "SKU duplicado deveria ser bloqueado.");

    const lowStock = await requestJson("/api/inventory/low-stock", cookie);
    assert.equal(lowStock.status, 200);
    const lowStockBody = await lowStock.json();
    assert.ok(lowStockBody.products.some((product: { id: string }) => product.id === productId));

    const stockUpdate = await requestJson(`/api/products/${productId}/stock`, cookie, {
      method: "PATCH",
      body: { quantity: "12" },
    });
    assert.equal(stockUpdate.status, 200);
    assert.equal((await stockUpdate.json()).inventory.lowStock, false);

    const catalogShareResponse = await requestJson("/api/catalog-share", cookie, { method: "POST" });
    assert.equal(catalogShareResponse.status, 200);
    const catalogShare = (await catalogShareResponse.json()).catalog;
    assert.ok(catalogShare.token);

    const publicCatalogResponse = await requestJson(`/api/catalog/${catalogShare.token}`, null);
    assert.equal(publicCatalogResponse.status, 200);
    const publicCatalog = (await publicCatalogResponse.json()).catalog;
    const publicProduct = publicCatalog.products.find((product: { id: string }) => product.id === productId);
    assert.ok(publicProduct);
    assert.equal(publicProduct.salePrice, "29.9");
    assert.equal("costPrice" in publicProduct, false, "Catálogo público não pode expor preço de custo.");
    assert.equal(publicProduct.photos.length, 2);

    const secondOrganization = await db.organization.create({
      data: { name: "Produtos CI Second", slug: `products-ci-second-${Date.now()}` },
    });
    secondOrganizationId = secondOrganization.id;
    await db.membership.create({
      data: { organizationId: secondOrganization.id, userId: user.id, role: "ADMIN" },
    });

    const switchResponse = await requestJson("/api/auth/organization", cookie, {
      method: "POST",
      body: { organizationId: secondOrganization.id },
    });
    assert.equal(switchResponse.status, 200);

    const crossTenantProduct = await requestJson(`/api/products/${productId}`, cookie);
    assert.equal(crossTenantProduct.status, 404, "Produto de outra empresa deveria retornar 404.");

    console.log("✓ categoria e subcategoria validadas");
    console.log("✓ cadastro completo de produto, fotos e variação validado");
    console.log("✓ SKU único por empresa validado");
    console.log("✓ estoque mínimo/máximo e indicador de estoque baixo validados");
    console.log("✓ catálogo automático público sem preço de custo validado");
    console.log("✓ isolamento multiempresa de produto validado");
  } finally {
    await db.session.deleteMany({ where: { userId: user.id } });
    if (secondOrganizationId) {
      await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    }
    await db.catalogShare.deleteMany({ where: { organizationId: organization.id } });
    if (productId) {
      await db.product.deleteMany({ where: { id: productId, organizationId: organization.id } });
    }
    if (subcategoryId) {
      await db.productCategory.deleteMany({ where: { id: subcategoryId, organizationId: organization.id } });
    }
    if (categoryId) {
      await db.productCategory.deleteMany({ where: { id: categoryId, organizationId: organization.id } });
    }
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
