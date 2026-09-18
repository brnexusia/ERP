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

async function createClient(
  cookie: string,
  name: string,
  document: string,
  email: string,
  whatsapp: string,
) {
  const response = await requestJson("/api/clients", cookie, {
    method: "POST",
    body: {
      name,
      document,
      whatsapp,
      email,
      address: {
        postalCode: "44470-000",
        street: "Rua Comparação",
        number: "100",
        district: "Centro",
        city: "Vera Cruz",
        state: "BA",
        country: "BR",
      },
    },
  });
  assert.equal(response.status, 201, `Falha ao criar ${name}: ${response.status}`);
  return (await response.json()).client.id as string;
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

function comparisonPath(args: {
  metric: "REVENUE" | "PURCHASES";
  previousStart: Date;
  previousEnd: Date;
  currentStart: Date;
  currentEnd: Date;
}) {
  const params = new URLSearchParams({
    metric: args.metric,
    previousStart: args.previousStart.toISOString(),
    previousEnd: args.previousEnd.toISOString(),
    currentStart: args.currentStart.toISOString(),
    currentEnd: args.currentEnd.toISOString(),
  });
  return `/api/reports/clients/purchase-comparison?${params.toString()}`;
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
      name: "Vendedora Purchase Comparison Smoke",
      email: `purchase-comparison-seller-${Date.now()}@example.test`,
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

  const now = Date.now();
  const previousStart = new Date(now - 60 * DAY_MS);
  const previousEnd = new Date(now - 31 * DAY_MS);
  const currentStart = new Date(now - 30 * DAY_MS);
  const currentEnd = new Date(now + DAY_MS);

  const clientIds: string[] = [];
  const saleIds: string[] = [];
  let categoryId: string | null = null;
  let productId: string | null = null;
  let secondOrganizationId: string | null = null;

  try {
    const reducedClient = await createClient(
      cookie,
      "Cliente Compra Reduzida",
      "390.533.447-05",
      "purchase-reduced@example.test",
      "5571999110001",
    );
    const increasedClient = await createClient(
      cookie,
      "Cliente Compra Aumentada",
      "529.982.247-25",
      "purchase-increased@example.test",
      "5571999110002",
    );
    const unchangedClient = await createClient(
      cookie,
      "Cliente Compra Sem Mudança",
      "111.444.777-35",
      "purchase-unchanged@example.test",
      "5571999110003",
    );
    clientIds.push(reducedClient, increasedClient, unchangedClient);

    for (const clientId of clientIds) {
      const assignment = await requestJson(
        `/api/clients/${clientId}/responsible-seller`,
        cookie,
        { method: "PATCH", body: { membershipId: sellerMembership.id } },
      );
      assert.equal(assignment.status, 200);
    }

    const categoryResponse = await requestJson("/api/product-categories", cookie, {
      method: "POST",
      body: { name: "Purchase Comparison Smoke" },
    });
    assert.equal(categoryResponse.status, 201);
    categoryId = (await categoryResponse.json()).category.id;

    const productResponse = await requestJson("/api/products", cookie, {
      method: "POST",
      body: {
        name: "Produto Purchase Comparison Smoke",
        sku: `PURCHASE-COMPARISON-${Date.now()}`,
        categoryId,
        brandManufacturer: "Marca Purchase Comparison",
        description: "Produto para validar comparação factual de compras.",
        costPrice: "10.00",
        salePrice: "50.00",
        unitMeasure: "UN",
        stock: { quantity: "1000", minimum: "1", maximum: "2000" },
      },
    });
    assert.equal(productResponse.status, 201);
    productId = (await productResponse.json()).product.id;

    saleIds.push(
      await createPaidSale(cookie, reducedClient, productId, 2, new Date(now - 50 * DAY_MS)),
      await createPaidSale(cookie, reducedClient, productId, 2, new Date(now - 40 * DAY_MS)),
      await createPaidSale(cookie, reducedClient, productId, 1, new Date(now - 10 * DAY_MS)),
      await createPaidSale(cookie, increasedClient, productId, 1, new Date(now - 45 * DAY_MS)),
      await createPaidSale(cookie, increasedClient, productId, 1, new Date(now - 20 * DAY_MS)),
      await createPaidSale(cookie, increasedClient, productId, 1, new Date(now - 5 * DAY_MS)),
    );

    const revenueResponse = await requestJson(
      comparisonPath({
        metric: "REVENUE",
        previousStart,
        previousEnd,
        currentStart,
        currentEnd,
      }),
      cookie,
    );
    assert.equal(revenueResponse.status, 200, `Comparação por receita falhou: ${revenueResponse.status}`);
    const revenueReport = (await revenueResponse.json()).report;
    assert.equal(revenueReport.basis, "PAID_SALES");
    assert.equal(revenueReport.metric, "REVENUE");

    const revenueById = new Map(
      revenueReport.clients.map((entry: { client: { id: string } }) => [entry.client.id, entry]),
    );

    const reduced = revenueById.get(reducedClient) as {
      previous: { purchases: number; revenue: string };
      current: { purchases: number; revenue: string };
      selectedMetric: {
        direction: string;
        reduced: boolean;
        previousValue: string;
        currentValue: string;
        percentChange: string | null;
      };
    };
    assert.equal(reduced.previous.purchases, 2);
    assert.equal(reduced.current.purchases, 1);
    assert.equal(String(reduced.previous.revenue), "200");
    assert.equal(String(reduced.current.revenue), "50");
    assert.equal(reduced.selectedMetric.direction, "REDUCED");
    assert.equal(reduced.selectedMetric.reduced, true);
    assert.equal(String(reduced.selectedMetric.previousValue), "200");
    assert.equal(String(reduced.selectedMetric.currentValue), "50");
    assert.equal(String(reduced.selectedMetric.percentChange), "-75");

    const increased = revenueById.get(increasedClient) as {
      selectedMetric: { direction: string; reduced: boolean };
    };
    assert.equal(increased.selectedMetric.direction, "INCREASED");
    assert.equal(increased.selectedMetric.reduced, false);

    const unchanged = revenueById.get(unchangedClient) as {
      selectedMetric: { direction: string; reduced: boolean; percentChange: string | null };
    };
    assert.equal(unchanged.selectedMetric.direction, "UNCHANGED");
    assert.equal(unchanged.selectedMetric.reduced, false);
    assert.equal(unchanged.selectedMetric.percentChange, null);
    assert.ok(revenueReport.summary.reduced >= 1);
    assert.ok(revenueReport.summary.increased >= 1);

    const purchaseResponse = await requestJson(
      comparisonPath({
        metric: "PURCHASES",
        previousStart,
        previousEnd,
        currentStart,
        currentEnd,
      }),
      cookie,
    );
    assert.equal(purchaseResponse.status, 200, `Comparação por compras falhou: ${purchaseResponse.status}`);
    const purchaseReport = (await purchaseResponse.json()).report;
    const purchaseById = new Map(
      purchaseReport.clients.map((entry: { client: { id: string } }) => [entry.client.id, entry]),
    );
    assert.equal(
      (purchaseById.get(reducedClient) as { selectedMetric: { direction: string } }).selectedMetric.direction,
      "REDUCED",
    );
    assert.equal(
      (purchaseById.get(increasedClient) as { selectedMetric: { direction: string } }).selectedMetric.direction,
      "INCREASED",
    );

    const invalid = await requestJson(
      `/api/reports/clients/purchase-comparison?metric=REVENUE&previousStart=${encodeURIComponent(previousStart.toISOString())}`,
      cookie,
    );
    assert.equal(invalid.status, 400, "Períodos incompletos devem ser rejeitados.");

    const secondOrganization = await db.organization.create({
      data: {
        name: "Purchase Comparison Second Tenant",
        slug: `purchase-comparison-second-${Date.now()}`,
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

    const isolatedResponse = await requestJson(
      comparisonPath({
        metric: "REVENUE",
        previousStart,
        previousEnd,
        currentStart,
        currentEnd,
      }),
      cookie,
    );
    assert.equal(isolatedResponse.status, 200);
    const isolatedReport = (await isolatedResponse.json()).report;
    assert.equal(
      isolatedReport.clients.some((entry: { client: { id: string } }) => clientIds.includes(entry.client.id)),
      false,
      "Comparação não pode vazar clientes entre empresas.",
    );

    console.log("✓ comparação usa exclusivamente vendas PAID e períodos explícitos");
    console.log("✓ redução/aumento é factual para receita ou quantidade de compras escolhida");
    console.log("✓ períodos inválidos/incompletos são rejeitados");
    console.log("✓ comparação permanece isolada entre empresas");
  } finally {
    await db.session.deleteMany({ where: { userId: admin.id } });
    if (secondOrganizationId) {
      await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    }
    await db.sale.deleteMany({ where: { id: { in: saleIds } } });
    if (productId) {
      await db.product.deleteMany({
        where: { id: productId, organizationId: organization.id },
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
