import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { db } from "../lib/db";
import { hashPassword } from "../lib/auth/password";

const base = process.env.APP_URL ?? "http://127.0.0.1:3000";
async function login(email: string, password: string) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }), redirect: "manual",
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie);
  return cookie;
}
async function get(path: string, cookie?: string) {
  return fetch(base + path, { redirect: "manual", headers: cookie ? { Cookie: cookie } : {} });
}
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw Error("Credenciais de CI são obrigatórias.");

  const tenant = await db.organization.findUniqueOrThrow({
    where: { slug: process.env.SEED_ORG_SLUG ?? "pedro-ci" },
  });
  const admin = await db.user.findUniqueOrThrow({ where: { email } });
  const ownerCookie = await login(email, password);
  const ownerHash = createHash("sha256").update(ownerCookie.split("=", 2)[1]).digest("hex");
  const stamp = Date.now();
  const ids: { clients: string[]; products: string[]; categories: string[] } = {
    clients: [], products: [], categories: [],
  };
  let secondaryTenant: string | null = null;
  let sellerId: string | null = null;
  try {
    assert.equal((await get("/api/alerts")).status, 401);
    assert.ok([302, 303, 307, 308].includes((await get("/alerts")).status));
    assert.equal((await get("/alerts", ownerCookie)).status, 200);

    const alertedClient = await db.client.create({
      data: {
        organizationId: tenant.id, name: "Cliente Inativo Smoke",
        documentType: "CPF", document: `alert-${stamp}`, whatsapp: `alert-${stamp}`,
        email: `inactive-${stamp}@example.test`, inactivityDaysOverride: 1,
        createdAt: new Date(Date.now() - 4 * 86_400_000),
      },
    });
    ids.clients.push(alertedClient.id);
    const activeClient = await db.client.create({
      data: {
        organizationId: tenant.id, name: "Cliente Ativo Smoke",
        documentType: "CPF", document: `recent-${stamp}`, whatsapp: `recent-${stamp}`,
        email: `recent-${stamp}@example.test`, inactivityDaysOverride: 7,
      },
    });
    ids.clients.push(activeClient.id);

    const category = await db.productCategory.create({
      data: { organizationId: tenant.id, name: `Alerta categoria ${stamp}` },
    });
    ids.categories.push(category.id);
    const low = await db.product.create({
      data: {
        organizationId: tenant.id, categoryId: category.id, name: "Estoque Baixo Smoke",
        sku: `ALERT-LOW-${stamp}`, brandManufacturer: "Teste",
        description: "Produto temporário", costPrice: "98765.43",
        salePrice: "29.90", unitMeasure: "UN",
        stock: { create: { organizationId: tenant.id, quantity: "2", minimum: "3", maximum: "50" } },
      },
    });
    ids.products.push(low.id);
    const stocked = await db.product.create({
      data: {
        organizationId: tenant.id, categoryId: category.id, name: "Estoque Normal Smoke",
        sku: `ALERT-HIGH-${stamp}`, brandManufacturer: "Teste",
        description: "Produto temporário", costPrice: "18.50",
        salePrice: "29.90", unitMeasure: "UN",
        stock: { create: { organizationId: tenant.id, quantity: "15", minimum: "3", maximum: "50" } },
      },
    });
    ids.products.push(stocked.id);

    const second = await db.organization.create({
      data: { name: "Outro tenant de alerta", slug: `other-alert-${stamp}` },
    });
    secondaryTenant = second.id;
    await db.client.create({
      data: {
        organizationId: second.id, name: "NÃO EXIBIR CLIENTE DE OUTRA EMPRESA",
        documentType: "CPF", document: `other-${stamp}`, whatsapp: `other-${stamp}`,
        email: `other-${stamp}@example.test`, inactivityDaysOverride: 1,
        createdAt: new Date(Date.now() - 8 * 86_400_000),
      },
    });
    const secondCat = await db.productCategory.create({
      data: { organizationId: second.id, name: "Outra categoria" },
    });
    await db.product.create({
      data: {
        organizationId: second.id, categoryId: secondCat.id, name: "NÃO EXIBIR PRODUTO DE OUTRA EMPRESA",
        sku: `OTHER-${stamp}`, brandManufacturer: "Teste",
        description: "Não deve aparecer no tenant original",
        costPrice: "55555.55", salePrice: "29.90", unitMeasure: "UN",
        stock: { create: { organizationId: second.id, quantity: "1", minimum: "3", maximum: "20" } },
      },
    });

    const response = await get("/api/alerts", ownerCookie);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    const data = (await response.json()).alerts;
    assert.equal(data.permissions.clients, true);
    assert.equal(data.permissions.inventory, true);
    assert.ok(data.inactiveClients.some((v: { id: string }) => v.id === alertedClient.id));
    assert.equal(data.inactiveClients.some((v: { id: string }) => v.id === activeClient.id), false);
    assert.ok(data.lowStockProducts.some((v: { id: string }) => v.id === low.id));
    assert.equal(data.lowStockProducts.some((v: { id: string }) => v.id === stocked.id), false);
    assert.equal(data.summary.total, data.inactiveClients.length + data.lowStockProducts.length);
    const serialized = JSON.stringify(data);
    assert.ok(!JSON.stringify(data).includes("passwordHash"), "Alerta não pode divulgar hash de usuário.");
    assert.ok(!serialized.includes("NÃO EXIBIR"), "Dados de outro tenant não podem aparecer.");
    assert.ok(!serialized.includes("costPrice") && !serialized.includes("98765.43"),
      "Alertas não expõem custo de aquisição.");

    const sellerEmail = `alert-seller-${stamp}@example.test`;
    const sellerPassword = `alert-smoke-${stamp}-only`;
    const seller = await db.user.create({
      data: { name: "Vendedora Alerta", email: sellerEmail, passwordHash: await hashPassword(sellerPassword) },
    });
    sellerId = seller.id;
    await db.membership.create({
      data: { userId: seller.id, organizationId: tenant.id, role: "SELLER" },
    });
    const sellerCookie = await login(sellerEmail, sellerPassword);
    const sellerResponse = await get("/api/alerts", sellerCookie);
    assert.equal(sellerResponse.status, 200);
    const sellerPayload = await sellerResponse.text();
    assert.ok(!sellerPayload.includes("costPrice") && !sellerPayload.includes("98765.43"));
    assert.ok(sellerPayload.includes("Estoque Baixo Smoke"));

    await db.client.update({ where: { id: alertedClient.id }, data: { inactivityDaysOverride: 10 } });
    await db.productStock.update({ where: { productId: low.id }, data: { quantity: "12" } });
    const refreshed = (await (await get("/api/alerts", ownerCookie)).json()).alerts;
    assert.equal(refreshed.inactiveClients.some((v: { id: string }) => v.id === alertedClient.id), false,
      "Alerta deve desaparecer quando o limite de inatividade deixar de ser atingido.");
    assert.equal(refreshed.lowStockProducts.some((v: { id: string }) => v.id === low.id), false,
      "Alerta deve desaparecer quando o estoque for normalizado.");
    assert.equal(await db.sale.count({ where: { organizationId: tenant.id, id: "__alert_no_sale__" } }), 0);
    console.log("✓ alertas in-app de inatividade/estoque em tempo real com thresholds aprovados");
    console.log("✓ tenant isolation, role SELLER e sigilo de custo");
    console.log("✓ normalização de critérios remove alertas sem mutações comerciais");
  } finally {
    if (sellerId) {
      await db.session.deleteMany({ where: { userId: sellerId } });
      await db.membership.deleteMany({ where: { userId: sellerId } });
      await db.user.deleteMany({ where: { id: sellerId } });
    }
    if (secondaryTenant) await db.organization.deleteMany({ where: { id: secondaryTenant } });
    if (ids.products.length) await db.product.deleteMany({
      where: { organizationId: tenant.id, id: { in: ids.products } },
    });
    if (ids.categories.length) await db.productCategory.deleteMany({
      where: { organizationId: tenant.id, id: { in: ids.categories } },
    });
    if (ids.clients.length) await db.client.deleteMany({
      where: { organizationId: tenant.id, id: { in: ids.clients } },
    });
    await db.session.deleteMany({ where: { userId: admin.id, tokenHash: ownerHash } });
    await db.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
