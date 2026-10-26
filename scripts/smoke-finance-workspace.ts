import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { db } from "../lib/db";

const base = process.env.APP_URL ?? "http://127.0.0.1:3000";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Credenciais de CI não configuradas.");
  const org = await db.organization.findUniqueOrThrow({ where: { slug: process.env.SEED_ORG_SLUG ?? "pedro-ci" } });
  const admin = await db.user.findUniqueOrThrow({ where: { email } });

  const login = await fetch(base + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie, "Sessão de administração requerida.");

  const seller = await db.user.create({
    data: { name: "Finance Workspace Read Guard", email: `finance-ui-guard-${Date.now()}@example.test` },
  });
  let sellerToken: string | null = null;
  try {
    await db.membership.create({
      data: { organizationId: org.id, userId: seller.id, role: "SELLER" },
    });
    sellerToken = randomBytes(32).toString("base64url");
    await db.session.create({
      data: {
        tokenHash: createHash("sha256").update(sellerToken).digest("hex"),
        userId: seller.id, activeOrganizationId: org.id,
        expiresAt: new Date(Date.now() + 120_000),
      },
    });
    const anonymous = await fetch(base + "/finance", { redirect: "manual" });
    assert.ok([302, 303, 307, 308].includes(anonymous.status), "Anônimo deve ser redirecionado.");
    const own = await fetch(base + "/finance", { headers: { Cookie: cookie } });
    assert.equal(own.status, 200, "Financeiro autorizado deve carregar.");
    assert.match(await own.text(), /Contas a pagar/, "Tela operacional deve apresentar contas a pagar.");
    const denied = await fetch(base + "/finance", {
      headers: { Cookie: `erp_session=${sellerToken}` },
      redirect: "manual",
    });
    assert.equal(denied.status, 404, "Vendedor não tem acesso ao workspace financeiro.");
    const blockedApi = await fetch(base + "/api/finance/payables", {
      headers: { Cookie: `erp_session=${sellerToken}` },
    });
    assert.equal(blockedApi.status, 403, "Vendedor também não pode ler o financeiro pela API.");
    for (const path of ["/api/finance/payables", "/api/finance/receivables",
      "/api/finance/cash-flow", "/api/finance/bank-entries", "/api/finance/reports"]) {
      const result = await fetch(base + path, { headers: { Cookie: cookie } });
      assert.equal(result.status, 200, `Falha de integração da UI: ${path}`);
    }
    console.log("✓ Financeiro operacional e endpoints conectados");
    console.log("✓ Anônimo redirecionado; SELLER barrado no SSR e API");
  } finally {
    await db.session.deleteMany({ where: { userId: seller.id } });
    await db.user.delete({ where: { id: seller.id } });
    await db.session.deleteMany({ where: { userId: admin.id } });
    await db.$disconnect();
  }
}
main().catch((cause) => { console.error(cause); process.exitCode = 1; });
