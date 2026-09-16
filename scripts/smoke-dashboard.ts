import assert from "node:assert/strict";
import { db } from "../lib/db";

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";

function cookiePair(setCookie: string | null): string {
  if (!setCookie) throw new Error("Login não retornou cookie de sessão.");
  return setCookie.split(";", 1)[0];
}

async function login(email: string, password: string) {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  assert.equal(response.status, 200, `Login falhou para ${email}: ${response.status}`);
  return cookiePair(response.headers.get("set-cookie"));
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
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  if (!adminEmail || !adminPassword) throw new Error("Credenciais seed são obrigatórias.");

  const organization = await db.organization.findUnique({ where: { slug } });
  const admin = await db.user.findUnique({ where: { email: adminEmail } });
  assert.ok(organization && admin, "Seed base não encontrado.");

  const previousSettings = await db.clientModuleSettings.findUnique({
    where: { organizationId: organization.id },
  });
  const suffix = Date.now();
  const sellerEmail = `dashboard-seller-${suffix}@example.test`;
  const sellerPassword = `dashboard-${suffix}-password`;
  const adminCookie = await login(adminEmail, adminPassword);

  let sellerUserId: string | null = null;
  let sellerMembershipId: string | null = null;
  let clientId: string | null = null;
  let categoryId: string | null = null;
  let productId: string | null = null;
  let saleId: string | null = null;
  let secondOrganizationId: string | null = null;

  try {
    const sellerResponse = await requestJson("/api/users", adminCookie, {
      method: "POST",
      body: {
        name: "Vendedora Dashboard Smoke",
        email: sellerEmail,
        password: sellerPassword,
        role: "SELLER",
      },
    });
    assert.equal(sellerResponse.status, 201, `Criação da vendedora falhou: ${sellerResponse.status}`);
    const seller = (await sellerResponse.json()).user;
    sellerMembershipId = seller.id;
    sellerUserId = seller.user.id;

    const settingsResponse = await requestJson("/api/client-settings", adminCookie, {
      method: "PATCH",
      body: { inactivityDays: 1 },
    });
    assert.equal(settingsResponse.status, 200);

    const clientResponse = await requestJson("/api/clients", adminCookie, {
      method: "POST",
      body: {
        name: "Cliente Dashboard Smoke",
        document: "529.982.247-25",
        whatsapp: "5571999223344",
        email: "dashboard-client@example.test",
        address: {
          postalCode: "44470-000",
          street: "Rua Dashboard",
          number: "70",
          district: "Centro",
          city: "Vera Cruz",
          state: "BA",
          country: "BR",
        },
      },
    });
    assert.equal(clientResponse.status, 201);
    clientId = (await clientResponse.json()).client.id;

    const assignmentResponse = await requestJson(`/api/clients/${clientId}/responsible-seller`, adminCookie, {
      method: "PATCH",
      body: { membershipId: sellerMembershipId },
    });
    assert.equal(assignmentResponse.status, 200);

    const categoryResponse = await requestJson("/api/product-categories", adminCookie, {
      method: "POST",
      body: { name: `Dashboard Smoke ${suffix}` },
    });
    assert.equal(categoryResponse.status, 201);
    categoryId = (await categoryResponse.json()).category.id;

    const productResponse = await requestJson("/api/products", adminCookie, {
      method: "POST",
      body: {
        name: "Produto Dashboard Smoke",
        sku: `DASHBOARD-${suffix}`,
        categoryId,
        brandManufacturer: "Marca Dashboard",
        description: "Produto usado para validar os dados do dashboard geral.",
        costPrice: "20.00",
        salePrice: "50.00",
        unitMeasure: "UN",
        stock: { quantity: "2", minimum: "2", maximum: "20" },
      },
    });
    assert.equal(productResponse.status, 201);
    productId = (await productResponse.json()).product.id;

    const quoteResponse = await requestJson("/api/sales", adminCookie, {
      method: "POST",
      body: {
        clientId,
        channel: "SITE",
        items: [{ productId, quantity: "1" }],
      },
    });
    assert.equal(quoteResponse.status, 201);
    saleId = (await quoteResponse.json()).sale.id;

    const orderResponse = await requestJson(`/api/sales/${saleId}/order`, adminCookie, { method: "POST" });
    assert.equal(orderResponse.status, 200);

    const paymentResponse = await requestJson(`/api/sales/${saleId}/payments`, adminCookie, {
      method: "POST",
      body: { method: "PIX", status: "PAID", amount: "50.00" },
    });
    assert.equal(paymentResponse.status, 201);

    await db.sale.update({
      where: { id: saleId! },
      data: { paidAt: new Date(Date.now() - 2 * 86_400_000) },
    });

    const adminDashboardResponse = await requestJson("/api/dashboard", adminCookie);
    assert.equal(adminDashboardResponse.status, 200, `Dashboard admin falhou: ${adminDashboardResponse.status}`);
    const dashboard = (await adminDashboardResponse.json()).dashboard;
    assert.equal(dashboard.permissions.commercial, true);
    assert.equal(dashboard.permissions.clients, true);
    assert.equal(dashboard.permissions.inventory, true);
    assert.equal(dashboard.permissions.finance, true);
    assert.equal(String(dashboard.commercial.revenue), "50");
    assert.equal(dashboard.commercial.channels.SITE.sales, 1);
    assert.equal(dashboard.clients.topBuyers[0].client.id, clientId);
    assert.ok(
      dashboard.clients.inactivity.alerts.some((entry: { client: { id: string } }) => entry.client.id === clientId),
      "Cliente inativo deve aparecer no dashboard.",
    );
    assert.ok(
      dashboard.inventory.lowStock.some((entry: { id: string }) => entry.id === productId),
      "Produto em estoque baixo deve aparecer no dashboard.",
    );
    assert.equal(String(dashboard.finance.cashFlow.inflow), "50");

    const sellerCookie = await login(sellerEmail, sellerPassword);
    const sellerDashboardResponse = await requestJson("/api/dashboard", sellerCookie);
    assert.equal(sellerDashboardResponse.status, 200);
    const sellerDashboard = (await sellerDashboardResponse.json()).dashboard;
    assert.equal(sellerDashboard.permissions.commercial, true);
    assert.equal(sellerDashboard.permissions.clients, true);
    assert.equal(sellerDashboard.permissions.inventory, true);
    assert.equal(sellerDashboard.permissions.finance, false);
    assert.equal(sellerDashboard.finance, null, "Vendedora não pode receber resumo financeiro sem permissão.");

    const secondOrganization = await db.organization.create({
      data: { name: "Dashboard CI Second", slug: `dashboard-ci-second-${suffix}` },
    });
    secondOrganizationId = secondOrganization.id;
    await db.membership.create({
      data: { organizationId: secondOrganization.id, userId: admin.id, role: "ADMIN" },
    });

    const switchResponse = await requestJson("/api/auth/organization", adminCookie, {
      method: "POST",
      body: { organizationId: secondOrganization.id },
    });
    assert.equal(switchResponse.status, 200);

    const isolatedDashboardResponse = await requestJson("/api/dashboard", adminCookie);
    assert.equal(isolatedDashboardResponse.status, 200);
    const isolated = (await isolatedDashboardResponse.json()).dashboard;
    assert.equal(isolated.commercial.sales, 0);
    assert.equal(String(isolated.commercial.revenue), "0");
    assert.equal(isolated.clients.topBuyers.length, 0);
    assert.equal(isolated.inventory.lowStock.length, 0);
    assert.equal(String(isolated.finance.cashFlow.inflow), "0");

    console.log("✓ dashboard geral agrega dados comerciais, clientes, estoque e financeiro reais");
    console.log("✓ dashboard respeita permissões e omite o financeiro da vendedora");
    console.log("✓ alertas de inatividade e estoque baixo reaproveitam regras já aprovadas");
    console.log("✓ dashboard permanece isolado entre empresas");
  } finally {
    await db.session.deleteMany({ where: { userId: { in: [admin.id, ...(sellerUserId ? [sellerUserId] : [])] } } });
    if (secondOrganizationId) await db.organization.deleteMany({ where: { id: secondOrganizationId } });
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
    if (sellerMembershipId) await db.membership.deleteMany({ where: { id: sellerMembershipId } });
    if (sellerUserId) await db.user.deleteMany({ where: { id: sellerUserId } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
