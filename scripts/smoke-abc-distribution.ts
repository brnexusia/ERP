import assert from "node:assert/strict";
import { db } from "../lib/db";

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";
const DAY_MS = 86_400_000;

function cookiePair(setCookie: string | null): string {
  if (!setCookie) throw new Error("Login não retornou cookie de sessão.");
  return setCookie.split(";", 1)[0];
}

async function requestJson(
  path: string,
  cookie: string,
  options: { method?: string; body?: unknown } = {},
) {
  return fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Cookie: cookie,
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: "manual",
  });
}

async function createPaidSale(
  cookie: string,
  clientId: string,
  productId: string,
  quantity: number,
  paidAt: Date,
) {
  const quote = await requestJson("/api/sales", cookie, {
    method: "POST",
    body: {
      clientId,
      channel: "WHATSAPP",
      items: [{ productId, quantity: String(quantity) }],
    },
  });
  assert.equal(quote.status, 201, `Orçamento falhou: ${quote.status}`);
  const sale = (await quote.json()).sale;
  const saleId = sale.id as string;

  const order = await requestJson(`/api/sales/${saleId}/order`, cookie, { method: "POST" });
  assert.equal(order.status, 200, `Pedido falhou: ${order.status}`);

  const payment = await requestJson(`/api/sales/${saleId}/payments`, cookie, {
    method: "POST",
    body: {
      method: "PIX",
      status: "PAID",
      amount: String(Number(sale.totalAmount)),
    },
  });
  assert.equal(payment.status, 201, `Pagamento falhou: ${payment.status}`);

  await db.sale.update({ where: { id: saleId }, data: { paidAt } });
  return saleId;
}

