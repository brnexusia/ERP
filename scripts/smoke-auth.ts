import assert from "node:assert/strict";
import { db } from "../lib/db";

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";

function cookiePair(setCookie: string | null): string {
  if (!setCookie) {
    throw new Error("Login não retornou cookie de sessão.");
  }

  return setCookie.split(";", 1)[0];
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD são obrigatórios para o smoke test.");
  }

  const user = await db.user.findUnique({ where: { email } });
  assert.ok(user, "Usuário seed não encontrado.");

  const secondOrganization = await db.organization.upsert({
    where: { slug: "pedro-ci-second" },
    update: { name: "Pedro CI Second", status: "ACTIVE" },
    create: { name: "Pedro CI Second", slug: "pedro-ci-second" },
  });

  const forbiddenOrganization = await db.organization.upsert({
    where: { slug: "pedro-ci-forbidden" },
    update: { name: "Pedro CI Forbidden", status: "ACTIVE" },
    create: { name: "Pedro CI Forbidden", slug: "pedro-ci-forbidden" },
  });

  await db.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: secondOrganization.id,
        userId: user.id,
      },
    },
    update: { role: "ADMIN" },
    create: {
      organizationId: secondOrganization.id,
      userId: user.id,
      role: "ADMIN",
    },
  });

  try {
    const login = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      redirect: "manual",
    });

    assert.equal(login.status, 200, `Login falhou com status ${login.status}.`);
    const sessionCookie = cookiePair(login.headers.get("set-cookie"));

    const firstHome = await fetch(`${BASE_URL}/`, {
      headers: { Cookie: sessionCookie },
      redirect: "manual",
    });
    assert.equal(firstHome.status, 200, `Home autenticada falhou com status ${firstHome.status}.`);
    const firstHtml = await firstHome.text();
    assert.match(firstHtml, /Pedro CI/, "Tenant inicial não apareceu na home autenticada.");

    const switchAllowed = await fetch(`${BASE_URL}/api/auth/organization`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ organizationId: secondOrganization.id }),
      redirect: "manual",
    });
    assert.equal(switchAllowed.status, 200, `Troca autorizada falhou com status ${switchAllowed.status}.`);

    const secondHome = await fetch(`${BASE_URL}/`, {
      headers: { Cookie: sessionCookie },
      redirect: "manual",
    });
    assert.equal(secondHome.status, 200);
    const secondHtml = await secondHome.text();
    assert.match(secondHtml, /Pedro CI Second/, "Tenant trocado não apareceu na home.");

    const switchForbidden = await fetch(`${BASE_URL}/api/auth/organization`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ organizationId: forbiddenOrganization.id }),
      redirect: "manual",
    });
    assert.equal(
      switchForbidden.status,
      403,
      `Troca para tenant sem vínculo deveria retornar 403; retornou ${switchForbidden.status}.`,
    );

    const logout = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
      redirect: "manual",
    });
    assert.equal(logout.status, 200, `Logout falhou com status ${logout.status}.`);

    const homeAfterLogout = await fetch(`${BASE_URL}/`, {
      headers: { Cookie: sessionCookie },
      redirect: "manual",
    });
    assert.ok(
      [302, 303, 307, 308].includes(homeAfterLogout.status),
      `Sessão encerrada ainda acessou a home; status ${homeAfterLogout.status}.`,
    );
    assert.match(
      homeAfterLogout.headers.get("location") ?? "",
      /\/login$/,
      "Sessão encerrada não foi redirecionada para login.",
    );

    console.log("✓ login e sessão persistida validados");
    console.log("✓ navegação autenticada validada");
    console.log("✓ troca autorizada de empresa validada");
    console.log("✓ troca sem membership bloqueada com 403");
    console.log("✓ logout e invalidação de sessão validados");
  } finally {
    await db.session.deleteMany({ where: { userId: user.id } });
    await db.organization.deleteMany({
      where: { id: { in: [secondOrganization.id, forbiddenOrganization.id] } },
    });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
