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
  assert.equal(order.status, 200);

  const payment = await requestJson(`/api/sales/${saleId}/payments`, cookie, {
    method: "POST",
    body: {
      method: "PIX",
      status: "PAID",
      amount: String(Number(sale.totalAmount)),
    },
  });
  assert.equal(payment.status, 201);

  await db.sale.update({ where: { id: saleId }, data: { paidAt } });
  return saleId;
}

function reportPath(
  metric: "REVENUE" | "SOLD_QUANTITY" | "PAID_SALES",
  threshold: number,
  start: Date,
  end: Date,
) {
  const params = new URLSearchParams({
    metric,
    threshold: String(threshold),
    start: start.toISOString(),
    end: end.toISOString(),
  });
  return `/api/reports/products/low-output?${params.toString()}`;
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
      name: "Vendedora Low Output Smoke",
      email: `low-output-seller-${Date.now()}@example.test`,
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
  const start = new Date(now - 30 * DAY_MS);
  const end = new Date(now + DAY_MS);

  const clientIds: string[] = [];
  const productIds: string[] = [];
  const saleIds: string[] = [];
  let categoryId: string | null = null;
  let secondOrganizationId: string | null = null;

  try {
    const clientResponse = await requestJson("/api/clients", cookie, {
      method: "POST",
      body: {
        name: "Cliente Low Output Smoke",
        document: "390.533.447-05",
        whatsapp: "5571999330001",
        email: "low-output-client@example.test",
        address: {
          postalCode: "44470-000",
          street: "Rua Baixa Saída",
          number: "20",
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
      body: { name: `Low Output Smoke ${Date.now()}` },
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
          brandManufacturer: "Marca Low Output",
          description: "Produto para validar baixa saída com critério explícito.",
          costPrice: "20.00",
          salePrice: "100.00",
          unitMeasure: "UN",
          stock: { quantity: "1000", minimum: "1", maximum: "2000" },
        },
      });
      assert.equal(response.status, 201);
      const id = (await response.json()).product.id as string;
      productIds.push(id);
      return id;
    }

    const lowProduct = await createProduct("Produto Baixa Saída", `LOW-${Date.now()}`);
    const highProduct = await createProduct("Produto Alta Saída", `HIGH-${Date.now()}`);

    saleIds.push(
      await createPaidSale(cookie, clientId, lowProduct, 1, new Date(now - 5 * DAY_MS)),
      await createPaidSale(cookie, clientId, lowProduct, 10, new Date(now - 60 * DAY_MS)),
      await createPaidSale(cookie, clientId, highProduct, 1, new Date(now - 15 * DAY_MS)),
      await createPaidSale(cookie, clientId, highProduct, 1, new Date(now - 10 * DAY_MS)),
      await createPaidSale(cookie, clientId, highProduct, 1, new Date(now - 2 * DAY_MS)),
    );

    for (const [metric, threshold, lowValue, highValue] of [
      ["REVENUE", 150, "100", "300"],
      ["SOLD_QUANTITY", 2, "1", "3"],
      ["PAID_SALES", 2, "1", "3"],
    ] as const) {
      const response = await requestJson(reportPath(metric, threshold, start, end), cookie);
      assert.equal(response.status, 200, `Relatório ${metric} falhou: ${response.status}`);
      const report = (await response.json()).report;
      assert.equal(report.criteria.metric, metric);
      assert.equal(String(report.criteria.threshold), String(threshold));
      assert.equal(report.criteria.comparison, "LESS_THAN_OR_EQUAL");
      assert.equal(report.criteria.source, "EXPLICIT_REQUEST");

      const byId = new Map(
        report.products.map((entry: { product: { id: string } }) => [entry.product.id, entry]),
      );
      const low = byId.get(lowProduct) as {
        lowOutput: boolean;
        selectedMetric: { value: string };
      };
      const high = byId.get(highProduct) as {
        lowOutput: boolean;
        selectedMetric: { value: string };
      };

      assert.equal(String(low.selectedMetric.value), lowValue);
      assert.equal(String(high.selectedMetric.value), highValue);
      assert.equal(low.lowOutput, true);
      assert.equal(high.lowOutput, false);
    }

    const invalid = await requestJson(
      `/api/reports/products/low-output?metric=REVENUE&threshold=-1&start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
      cookie,
    );
    assert.equal(invalid.status, 400, "Threshold negativo deve ser rejeitado.");

    const secondOrganization = await db.organization.create({
      data: {
        name: "Low Output Second Tenant",
        slug: `low-output-second-${Date.now()}`,
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

    const isolatedResponse = await requestJson(reportPath("REVENUE", 150, start, end), cookie);
    assert.equal(isolatedResponse.status, 200);
    const isolatedReport = (await isolatedResponse.json()).report;
    assert.equal(
      isolatedReport.products.some((entry: { product: { id: string } }) => productIds.includes(entry.product.id)),
      false,
      "Relatório de baixa saída não pode vazar produtos entre empresas.",
    );

    console.log("✓ baixa saída usa apenas critério, período e métrica explicitamente informados");
    console.log("✓ receita, quantidade e número de vendas pagas são suportados sem padrão presumido");
    console.log("✓ venda fora do período não interfere no critério atual");
    console.log("✓ relatório permanece isolado entre empresas");
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
