import assert from "node:assert/strict";
import { db } from "../lib/db";

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";

function cookiePair(setCookie: string | null): string {
  if (!setCookie) throw new Error("Login não retornou cookie de sessão.");
  return setCookie.split(";", 1)[0];
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  if (!adminEmail || !password) throw new Error("Credenciais seed são obrigatórias.");

  const organization = await db.organization.findUnique({ where: { slug } });
  const admin = await db.user.findUnique({ where: { email: adminEmail } });
  assert.ok(organization && admin, "Seed base não encontrado.");

  const seller = await db.user.create({
    data: { name: "Vendedora Produto Métrica", email: `product-metric-${Date.now()}@example.test` },
  });
  const membership = await db.membership.create({
    data: { organizationId: organization.id, userId: seller.id, role: "SELLER" },
  });
  const client = await db.client.create({
    data: {
      organizationId: organization.id,
      name: "Cliente Produto Métrica",
      documentType: "CPF",
      document: `529982247${Date.now() % 100}`,
      whatsapp: "5571999991212",
      email: `product-metric-client-${Date.now()}@example.test`,
    },
  });
  const category = await db.productCategory.create({
    data: { organizationId: organization.id, name: `Categoria Métrica ${Date.now()}` },
  });
  const product = await db.product.create({
    data: {
      organizationId: organization.id,
      categoryId: category.id,
      name: "Produto Métrica",
      sku: `METRIC-${Date.now()}`,
      brandManufacturer: "Marca Métrica",
      description: "Produto usado apenas para validação do relatório.",
      costPrice: "10.00",
      salePrice: "25.00",
      unitMeasure: "UN",
      stock: {
        create: {
          organizationId: organization.id,
          quantity: "12",
          minimum: "2",
          maximum: "30",
        },
      },
    },
  });
  const paidAt = new Date();
  const sale = await db.sale.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      sellerMembershipId: membership.id,
      stage: "PAID",
      channel: "SITE",
      totalAmount: "50.00",
      orderedAt: paidAt,
      paidAt,
      items: {
        create: {
          organizationId: organization.id,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: "2",
          unitPrice: "25.00",
          lineTotal: "50.00",
        },
      },
    },
  });

  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password }),
    redirect: "manual",
  });
  assert.equal(login.status, 200);
  const cookie = cookiePair(login.headers.get("set-cookie"));

  try {
    const response = await fetch(`${BASE_URL}/api/reports/products`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    assert.equal(response.status, 200, `Relatório de produtos falhou: ${response.status}`);
    const entries = (await response.json()).report.products;
    const metric = entries.find((entry: { product: { id: string } }) => entry.product.id === product.id);
    assert.ok(metric, "Produto vendido deveria aparecer nas métricas.");
    assert.equal(String(metric.soldQuantity), "2");
    assert.equal(String(metric.revenue), "50");
    assert.equal(metric.paidSales, 1);
    assert.ok(metric.lastSaleAt);
    assert.equal(String(metric.stock.quantity), "12");

    console.log("✓ métricas reais de quantidade, faturamento e última venda por produto validadas");
  } finally {
    await db.session.deleteMany({ where: { userId: admin.id } });
    await db.sale.deleteMany({ where: { id: sale.id } });
    await db.product.deleteMany({ where: { id: product.id } });
    await db.productCategory.deleteMany({ where: { id: category.id } });
    await db.client.deleteMany({ where: { id: client.id } });
    await db.membership.deleteMany({ where: { id: membership.id } });
    await db.user.deleteMany({ where: { id: seller.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
