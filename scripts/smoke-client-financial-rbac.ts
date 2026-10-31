import assert from "node:assert/strict";
import { hashPassword } from "../lib/auth/password";
import { db } from "../lib/db";

const base = process.env.APP_URL ?? "http://127.0.0.1:3000";

async function login(email: string, password: string) {
  const response = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  assert.equal(response.status, 200, "Falha no login de " + email);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie);
  return cookie;
}

async function request(path: string, cookie: string, method = "GET", body?: unknown) {
  return fetch(base + path, {
    method,
    headers: { Cookie: cookie, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
}

async function main() {
  const ownerEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const ownerPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!ownerEmail || !ownerPassword) throw Error("Credenciais de CI são obrigatórias.");
  const tenant = await db.organization.findUniqueOrThrow({
    where: { slug: process.env.SEED_ORG_SLUG ?? "pedro-ci" },
  });
  const stamp = Date.now().toString();
  const userIds: string[] = [];
  let clientId: string | null = null;

  try {
    const ownerCookie = await login(ownerEmail, ownerPassword);
    const client = await db.client.create({
      data: {
        organizationId: tenant.id,
        name: "Cliente Financeiro RBAC Smoke",
        documentType: "CPF",
        document: "finance-rbac-" + stamp,
        whatsapp: "finance-rbac-" + stamp,
        email: `financial-role-${stamp}@example.test`,
      },
    });
    clientId = client.id;

    const creditPath = `/api/clients/${clientId}/credit/movements`;
    const valePath = `/api/clients/${clientId}/vale/movements`;
    const creditLimit = await request(`/api/clients/${clientId}/credit`, ownerCookie, "PATCH",
      { creditLimit: "100.00" });
    assert.equal(creditLimit.status, 200, "OWNER deve poder configurar limite.");

    const roles = ["SELLER", "SUPPORT", "MANAGER", "FINANCE"] as const;
    const cookies = new Map<typeof roles[number], string>();
    for (const role of roles) {
      const email = `balance-${role.toLowerCase()}-${stamp}@example.test`;
      const password = `balance-test-${role}-${stamp}`;
      const user = await db.user.create({
        data: {
          name: "Usuário RBAC " + role, email,
          passwordHash: await hashPassword(password),
        },
      });
      userIds.push(user.id);
      await db.membership.create({
        data: { userId: user.id, organizationId: tenant.id, role },
      });
      cookies.set(role, await login(email, password));
    }

    const balanceBefore = await db.clientCreditAccount.findUniqueOrThrow({ where: { clientId } });
    assert.equal(String(balanceBefore.usedAmount), "0");
    assert.equal(await db.clientValeAccount.count({ where: { clientId } }), 0);

    // Client-edit privileges do not authorize manually granting or changing
    // a monetary balance. Both roles must be rejected before any DB writes.
    for (const role of ["SELLER", "SUPPORT"] as const) {
      for (const path of [creditPath, valePath]) {
        const response = await request(path, cookies.get(role)!, "POST",
          { amountDelta: "10.00", note: "Tentativa sem privilégio financeiro" });
        assert.equal(response.status, 403, `${role} não pode movimentar manualmente ${path}`);
      }
    }
    const afterRejected = await db.clientCreditAccount.findUniqueOrThrow({ where: { clientId } });
    assert.equal(String(afterRejected.usedAmount), "0",
      "Acesso negado não pode alterar crédito utilizado.");
    assert.equal(await db.clientValeAccount.count({ where: { clientId } }), 0,
      "Acesso negado não pode criar saldo de vale.");
    assert.equal(await db.auditLog.count({
      where: { organizationId: tenant.id, entityType: { in: ["ClientCreditMovement", "ClientValeMovement"] },
        metadata: { path: ["clientId"], equals: clientId } },
    }), 0, "Tentativas negadas não podem criar movimentos auditados.");

    for (const role of ["MANAGER", "FINANCE"] as const) {
      const cookie = cookies.get(role)!;
      const credit = await request(creditPath, cookie, "POST",
        { amountDelta: "5.00", note: "Movimento autorizado" });
      assert.equal(credit.status, 201, `${role} pode gerir movimentação de crédito`);
      const vale = await request(valePath, cookie, "POST",
        { amountDelta: "7.00", note: "Movimento autorizado" });
      assert.equal(vale.status, 201, `${role} pode gerir movimentação de vale`);
    }
    const finalCredit = await db.clientCreditAccount.findUniqueOrThrow({ where: { clientId } });
    const finalVale = await db.clientValeAccount.findUniqueOrThrow({ where: { clientId } });
    assert.equal(String(finalCredit.usedAmount), "10");
    assert.equal(String(finalVale.balance), "14");
    console.log("✓ SELLER e SUPPORT não alteram crédito nem vale, nem deixam movimentos persistidos");
    console.log("✓ MANAGER e FINANCE podem registrar movimentações manuais com auditoria");
  } finally {
    await db.session.deleteMany({ where: { userId: { in: userIds } } });
    if (clientId) {
      await db.client.deleteMany({ where: { id: clientId, organizationId: tenant.id } });
    }
    if (userIds.length) {
      await db.membership.deleteMany({ where: { userId: { in: userIds }, organizationId: tenant.id } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await db.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
