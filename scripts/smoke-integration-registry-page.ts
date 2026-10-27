import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { db } from "../lib/db";

const base = process.env.APP_URL ?? "http://127.0.0.1:3000";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw Error("Credenciais CI ausentes.");
  const org = await db.organization.findUniqueOrThrow({
    where: { slug: process.env.SEED_ORG_SLUG ?? "pedro-ci" },
  });
  const owner = await db.user.findUniqueOrThrow({ where: { email } });
  const seller = await db.user.create({
    data: { name: "Integrations UI Seller", email: `integration-ui-seller-${Date.now()}@example.test` },
  });
  let integrationId: string | null = null;
  let ownerSessionHash: string | null = null;
  const key = `registry-ui-${Date.now()}`;
  try {
    await db.membership.create({ data: { organizationId: org.id, userId: seller.id, role: "SELLER" } });
    const sellerToken = randomBytes(32).toString("base64url");
    await db.session.create({ data: {
      tokenHash: createHash("sha256").update(sellerToken).digest("hex"),
      userId: seller.id, activeOrganizationId: org.id,
      expiresAt: new Date(Date.now() + 60_000),
    } });

    const unauthenticated = await fetch(base + "/integrations", { redirect: "manual" });
    assert.ok([302, 303, 307, 308].includes(unauthenticated.status));
    const denied = await fetch(base + "/integrations", {
      headers: { Cookie: `erp_session=${sellerToken}` }, redirect: "manual",
    });
    assert.equal(denied.status, 404);
    const deniedApi = await fetch(base + "/api/integrations", {
      headers: { Cookie: `erp_session=${sellerToken}` },
    });
    assert.equal(deniedApi.status, 403);

    const login = await fetch(base + "/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(login.status, 200);
    const ownerCookie = login.headers.get("set-cookie")?.split(";", 1)[0];
    assert.ok(ownerCookie);
    ownerSessionHash = createHash("sha256").update(ownerCookie.split("=", 2)[1]).digest("hex");
    const page = await fetch(base + "/integrations", { headers: { Cookie: ownerCookie } });
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.ok(html.includes("Registro administrativo de provedores"));
    assert.ok(html.includes("não conecta APIs"), "Interface não deve simular conexão.");

    const save = await fetch(base + "/api/integrations", {
      method: "POST", headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "VAXCHAT", key, displayName: "Registro sem credenciais", enabled: false }),
    });
    assert.equal(save.status, 200);
    const data = (await save.json()).integration;
    integrationId = data.id;
    assert.equal(data.status, "DISABLED");
    assert.equal(data.secretConfigured, false);
    assert.equal("secretRef" in data, false);
    const updated = await fetch(base + "/api/integrations", {
      method: "POST", headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "VAXCHAT", key, displayName: "Registro sem credenciais", enabled: true }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).integration.status, "DISCONNECTED",
      "Habilitar registro não pode afirmar conexão real.");
    const rejectCredentials = await fetch(base + "/api/integrations", {
      method: "POST", headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "VAXCHAT", key, displayName: "Registro",
        settings: { env: "test", headers: { authorization: "Bearer SENSITIVE-CANARY-VALUE" } },
      }),
    });
    assert.equal(rejectCredentials.status, 400,
      "Credenciais não podem ser salvas em campos de configuração visíveis.");
    const rejectApiKey = await fetch(base + "/api/integrations", {
      method: "POST", headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "VAXCHAT", key, displayName: "Registro",
        settings: { connection: [{ api_key: "SENSITIVE-CANARY-VALUE" }] },
      }),
    });
    assert.equal(rejectApiKey.status, 400,
      "Detecção deve identificar segredos aninhados em arrays.");

    await db.integration.update({
      where: { id: integrationId! },
      data: {
        settings: {
          displayMode: "manual",
          nested: [{ publicFlag: true, clientSecret: "LEGACY-SECRET-CANARY-VALUE" }],
          refresh_token: "LEGACY-SECRET-CANARY-VALUE",
        },
      },
    });
    const readBack = await fetch(base + "/api/integrations", {
      headers: { Cookie: ownerCookie },
    });
    assert.equal(readBack.status, 200);
    const body = await readBack.text();
    assert.ok(!body.includes("LEGACY-SECRET-CANARY-VALUE") &&
      !body.includes("refresh_token") && !body.includes("clientSecret"),
    "Segredos legados devem ser removidos até em respostas já persistidas.");
    const loaded = JSON.parse(body).integrations.find((entry: { id: string }) => entry.id === integrationId);
    assert.ok(loaded);
    assert.equal(loaded.settings.displayMode, "manual");
    assert.equal(loaded.settings.nested[0].publicFlag, true);

    const safeUpdate = await fetch(base + "/api/integrations", {
      method: "POST", headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "VAXCHAT", key, displayName: "Registro",
        settings: { environment: "test", apiBaseUrl: "https://api.example.test" },
        secretRef: "vault/erp/ci/opaque-only",
      }),
    });
    assert.equal(safeUpdate.status, 200);
    const result = (await safeUpdate.json()).integration;
    assert.equal(result.secretConfigured, true);
    assert.equal(result.settings.apiBaseUrl, "https://api.example.test");
    assert.ok(!JSON.stringify(result).includes("vault/erp/ci/opaque-only"),
      "Referência de segredo é privada, mesmo para administradores.");
    console.log("✓ Registro integrado no painel, sem segredo em respostas");
    console.log("✓ Campos de segredo em configurações rejeitados; campos legados redigidos no GET");
    console.log("✓ Ausência de sessão e acesso de vendedor bloqueados");
    console.log("✓ Habilitar registro não simula conexão com VaxChat");
  } finally {
    if (integrationId) await db.integration.deleteMany({ where: { organizationId: org.id, id: integrationId } });
    await db.session.deleteMany({ where: { userId: seller.id } });
    await db.user.delete({ where: { id: seller.id } });
    if (ownerSessionHash) await db.session.deleteMany({ where: { tokenHash: ownerSessionHash } });
    await db.$disconnect();
  }
}
main().catch((cause) => { console.error(cause); process.exitCode = 1; });
