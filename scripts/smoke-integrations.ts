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

  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password }),
    redirect: "manual",
  });
  assert.equal(login.status, 200);
  const cookie = cookiePair(login.headers.get("set-cookie"));

  const keys = [
    ["VAXCHAT", "primary", "VaxChat"],
    ["VAXLAB", "primary", "VaxLab"],
    ["GOPAGE", "primary", "GoPage"],
    ["SHOPVAX", "primary", "ShopVax"],
    ["WHATSAPP", "primary", "WhatsApp"],
    ["PAYMENT_GATEWAY", "primary", "Gateway de Pagamento"],
    ["ECOMMERCE", "primary", "E-commerce"],
  ] as const;

  let secondOrganizationId: string | null = null;

  try {
    const createdIds = new Map<string, string>();
    for (const [provider, key, displayName] of keys) {
      const response = await requestJson("/api/integrations", cookie, {
        method: "POST",
        body: {
          provider,
          key,
          displayName,
          settings: { environment: "smoke" },
          secretRef: `env:${provider}_TOKEN`,
        },
      });
      assert.equal(response.status, 200, `${provider} falhou: ${response.status}`);
      const integration = (await response.json()).integration;
      assert.equal(integration.provider, provider);
      assert.equal(integration.status, "DISCONNECTED");
      assert.equal(integration.secretConfigured, true);
      assert.equal("secretRef" in integration, false, "Referência de segredo não deve sair na API.");
      createdIds.set(provider, integration.id);
    }

    const listResponse = await requestJson("/api/integrations", cookie);
    assert.equal(listResponse.status, 200);
    const listed = (await listResponse.json()).integrations;
    for (const [provider] of keys) {
      assert.ok(listed.some((item: { provider: string }) => item.provider === provider));
    }
    assert.ok(listed.every((item: Record<string, unknown>) => !("secretRef" in item)));

    const updateResponse = await requestJson("/api/integrations", cookie, {
      method: "POST",
      body: {
        provider: "GOPAGE",
        key: "primary",
        displayName: "GoPage Principal",
        settings: { environment: "smoke", baseUrl: "https://example.test/gopage" },
        enabled: false,
      },
    });
    assert.equal(updateResponse.status, 200);
    const updated = (await updateResponse.json()).integration;
    assert.equal(updated.id, createdIds.get("GOPAGE"));
    assert.equal(updated.status, "DISABLED");
    assert.equal(updated.secretConfigured, true, "Atualização sem secretRef deve preservar a referência existente.");

    const integrationRows = await db.integration.count({
      where: {
        organizationId: organization.id,
        provider: { in: keys.map(([provider]) => provider) },
        key: "primary",
      },
    });
    assert.equal(integrationRows, keys.length, "Upsert não deve duplicar configuração existente.");

    const auditCount = await db.auditLog.count({
      where: {
        organizationId: organization.id,
        entityType: "Integration",
        action: { in: ["INTEGRATION_CONFIG_CREATE", "INTEGRATION_CONFIG_UPDATE"] },
      },
    });
    assert.ok(auditCount >= keys.length + 1);

    const secondOrganization = await db.organization.create({
      data: { name: "Integrations CI Second", slug: `integrations-ci-second-${Date.now()}` },
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

    const secondListResponse = await requestJson("/api/integrations", cookie);
    assert.equal(secondListResponse.status, 200);
    assert.equal((await secondListResponse.json()).integrations.length, 0);

    const secondCreateResponse = await requestJson("/api/integrations", cookie, {
      method: "POST",
      body: {
        provider: "GOPAGE",
        key: "primary",
        displayName: "GoPage Outra Empresa",
        settings: { environment: "second" },
      },
    });
    assert.equal(secondCreateResponse.status, 200);
    const secondIntegration = (await secondCreateResponse.json()).integration;
    assert.notEqual(secondIntegration.id, createdIds.get("GOPAGE"));

    console.log("✓ registro de configuração para VaxChat/VaxLab/GoPage/ShopVax/WhatsApp/gateway/e-commerce validado");
    console.log("✓ referências de segredo não são expostas pela API");
    console.log("✓ upsert preserva identidade e evita duplicação de integração");
    console.log("✓ integração desabilitada não é marcada artificialmente como conectada");
    console.log("✓ configurações de integração isoladas por empresa");
  } finally {
    await db.session.deleteMany({ where: { userId: admin.id } });
    if (secondOrganizationId) await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    await db.integration.deleteMany({
      where: {
        organizationId: organization.id,
        provider: { in: keys.map(([provider]) => provider) },
        key: "primary",
      },
    });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
