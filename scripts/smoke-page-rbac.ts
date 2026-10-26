import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { db } from "../lib/db";
import { hashPassword } from "../lib/auth/password";

const base = process.env.APP_URL ?? "http://127.0.0.1:3000";
async function login(email: string, password: string) {
  const result = await fetch(base + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }), redirect: "manual",
  });
  assert.equal(result.status, 200, "Login de teste deve funcionar.");
  const cookie = result.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie);
  return cookie;
}
async function visit(path: string, cookie: string) {
  return fetch(base + path, { headers: { Cookie: cookie }, redirect: "manual" });
}
async function createMember(organizationId: string, role: "FINANCE" | "MANAGER" | "SUPPORT", stamp: number) {
  const email = `erp-ui-role-${role.toLowerCase()}-${stamp}@example.test`;
  const password = `ci-only-ui-role-${stamp}`;
  const user = await db.user.create({
    data: { name: `Teste Interface ${role}`, email,
      passwordHash: await hashPassword(password) },
  });
  await db.membership.create({ data: { organizationId, userId: user.id, role } });
  return { userId: user.id, cookie: await login(email, password) };
}

async function main() {
  const org = await db.organization.findUniqueOrThrow({
    where: { slug: process.env.SEED_ORG_SLUG ?? "pedro-ci" },
  });
  const stamp = Date.now();
  const temporaryIds: string[] = [];
  try {
    const finance = await createMember(org.id, "FINANCE", stamp);
    temporaryIds.push(finance.userId);
    const manager = await createMember(org.id, "MANAGER", stamp);
    temporaryIds.push(manager.userId);
    const support = await createMember(org.id, "SUPPORT", stamp);
    temporaryIds.push(support.userId);

    assert.equal((await visit("/products", finance.cookie)).status, 404,
      "FINANCE não tem inventory:read e não deve abrir página de produtos.");
    assert.equal((await visit("/api/products", finance.cookie)).status, 403,
      "Bloqueio precisa existir também na API de produtos.");
    const financeDashboard = await visit("/", finance.cookie);
    assert.equal(financeDashboard.status, 200);
    const financeHtml = await financeDashboard.text();
    assert.ok(!financeHtml.includes('href="/products"'),
      "Sidebar não deve expor opção de estoque sem inventory:read.");
    assert.ok(financeHtml.includes('href="/reports"'),
      "FINANCE tem reports:read e deve enxergar relatórios.");
    assert.ok(financeHtml.includes('href="/finance"'));
    assert.ok(!financeHtml.includes('href="/promotions"'));
    assert.equal((await visit("/reports", finance.cookie)).status, 200);

    assert.equal((await visit("/products", manager.cookie)).status, 200,
      "MANAGER tem inventory:read.");
    assert.equal((await visit("/reports", manager.cookie)).status, 200,
      "MANAGER já possui reports:read na política de permissões aprovada.");
    const managerDashboard = await visit("/", manager.cookie);
    assert.equal(managerDashboard.status, 200);
    const managerHtml = await managerDashboard.text();
    assert.ok(managerHtml.includes('href="/products"'));
    assert.ok(managerHtml.includes('href="/reports"'),
      "Sidebar deve refletir reports:read concedido a MANAGER.");
    assert.ok(managerHtml.includes('href="/finance"'),
      "MANAGER tem finance:read para o painel.");
    assert.ok(!managerHtml.includes('href="/integrations"'));

    assert.equal((await visit("/reports", support.cookie)).status, 404,
      "SUPPORT sem reports:read não tem acesso a relatórios.");
    assert.equal((await visit("/finance", support.cookie)).status, 404);
    const supportHtml = await (await visit("/", support.cookie)).text();
    assert.ok(supportHtml.includes('href="/products"'));
    assert.ok(!supportHtml.includes('href="/reports"'));
    assert.ok(!supportHtml.includes('href="/finance"'));

    assert.ok([302, 303, 307, 308].includes((await fetch(base + "/products", {
      redirect: "manual",
    })).status), "Sessões anônimas devem ser redirecionadas.");

    console.log("✓ Navegação por função corresponde às permissões server-side");
    console.log("✓ FINANCE não acessa produtos, MANAGER acessa relatórios, SUPPORT não acessa relatórios/financeiro");
    console.log("✓ Proteção de API independente de ocultação visual e redirect anônimo");
  } finally {
    await db.session.deleteMany({ where: { userId: { in: temporaryIds } } });
    await db.membership.deleteMany({ where: { userId: { in: temporaryIds } } });
    await db.user.deleteMany({ where: { id: { in: temporaryIds } } });
    await db.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
