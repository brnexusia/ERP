import assert from "node:assert/strict";
import { db } from "../lib/db";
import { updateClientCreditPolicy } from "../modules/clients/commercial-settings";

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";
const DOCUMENT = "11222333000181";

async function jsonRequest(path: string, cookie: string, method = "GET", body?: unknown) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Cookie: cookie, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  return { response, data: await response.json().catch(() => ({})) };
}

async function main() {
  const organization = await db.organization.findUniqueOrThrow({
    where: { slug: process.env.SEED_ORG_SLUG ?? "pedro-ci" },
  });
  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie);

  let representativeId: string | null = null;
  let clientId: string | null = null;
  try {
    const representative = await jsonRequest("/api/representatives", cookie, "POST", {
      name: "Representante Homologação",
      whatsapp: "5511999999999",
      commissionPercent: "5.00",
    });
    assert.equal(representative.response.status, 201);
    representativeId = representative.data.representative.id;

    const create = await jsonRequest("/api/clients", cookie, "POST", {
      name: "Cliente Júlia Etapa Um",
      document: DOCUMENT,
      whatsapp: "5511999900000",
      email: "julia-stage-one@example.test",
      instagram: "@julia_teste",
      representativeId,
      priceTableKey: "CATALOGO",
      inactivityDaysOverride: 1,
      address: {
        postalCode: "01001000",
        street: "Praça da Sé",
        number: "10",
        district: "Sé",
        city: "São Paulo",
        state: "SP",
        country: "BR",
      },
    });
    assert.equal(create.response.status, 201, JSON.stringify(create.data));
    clientId = create.data.client.id;
    assert.equal(create.data.client.representativeId, representativeId);
    assert.equal(create.data.client.instagram, "@julia_teste");
    assert.equal(create.data.client.priceTableKey, "CATALOGO");

    const policy = await jsonRequest(`/api/clients/${clientId}/credit-policy`, cookie, "PATCH", {
      creditAllowed: true,
      creditMethods: ["CHEQUE", "VALE"],
    });
    assert.equal(policy.response.status, 200);
    assert.equal(policy.data.client.creditAllowed, true);
    assert.deepEqual(policy.data.client.creditMethods, ["CHEQUE", "VALE"]);

    const invalid = await jsonRequest(`/api/clients/${clientId}/credit-policy`, cookie, "PATCH", {
      creditAllowed: false,
      creditMethods: ["CHEQUE"],
    });
    assert.equal(invalid.response.status, 400);
    await db.client.update({
      where: { id: clientId },
      data: { createdAt: new Date(Date.now() - 4 * 86_400_000) },
    });
    const alerts = await jsonRequest("/api/clients/inactivity-alerts", cookie);
    assert.equal(alerts.response.status, 200);
    assert.ok(alerts.data.inactivity.alerts.some((alert: { client: { id: string } }) => alert.client.id === clientId),
      "A configuração individual deve gerar um alerta mesmo sem compra.");

    const forbidden = await updateClientCreditPolicy(
      { organizationId: organization.id, userId: organization.id, role: "SELLER" },
      clientId,
      { creditAllowed: true, creditMethods: ["CHEQUE"] },
    ).then(() => false).catch(() => true);
    assert.equal(forbidden, true, "Vendedora não pode liberar crédito.");
    console.log("✓ Júlia módulo 1: representante, Instagram, tabela, inatividade individual e política de crédito validados");
  } finally {
    if (clientId) await db.client.deleteMany({ where: { id: clientId, organizationId: organization.id } });
    if (representativeId) await db.representative.deleteMany({ where: { id: representativeId, organizationId: organization.id } });
    await db.session.deleteMany({ where: { user: { email: process.env.SEED_ADMIN_EMAIL } } });
    await db.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
