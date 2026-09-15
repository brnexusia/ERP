import assert from "node:assert/strict";
import { db } from "../lib/db";

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";

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

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  if (!adminEmail || !password) throw new Error("Credenciais seed são obrigatórias.");

  const organization = await db.organization.findUnique({ where: { slug } });
  const admin = await db.user.findUnique({ where: { email: adminEmail } });
  assert.ok(organization && admin, "Seed base não encontrado.");

  const previousSettings = await db.clientModuleSettings.findUnique({
    where: { organizationId: organization.id },
  });

  const seller = await db.user.create({
    data: { name: "Vendedora Reports Smoke", email: `seller-reports-${Date.now()}@example.test` },
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

  let clientId: string | null = null;
  let categoryId: string | null = null;
  let productId: string | null = null;
  let saleId: string | null = null;

  try {
    const settingsResponse = await requestJson("/api/client-settings", cookie, {
      method: "PATCH",
      body: { inactivityDays: 1 },
    });
    assert.equal(settingsResponse.status, 200);

    const clientResponse = await requestJson("/api/clients", cookie, {
      method: "POST",
      body: {
        name: "Cliente Reports Smoke",
        document: "390.533.447-05",
        whatsapp: "55 71 95555-1111",
        email: "cliente-reports@example.test",
        address: {
          postalCode: "44470-000",
          street: "Rua Reports",
          number: "20",
          district: "Centro",
          city: "Vera Cruz",
          state: "BA",
          country: "BR",
        },
      },
    });
    assert.equal(clientResponse.status, 201);
    clientId = (await clientResponse.json()).client.id;

    const assignmentResponse = await requestJson(`/api/clients/${clientId}/responsible-seller`, cookie, {
      method: "PATCH",
      body: { membershipId: sellerMembership.id },
    });
    assert.equal(assignmentResponse.status, 200);

    const categoryResponse = await requestJson("/api/product-categories", cookie, {
      method: "POST",
      body: { name: "Brincos Reports Smoke" },
    });
    assert.equal(categoryResponse.status, 201);
    categoryId = (await categoryResponse.json()).category.id;

    const productResponse = await requestJson("/api/products", cookie, {
      method: "POST",
      body: {
        name: "Brinco Reports Smoke",
        sku: "REPORT-SMOKE-001",
        categoryId,
        brandManufacturer: "Marca Reports",
        description: "Produto para validar relatórios comerciais.",
        costPrice: "8.00",
        salePrice: "40.00",
        unitMeasure: "UN",
        stock: { quantity: "20", minimum: "2", maximum: "50" },
      },
    });
    assert.equal(productResponse.status, 201);
    productId = (await productResponse.json()).product.id;

    const quoteResponse = await requestJson("/api/sales", cookie, {
      method: "POST",
      body: { clientId, channel: "WHATSAPP", items: [{ productId, quantity: "1" }] },
    });
    assert.equal(quoteResponse.status, 201);
    saleId = (await quoteResponse.json()).sale.id;

    const orderResponse = await requestJson(`/api/sales/${saleId}/order`, cookie, { method: "POST" });
    assert.equal(orderResponse.status, 200);

    const paymentResponse = await requestJson(`/api/sales/${saleId}/payments`, cookie, {
      method: "POST",
      body: { method: "PIX", status: "PAID", amount: "40.00" },
    });
    assert.equal(paymentResponse.status, 201);
    assert.equal((await paymentResponse.json()).result.sale.stage, "PAID");

    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
    await db.sale.update({
      where: { id: saleId! },
      data: { paidAt: twoDaysAgo },
    });

    const profileResponse = await requestJson(`/api/clients/${clientId}/commercial-profile`, cookie);
    assert.equal(profileResponse.status, 200, `Perfil comercial falhou: ${profileResponse.status}`);
    const profile = (await profileResponse.json()).profile;
    assert.equal(profile.commercial.purchaseCount, 1);
    assert.equal(profile.commercial.customerType, "NEW");
    assert.equal(String(profile.commercial.totalSpent), "40");
    assert.equal(profile.commercial.inactivityAlert, true);
    assert.equal(profile.commercial.predominantCategories[0].categoryName, "Brincos Reports Smoke");
    assert.equal(profile.commercial.paymentMethods[0].method, "PIX");

    const inactivityResponse = await requestJson("/api/clients/inactivity-alerts", cookie);
    assert.equal(inactivityResponse.status, 200);
    const inactivity = (await inactivityResponse.json()).inactivity;
    assert.equal(inactivity.inactivityDays, 1);
    assert.ok(inactivity.alerts.some((entry: { client: { id: string } }) => entry.client.id === clientId));

    const reportResponse = await requestJson(
      "/api/reports/commercial?start=2026-01-01T00%3A00%3A00.000Z&end=2027-01-01T00%3A00%3A00.000Z",
      cookie,
    );
    assert.equal(reportResponse.status, 200, `Relatório comercial falhou: ${reportResponse.status}`);
    const report = (await reportResponse.json()).report;
    assert.equal(report.sales, 1);
    assert.equal(String(report.revenue), "40");
    assert.equal(String(report.averageTicket), "40");
    assert.equal(report.channels.WHATSAPP.sales, 1);
    assert.equal(report.sellers[0].membershipId, sellerMembership.id);
    assert.equal(report.sellers[0].clients, 1);
    assert.equal(String(report.ticketByClientAge.newClients.averageTicket), "40");

    console.log("✓ perfil comercial do cliente validado");
    console.log("✓ categoria predominante e histórico de pagamento validados");
    console.log("✓ alerta automático por X dias sem compra validado");
    console.log("✓ faturamento, ticket médio, canal e performance por vendedora validados");
  } finally {
    await db.session.deleteMany({ where: { userId: admin.id } });
    if (saleId) await db.sale.deleteMany({ where: { id: saleId } });
    if (productId) await db.product.deleteMany({ where: { id: productId, organizationId: organization.id } });
    if (categoryId) await db.productCategory.deleteMany({ where: { id: categoryId, organizationId: organization.id } });
    if (clientId) await db.client.deleteMany({ where: { id: clientId, organizationId: organization.id } });
    if (previousSettings) {
      await db.clientModuleSettings.update({
        where: { organizationId: organization.id },
        data: { inactivityDays: previousSettings.inactivityDays },
      });
    } else {
      await db.clientModuleSettings.deleteMany({ where: { organizationId: organization.id } });
    }
    await db.membership.deleteMany({ where: { id: sellerMembership.id } });
    await db.user.deleteMany({ where: { id: seller.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