function reportPath(
  metric: "REVENUE" | "SOLD_QUANTITY",
  start: Date,
  end: Date,
) {
  const params = new URLSearchParams({
    metric,
    start: start.toISOString(),
    end: end.toISOString(),
  });
  return `/api/reports/products/abc-distribution?${params.toString()}`;
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
    data: {
      name: "Vendedora ABC Smoke",
      email: `abc-seller-${Date.now()}@example.test`,
    },
  });
  const sellerMembership = await db.membership.create({
    data: { organizationId: organization.id, userId: seller.id, role: "SELLER" },
  });

  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password }),
    redirect: "manual",
  });
  assert.equal(login.status, 200);
  const cookie = cookiePair(login.headers.get("set-cookie"));

  const clientIds: string[] = [];
  const productIds: string[] = [];
  const saleIds: string[] = [];
  let categoryId: string | null = null;
  let secondOrganizationId: string | null = null;

  const now = Date.now();
  const start = new Date(now - 30 * DAY_MS);
  const end = new Date(now + DAY_MS);

  try {
    const clientResponse = await requestJson("/api/clients", cookie, {
      method: "POST",
      body: {
        name: "Cliente ABC Smoke",
        document: "935.411.347-80",
        whatsapp: "5571999220001",
        email: "abc-client@example.test",
        address: {
          postalCode: "44470-000",
          street: "Rua ABC",
          number: "10",
          district: "Centro",
          city: "Vera Cruz",
          state: "BA",
          country: "BR",
        },
      },
    });
    assert.equal(clientResponse.status, 201);
    const clientId = (await clientResponse.json()).client.id as string;
    clientIds.push(clientId);

    const assignment = await requestJson(
      `/api/clients/${clientId}/responsible-seller`,
      cookie,
      { method: "PATCH", body: { membershipId: sellerMembership.id } },
    );
    assert.equal(assignment.status, 200);

    const categoryResponse = await requestJson("/api/product-categories", cookie, {
      method: "POST",
      body: { name: `ABC Smoke ${Date.now()}` },
    });
    assert.equal(categoryResponse.status, 201);
    categoryId = (await categoryResponse.json()).category.id as string;

    async function createProduct(name: string, sku: string) {
      const response = await requestJson("/api/products", cookie, {
        method: "POST",
        body: {
          name,
          sku,
          categoryId,
          brandManufacturer: "Marca ABC",
          description: "Produto para validar distribuição factual ABC.",
          costPrice: "20.00",
          salePrice: "100.00",
          unitMeasure: "UN",
          stock: { quantity: "1000", minimum: "1", maximum: "2000" },
        },
      });
      assert.equal(response.status, 201, `Produto ${name} falhou: ${response.status}`);
      const id = (await response.json()).product.id as string;
      productIds.push(id);
      return id;
    }

    const productA = await createProduct("Produto ABC A", `ABC-A-${Date.now()}`);
    const productB = await createProduct("Produto ABC B", `ABC-B-${Date.now()}`);

    saleIds.push(
      await createPaidSale(cookie, clientId, productA, 3, new Date(now - 10 * DAY_MS)),
      await createPaidSale(cookie, clientId, productB, 1, new Date(now - 5 * DAY_MS)),
      await createPaidSale(cookie, clientId, productB, 10, new Date(now - 60 * DAY_MS)),
    );

    const revenueResponse = await requestJson(reportPath("REVENUE", start, end), cookie);
    assert.equal(revenueResponse.status, 200, `Distribuição por receita falhou: ${revenueResponse.status}`);
    const revenueReport = (await revenueResponse.json()).report;
    assert.equal(revenueReport.basis, "PAID_SALES");
    assert.equal(revenueReport.metric, "REVENUE");
    assert.equal(revenueReport.classificationStatus, "PENDING_THRESHOLDS");

    const revenueById = new Map(
      revenueReport.products.map((entry: { product: { id: string } }) => [entry.product.id, entry]),
    );
    const revenueA = revenueById.get(productA) as {
      rank: number;
      selectedMetric: { value: string; sharePercent: string; cumulativeSharePercent: string };
      abcClass: string;
    };
    const revenueB = revenueById.get(productB) as {
      rank: number;
      selectedMetric: { value: string };
      abcClass: string;
    };

    assert.equal(String(revenueA.selectedMetric.value), "300");
    assert.equal(String(revenueB.selectedMetric.value), "100");
    assert.ok(revenueA.rank < revenueB.rank, "Produto com maior receita deve aparecer antes.");
    assert.equal(revenueA.abcClass, "PENDING_THRESHOLDS");
    assert.equal(revenueB.abcClass, "PENDING_THRESHOLDS");
    assert.ok(Number(revenueA.selectedMetric.sharePercent) > 0);
    assert.ok(Number(revenueA.selectedMetric.cumulativeSharePercent) > 0);

    const quantityResponse = await requestJson(reportPath("SOLD_QUANTITY", start, end), cookie);
    assert.equal(quantityResponse.status, 200, `Distribuição por quantidade falhou: ${quantityResponse.status}`);
    const quantityReport = (await quantityResponse.json()).report;
    const quantityById = new Map(
      quantityReport.products.map((entry: { product: { id: string } }) => [entry.product.id, entry]),
    );
    assert.equal(
      String((quantityById.get(productA) as { selectedMetric: { value: string } }).selectedMetric.value),
      "3",
    );
    assert.equal(
      String((quantityById.get(productB) as { selectedMetric: { value: string } }).selectedMetric.value),
      "1",
      "Venda fora do período não pode entrar na distribuição.",
    );

    const invalid = await requestJson(
      `/api/reports/products/abc-distribution?metric=REVENUE&start=${encodeURIComponent(start.toISOString())}`,
      cookie,
    );
    assert.equal(invalid.status, 400, "Período incompleto deve ser rejeitado.");

    const secondOrganization = await db.organization.create({
      data: {
        name: "ABC Second Tenant",
        slug: `abc-second-${Date.now()}`,
      },
    });
    secondOrganizationId = secondOrganization.id;
    await db.membership.create({
      data: { organizationId: secondOrganization.id, userId: admin.id, role: "ADMIN" },
    });

    const switchResponse = await requestJson("/api/auth/organization", cookie, {
      method: "POST",
      body: { organizationId: secondOrganization.id },
    });
    assert.equal(switchResponse.status, 200);

    const isolatedResponse = await requestJson(reportPath("REVENUE", start, end), cookie);
    assert.equal(isolatedResponse.status, 200);
    const isolatedReport = (await isolatedResponse.json()).report;
    assert.equal(
      isolatedReport.products.some((entry: { product: { id: string } }) => productIds.includes(entry.product.id)),
      false,
      "Distribuição ABC não pode vazar produtos entre empresas.",
    );

    console.log("✓ distribuição factual por receita e quantidade vendida usa apenas vendas PAID");
    console.log("✓ ranking e participação acumulada respeitam período explícito");
    console.log("✓ classes A/B/C permanecem pendentes sem faixas inventadas");
    console.log("✓ distribuição permanece isolada entre empresas");
  } finally {
    await db.session.deleteMany({ where: { userId: admin.id } });
    if (secondOrganizationId) {
      await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    }
    await db.sale.deleteMany({ where: { id: { in: saleIds } } });
    if (productIds.length) {
      await db.product.deleteMany({
        where: { id: { in: productIds }, organizationId: organization.id },
      });
    }
    if (categoryId) {
      await db.productCategory.deleteMany({
        where: { id: categoryId, organizationId: organization.id },
      });
    }
    await db.client.deleteMany({
      where: { id: { in: clientIds }, organizationId: organization.id },
    });
    await db.membership.deleteMany({ where: { id: sellerMembership.id } });
    await db.user.deleteMany({ where: { id: seller.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
