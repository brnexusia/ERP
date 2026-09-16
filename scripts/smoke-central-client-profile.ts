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

  const seller = await db.user.create({
    data: { name: "Vendedora Central Profile Smoke", email: `central-profile-seller-${Date.now()}@example.test` },
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
  let secondOrganizationId: string | null = null;

  try {
    const clientResponse = await requestJson("/api/clients", cookie, {
      method: "POST",
      body: {
        name: "Cliente Perfil Central Smoke",
        document: "168.995.350-09",
        whatsapp: "5571999112233",
        email: "central-profile@example.test",
        address: {
          postalCode: "44470-000",
          street: "Rua Perfil Central",
          number: "50",
          district: "Centro",
          city: "Vera Cruz",
          state: "BA",
          country: "BR",
        },
      },
    });
    assert.equal(clientResponse.status, 201);
    clientId = (await clientResponse.json()).client.id;

    const assignment = await requestJson(`/api/clients/${clientId}/responsible-seller`, cookie, {
      method: "PATCH",
      body: { membershipId: sellerMembership.id },
    });
    assert.equal(assignment.status, 200);

    const creditLimit = await requestJson(`/api/clients/${clientId}/credit`, cookie, {
      method: "PATCH",
      body: { creditLimit: "500.00" },
    });
    assert.equal(creditLimit.status, 200);

    const creditMovement = await requestJson(`/api/clients/${clientId}/credit/movements`, cookie, {
      method: "POST",
      body: { amountDelta: "120.00", note: "Uso de crédito central profile smoke" },
    });
    assert.equal(creditMovement.status, 201);

    const valeMovement = await requestJson(`/api/clients/${clientId}/vale/movements`, cookie, {
      method: "POST",
      body: { amountDelta: "50.00", note: "Vale central profile smoke" },
    });
    assert.equal(valeMovement.status, 201);

    const crmResponse = await requestJson(`/api/clients/${clientId}/crm`, cookie, {
      method: "POST",
      body: {
        title: "Contato comercial",
        content: "Cliente pediu retorno sobre novos produtos.",
      },
    });
    assert.equal(crmResponse.status, 201);

    const supportResponse = await requestJson(`/api/clients/${clientId}/support`, cookie, {
      method: "POST",
      body: {
        kind: "ATTENDANCE",
        content: "Atendimento incluído no perfil central.",
      },
    });
    assert.equal(supportResponse.status, 201);

    const categoryResponse = await requestJson("/api/product-categories", cookie, {
      method: "POST",
      body: { name: "Central Profile Smoke" },
    });
    assert.equal(categoryResponse.status, 201);
    categoryId = (await categoryResponse.json()).category.id;

    const productResponse = await requestJson("/api/products", cookie, {
      method: "POST",
      body: {
        name: "Produto Perfil Central Smoke",
        sku: `CENTRAL-PROFILE-${Date.now()}`,
        categoryId,
        brandManufacturer: "Marca Central",
        description: "Produto usado para validar o perfil central do cliente.",
        costPrice: "10.00",
        salePrice: "30.00",
        unitMeasure: "UN",
        stock: { quantity: "20", minimum: "1", maximum: "50" },
      },
    });
    assert.equal(productResponse.status, 201);
    productId = (await productResponse.json()).product.id;

    const quoteResponse = await requestJson("/api/sales", cookie, {
      method: "POST",
      body: {
        clientId,
        channel: "WHATSAPP",
        items: [{ productId, quantity: "1" }],
      },
    });
    assert.equal(quoteResponse.status, 201);
    saleId = (await quoteResponse.json()).sale.id;

    const orderResponse = await requestJson(`/api/sales/${saleId}/order`, cookie, { method: "POST" });
    assert.equal(orderResponse.status, 200);

    const paymentResponse = await requestJson(`/api/sales/${saleId}/payments`, cookie, {
      method: "POST",
      body: { method: "PIX", status: "PAID", amount: "30.00" },
    });
    assert.equal(paymentResponse.status, 201);

    const profileResponse = await requestJson(`/api/clients/${clientId}/central-profile`, cookie);
    assert.equal(profileResponse.status, 200, `Perfil central falhou: ${profileResponse.status}`);
    const profile = (await profileResponse.json()).profile;

    assert.equal(profile.client.id, clientId);
    assert.equal(profile.client.responsibleSeller.id, sellerMembership.id);
    assert.equal(profile.commercial.purchaseCount, 1);
    assert.equal(String(profile.commercial.totalSpent), "30");
    assert.equal(profile.purchases.length, 1);
    assert.equal(profile.purchases[0].id, saleId);
    assert.equal(String(profile.financial.credit.creditLimit), "500");
    assert.equal(String(profile.financial.credit.usedAmount), "120");
    assert.equal(String(profile.financial.credit.availableAmount), "380");
    assert.equal(profile.financial.credit.movements.length, 1);
    assert.equal(String(profile.financial.vale.balance), "50");
    assert.equal(profile.financial.vale.movements.length, 1);
    assert.equal(profile.relationship.length, 1);
    assert.equal(profile.relationship[0].title, "Contato comercial");
    assert.equal(profile.support.length, 1);
    assert.equal(profile.support[0].kind, "ATTENDANCE");

    const secondOrganization = await db.organization.create({
      data: { name: "Central Profile CI Second", slug: `central-profile-ci-second-${Date.now()}` },
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

    const crossTenantProfile = await requestJson(`/api/clients/${clientId}/central-profile`, cookie);
    assert.equal(crossTenantProfile.status, 404, "Perfil central não pode vazar entre empresas.");

    console.log("✓ perfil central reúne cadastro, comercial, compras, crédito, vale, CRM e suporte");
    console.log("✓ dados financeiros do cliente usam as contas e movimentos reais já existentes");
    console.log("✓ histórico de compras usa somente o fluxo comercial real");
    console.log("✓ perfil central permanece isolado entre empresas");
  } finally {
    await db.session.deleteMany({ where: { userId: admin.id } });
    if (secondOrganizationId) await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    if (saleId) await db.sale.deleteMany({ where: { id: saleId } });
    if (productId) await db.product.deleteMany({ where: { id: productId, organizationId: organization.id } });
    if (categoryId) await db.productCategory.deleteMany({ where: { id: categoryId, organizationId: organization.id } });
    if (clientId) await db.client.deleteMany({ where: { id: clientId, organizationId: organization.id } });
    await db.membership.deleteMany({ where: { id: sellerMembership.id } });
    await db.user.deleteMany({ where: { id: seller.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
