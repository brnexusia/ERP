import assert from "node:assert/strict";
import { db } from "../lib/db";
import { hashPassword } from "../lib/auth/password";

const base = process.env.APP_URL ?? "http://127.0.0.1:3000";
async function login(email: string, password: string) {
  const response = await fetch(base + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }), redirect: "manual",
  });
  assert.equal(response.status, 200, "Falha no login: " + email);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie, "Login não retornou sessão.");
  return cookie;
}
async function json(path: string, cookie: string, method = "GET", body?: unknown) {
  const response = await fetch(base + path, {
    method, headers: { Cookie: cookie, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const payload = await response.json().catch(() => ({}));
  assert.ok(response.ok, path + " retornou HTTP " + response.status + " — " + JSON.stringify(payload));
  return payload;
}
function assertNoRates(payload: unknown, name: string) {
  const serialized = JSON.stringify(payload);
  for (const key of ["commissionPercent", "sellerCommissionRate", "representativeRate"]) {
    assert.equal(serialized.includes('"' + key + '"'), false, name + " divulgou " + key);
  }
}
async function main() {
  const ownerEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const ownerPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!ownerEmail || !ownerPassword) throw Error("Credenciais de CI são obrigatórias.");
  const tenant = await db.organization.findUniqueOrThrow({ where: { slug: process.env.SEED_ORG_SLUG ?? "pedro-ci" } });
  const stamp = Date.now().toString();
  const sellerEmail = `privacy-seller-${stamp}@example.test`;
  const sellerPassword = `seller-test-${stamp}`;
  let sellerId: string | null = null;
  let clientId: string | null = null;
  let categoryId: string | null = null;
  let productId: string | null = null;
  let representativeId: string | null = null;
  let saleId: string | null = null;
  try {
    const seller = await db.user.create({ data: {
      name: "Vendedora Sigilo Smoke", email: sellerEmail,
      passwordHash: await hashPassword(sellerPassword),
    } });
    sellerId = seller.id;
    const membership = await db.membership.create({ data: {
      organizationId: tenant.id, userId: seller.id, role: "SELLER", commissionPercent: "1.75",
    } });
    const representative = await db.representative.create({ data: {
      organizationId: tenant.id, name: "Representante Sigilo Smoke", commissionPercent: "7.25",
    } });
    representativeId = representative.id;
    const client = await db.client.create({ data: {
      organizationId: tenant.id, responsibleSellerMembershipId: membership.id, representativeId,
      name: "Cliente Sigilo Smoke", documentType: "CPF",
      document: "privacy-" + stamp, whatsapp: "privacy-" + stamp,
      email: `privacy-client-${stamp}@example.test`,
    } });
    clientId = client.id;
    const category = await db.productCategory.create({
      data: { organizationId: tenant.id, name: "Sigilo Categoria " + stamp },
    });
    categoryId = category.id;
    const product = await db.product.create({ data: {
      organizationId: tenant.id, categoryId: category.id,
      name: "Produto Sigilo", sku: "PRIVACY-" + stamp,
      brandManufacturer: "Teste", description: "Teste de sigilo de taxas",
      costPrice: "10", salePrice: "30", unitMeasure: "UN",
      stock: { create: { organizationId: tenant.id, quantity: "12", minimum: "1", maximum: "20" } },
    } });
    productId = product.id;

    const ownerCookie = await login(ownerEmail, ownerPassword);
    const created = await json("/api/sales", ownerCookie, "POST", {
      clientId, representativeId, channel: "SITE",
      items: [{ productId, quantity: "1" }],
    });
    saleId = created.sale.id;
    await json("/api/sales/" + saleId + "/order", ownerCookie, "POST");
    const adminSale = (await json("/api/sales/" + saleId, ownerCookie)).sale;
    assert.equal(String(adminSale.sellerCommissionRate), "1.75",
      "A gestão precisa manter acesso à taxa congelada da vendedora.");
    assert.equal(String(adminSale.representativeRate), "7.25",
      "A gestão precisa manter acesso à taxa do representante.");
    const adminReps = (await json("/api/representatives", ownerCookie)).representatives;
    assert.equal(String(adminReps.find((r: { id: string }) => r.id === representativeId).commissionPercent), "7.25");

    const sellerCookie = await login(sellerEmail, sellerPassword);
    for (const path of [
      "/api/representatives",
      "/api/clients",
      "/api/clients/" + clientId,
      "/api/sales",
      "/api/sales/" + saleId,
      "/api/clients/" + clientId + "/commercial-profile",
      "/api/clients/" + clientId + "/central-profile",
      "/api/sellers/" + membership.id + "/profile",
    ]) {
      assertNoRates(await json(path, sellerCookie), path);
    }
    // After settlement, the purchase history must also stay confidential.
    await json("/api/sales/" + saleId + "/payments", ownerCookie, "POST",
      { method: "PIX", amount: "30", status: "PAID" });
    assertNoRates(await json("/api/clients/" + clientId + "/purchases", sellerCookie),
      "/api/clients/:id/purchases");

    console.log("✓ seller cannot read representative, frozen seller or membership commission rates");
    console.log("✓ management retains actual commission rates for accounting");
    console.log("✓ client/representative/sales/paid purchase/profile APIs enforce the same privacy policy");
  } finally {
    if (sellerId) await db.session.deleteMany({ where: { userId: sellerId } });
    if (saleId) await db.sale.deleteMany({ where: { id: saleId } });
    if (productId) await db.product.deleteMany({ where: { id: productId } });
    if (categoryId) await db.productCategory.deleteMany({ where: { id: categoryId } });
    if (clientId) await db.client.deleteMany({ where: { id: clientId } });
    if (representativeId) await db.representative.deleteMany({ where: { id: representativeId } });
    if (sellerId) {
      await db.membership.deleteMany({ where: { userId: sellerId, organizationId: tenant.id } });
      await db.user.deleteMany({ where: { id: sellerId } });
    }
    await db.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
