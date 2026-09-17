import assert from "node:assert/strict";
import { db } from "../lib/db";
import { hashPassword } from "../lib/auth/password";

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";

function cookiePair(setCookie: string | null): string {
  if (!setCookie) throw new Error("Login não retornou cookie de sessão.");
  return setCookie.split(";", 1)[0];
}

async function login(email: string, password: string) {
  return fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
}

async function changePassword(
  cookie: string,
  currentPassword: string,
  newPassword: string,
) {
  return fetch(`${BASE_URL}/api/auth/password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
    redirect: "manual",
  });
}

async function main() {
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  const organization = await db.organization.findUnique({ where: { slug } });
  assert.ok(organization, "Tenant seed não encontrado.");

  const suffix = Date.now();
  const email = `password-smoke-${suffix}@example.test`;
  const oldPassword = `old-password-${suffix}`;
  const newPassword = `new-password-${suffix}`;

  const user = await db.user.create({
    data: {
      name: "Password Smoke User",
      email,
      passwordHash: await hashPassword(oldPassword),
      status: "ACTIVE",
    },
  });

  await db.membership.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      role: "VIEWER",
    },
  });

  try {
    const firstLogin = await login(email, oldPassword);
    assert.equal(firstLogin.status, 200, `Primeiro login falhou: ${firstLogin.status}`);
    const firstCookie = cookiePair(firstLogin.headers.get("set-cookie"));

    const secondLogin = await login(email, oldPassword);
    assert.equal(secondLogin.status, 200, `Segundo login falhou: ${secondLogin.status}`);
    const secondCookie = cookiePair(secondLogin.headers.get("set-cookie"));
    assert.notEqual(firstCookie, secondCookie, "Sessões simultâneas devem usar tokens diferentes.");

    const wrongCurrent = await changePassword(
      firstCookie,
      "senha-atual-incorreta",
      newPassword,
    );
    assert.equal(wrongCurrent.status, 400, "Senha atual incorreta deve ser rejeitada.");

    const secondSessionBeforeChange = await fetch(`${BASE_URL}/`, {
      headers: { Cookie: secondCookie },
      redirect: "manual",
    });
    assert.equal(
      secondSessionBeforeChange.status,
      200,
      "Erro de senha atual não pode revogar outras sessões.",
    );

    const reusedPassword = await changePassword(firstCookie, oldPassword, oldPassword);
    assert.equal(reusedPassword.status, 422, "Reutilização da senha atual deve ser bloqueada.");

    const change = await changePassword(firstCookie, oldPassword, newPassword);
    assert.equal(change.status, 200, `Alteração de senha falhou: ${change.status}`);
    const changeBody = await change.json();
    assert.equal(changeBody.ok, true);
    assert.ok(
      changeBody.revokedOtherSessions >= 1,
      "Alteração de senha deve revogar as demais sessões do usuário.",
    );

    const currentSessionAfterChange = await fetch(`${BASE_URL}/`, {
      headers: { Cookie: firstCookie },
      redirect: "manual",
    });
    assert.equal(
      currentSessionAfterChange.status,
      200,
      "Sessão que confirmou a troca de senha deve permanecer válida.",
    );

    const revokedSecondSession = await fetch(`${BASE_URL}/`, {
      headers: { Cookie: secondCookie },
      redirect: "manual",
    });
    assert.ok(
      [302, 303, 307, 308].includes(revokedSecondSession.status),
      `Sessão secundária deveria ser revogada; status ${revokedSecondSession.status}.`,
    );

    const oldPasswordLogin = await login(email, oldPassword);
    assert.equal(oldPasswordLogin.status, 401, "Senha antiga não pode autenticar após a troca.");

    const newPasswordLogin = await login(email, newPassword);
    assert.equal(newPasswordLogin.status, 200, "Nova senha deve autenticar após a troca.");

    const audit = await db.auditLog.findFirst({
      where: {
        organizationId: organization.id,
        userId: user.id,
        action: "AUTH_PASSWORD_CHANGE",
        entityType: "User",
        entityId: user.id,
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(audit, "Troca de senha deve deixar trilha de auditoria.");

    console.log("✓ troca de senha exige a senha atual correta");
    console.log("✓ reutilização da senha atual é bloqueada");
    console.log("✓ nova senha substitui a anterior");
    console.log("✓ outras sessões do usuário são revogadas após a troca");
    console.log("✓ sessão que confirmou a alteração permanece ativa");
    console.log("✓ alteração de senha fica registrada em auditoria");
  } finally {
    await db.session.deleteMany({ where: { userId: user.id } });
    await db.auditLog.deleteMany({ where: { userId: user.id } });
    await db.membership.deleteMany({ where: { userId: user.id } });
    await db.user.deleteMany({ where: { id: user.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
