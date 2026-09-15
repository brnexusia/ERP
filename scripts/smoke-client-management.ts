import assert from "node:assert/strict";
import { db } from "../lib/db";

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";
const TEST_DOCUMENT = "11222333000181";

function cookiePair(setCookie: string | null): string {
  if (!setCookie) throw new Error("Login não retornou cookie de sessão.");
  return setCookie.split(";", 1)[0];
}

async function jsonRequest(
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
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD são obrigatórios.");
  }

  const organization = await db.organization.findUnique({
    where: { slug: process.env.SEED_ORG_SLUG ?? "pedro-ci" },
  });
  assert.ok(organization, "Tenant seed não encontrado.");

  const previousSettings = await db.clientModuleSettings.findUnique({
    where: { organizationId: organization.id },
  });

  let clientId: string | null = null;
  let segmentId: string | null = null;

  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  assert.equal(login.status, 200);
  const cookie = cookiePair(login.headers.get("set-cookie"));

  try {
    const createClient = await jsonRequest("/api/clients", cookie, {
      method: "POST",
      body: {
        name: "Cliente Gestão Teste",
        document: "11.222.333/0001-81",
        whatsapp: "55 71 97777-3333",
        email: "gestao@example.test",
        address: {
          postalCode: "44470-000",
          street: "Rua Gestão",
          number: "200",
          district: "Centro",
          city: "Vera Cruz",
          state: "BA",
          country: "BR",
        },
      },
    });
    assert.equal(createClient.status, 201, `Cadastro falhou: ${createClient.status}`);
    const createClientBody = await createClient.json();
    clientId = createClientBody.client.id;

    const createSegment = await jsonRequest("/api/client-segments", cookie, {
      method: "POST",
      body: { name: "Grupo A - Teste" },
    });
    assert.equal(createSegment.status, 201, `Segmento falhou: ${createSegment.status}`);
    const segmentBody = await createSegment.json();
    segmentId = segmentBody.segment.id;

    const assignSegment = await jsonRequest(`/api/clients/${clientId}/segment`, cookie, {
      method: "PATCH",
      body: { segmentId },
    });
    assert.equal(assignSegment.status, 200);
    const assigned = await assignSegment.json();
    assert.equal(assigned.client.segment.id, segmentId);

    const setLimit = await jsonRequest(`/api/clients/${clientId}/credit`, cookie, {
      method: "PATCH",
      body: { creditLimit: "1000.00" },
    });
    assert.equal(setLimit.status, 200, `Limite falhou: ${setLimit.status}`);

    const useCredit = await jsonRequest(`/api/clients/${clientId}/credit/movements`, cookie, {
      method: "POST",
      body: { amountDelta: "250.00", note: "Uso de teste" },
    });
    assert.equal(useCredit.status, 201, `Uso de crédito falhou: ${useCredit.status}`);

    const releaseCredit = await jsonRequest(`/api/clients/${clientId}/credit/movements`, cookie, {
      method: "POST",
      body: { amountDelta: "-50.00", note: "Liberação de teste" },
    });
    assert.equal(releaseCredit.status, 201);

    const excessiveCredit = await jsonRequest(`/api/clients/${clientId}/credit/movements`, cookie, {
      method: "POST",
      body: { amountDelta: "900.00" },
    });
    assert.equal(excessiveCredit.status, 422, "Crédito acima do limite deveria ser bloqueado.");

    const creditSummary = await jsonRequest(`/api/clients/${clientId}/credit`, cookie);
    assert.equal(creditSummary.status, 200);
    const creditBody = await creditSummary.json();
    assert.equal(String(creditBody.credit.creditLimit), "1000");
    assert.equal(String(creditBody.credit.usedAmount), "200");
    assert.equal(String(creditBody.credit.availableAmount), "800");
    assert.equal(creditBody.credit.movements.length, 2);

    const addVale = await jsonRequest(`/api/clients/${clientId}/vale/movements`, cookie, {
      method: "POST",
      body: { amountDelta: "150.00", note: "Crédito de vale" },
    });
    assert.equal(addVale.status, 201);

    const consumeVale = await jsonRequest(`/api/clients/${clientId}/vale/movements`, cookie, {
      method: "POST",
      body: { amountDelta: "-40.00", note: "Uso de vale" },
    });
    assert.equal(consumeVale.status, 201);

    const negativeVale = await jsonRequest(`/api/clients/${clientId}/vale/movements`, cookie, {
      method: "POST",
      body: { amountDelta: "-200.00" },
    });
    assert.equal(negativeVale.status, 422, "Vale negativo deveria ser bloqueado.");

    const valeSummary = await jsonRequest(`/api/clients/${clientId}/vale`, cookie);
    assert.equal(valeSummary.status, 200);
    const valeBody = await valeSummary.json();
    assert.equal(String(valeBody.vale.balance), "110");
    assert.equal(valeBody.vale.movements.length, 2);

    const followUpAt = "2026-09-20T15:00:00.000Z";
    const createCrm = await jsonRequest(`/api/clients/${clientId}/crm`, cookie, {
      method: "POST",
      body: {
        title: "Contato comercial",
        content: "Cliente pediu retorno.",
        followUpAt,
      },
    });
    assert.equal(createCrm.status, 201);
    const crmBody = await createCrm.json();
    const crmEntryId = crmBody.entry.id as string;

    const completeCrm = await jsonRequest(`/api/clients/${clientId}/crm/${crmEntryId}`, cookie, {
      method: "PATCH",
      body: { completedAt: "2026-09-20T16:00:00.000Z" },
    });
    assert.equal(completeCrm.status, 200);

    const crmTimeline = await jsonRequest(`/api/clients/${clientId}/crm`, cookie);
    assert.equal(crmTimeline.status, 200);
    const timelineBody = await crmTimeline.json();
    assert.equal(timelineBody.entries.length, 1);
    assert.equal(timelineBody.entries[0].title, "Contato comercial");
    assert.ok(timelineBody.entries[0].completedAt);

    const setInactivity = await jsonRequest("/api/client-settings", cookie, {
      method: "PATCH",
      body: { inactivityDays: 30 },
    });
    assert.equal(setInactivity.status, 200);

    const getInactivity = await jsonRequest("/api/client-settings", cookie);
    assert.equal(getInactivity.status, 200);
    const settingsBody = await getInactivity.json();
    assert.equal(settingsBody.settings.inactivityDays, 30);

    const auditCount = await db.auditLog.count({
      where: {
        organizationId: organization.id,
        OR: [
          { entityId: clientId },
          ...(segmentId ? [{ entityId: segmentId }] : []),
        ],
      },
    });
    assert.ok(auditCount >= 2, "Operações centrais deveriam gerar auditoria.");

    console.log("✓ segmentação de cliente validada");
    console.log("✓ limite, utilizado, disponível e histórico de crédito validados");
    console.log("✓ saldo e histórico de vale validados");
    console.log("✓ CRM, follow-up e conclusão de atividade validados");
    console.log("✓ configuração de X dias de inatividade validada");
  } finally {
    await db.session.deleteMany({ where: { user: { email } } });
    await db.client.deleteMany({
      where: { organizationId: organization.id, document: TEST_DOCUMENT },
    });
    if (segmentId) {
      await db.clientSegment.deleteMany({ where: { id: segmentId, organizationId: organization.id } });
    }
    if (previousSettings) {
      await db.clientModuleSettings.update({
        where: { organizationId: organization.id },
        data: { inactivityDays: previousSettings.inactivityDays },
      });
    } else {
      await db.clientModuleSettings.deleteMany({ where: { organizationId: organization.id } });
    }
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
