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
    console.log("✓ Registro integrado no painel, sem segredo em respostas");
    console.log("✓ Ausência de sessão e acesso de vendedor bloqueados");
    console.log("✓ Habilitar registro não simula conexão com VaxChat");
  } finally {
    if (integrationId) await db.integration.deleteMany({ where: { organizationId: org.id, id: integrationId } });
    await db.session.deleteMany({ where: { userId: seller.id } });
    await db.user.delete({ where: { id: seller.id } });
    await db.session.deleteMany({ where: { userId: owner.id } });
    await db.$disconnect();
  }
}
main().catch((cause) => { console.error(cause); process.exitCode = 1; });
