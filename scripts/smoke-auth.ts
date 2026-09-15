import assert from "node:assert/strict";
import { db } from "../lib/db";

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";
const TEST_DOCUMENT = "52998224725";

function cookiePair(setCookie: string | null): string {
  if (!setCookie) {
    throw new Error("Login não retornou cookie de sessão.");
  }

  return setCookie.split(";", 1)[0];
}

function clientPayload(name: string, email: string) {
  return {
    name,
    document: "529.982.247-25",
    whatsapp: "55 71 99999-1111",
    email,
    address: {
      postalCode: "44470-000",
      street: "Rua de Teste",
      number: "100",
      complement: "Sala 1",
      district: "Centro",
      city: "Vera Cruz",
      state: "BA",
      country: "BR",
    },
  };
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

    const createFirstClient = await fetch(`${BASE_URL}/api/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify(clientPayload("Cliente Tenant A", "tenant-a@example.test")),
    });
    assert.equal(createFirstClient.status, 201, `Cadastro de cliente A falhou: ${createFirstClient.status}.`);
    const firstClientBody = await createFirstClient.json();
    const firstClientId = firstClientBody.client?.id as string | undefined;
    assert.ok(firstClientId, "API não retornou ID do cliente A.");
    assert.equal(firstClientBody.client.document, TEST_DOCUMENT);

    const duplicateFirstClient = await fetch(`${BASE_URL}/api/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify(clientPayload("Duplicado Tenant A", "duplicado-a@example.test")),
    });
    assert.equal(duplicateFirstClient.status, 409, "CPF duplicado dentro do mesmo tenant não foi bloqueado.");

    const getFirstClient = await fetch(`${BASE_URL}/api/clients/${firstClientId}`, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(getFirstClient.status, 200, "Cliente do tenant ativo não pôde ser consultado.");

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

    const crossTenantClient = await fetch(`${BASE_URL}/api/clients/${firstClientId}`, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(
      crossTenantClient.status,
      404,
      `Tenant B acessou cliente do Tenant A; status ${crossTenantClient.status}.`,
    );

    const createSecondClient = await fetch(`${BASE_URL}/api/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify(clientPayload("Cliente Tenant B", "tenant-b@example.test")),
    });
    assert.equal(
      createSecondClient.status,
      201,
      "Mesmo CPF deveria ser permitido em empresas diferentes.",
    );
    const secondClientBody = await createSecondClient.json();
    const secondClientId = secondClientBody.client?.id as string | undefined;
    assert.ok(secondClientId, "API não retornou ID do cliente B.");

    const updateSecondClient = await fetch(`${BASE_URL}/api/clients/${secondClientId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        whatsapp: "55 71 98888-2222",
        address: { city: "Salvador" },
      }),
    });
    assert.equal(updateSecondClient.status, 200, "Atualização do cliente B falhou.");
    const updatedSecondBody = await updateSecondClient.json();
    assert.equal(updatedSecondBody.client.whatsapp, "5571988882222");
    assert.equal(updatedSecondBody.client.address?.city, "Salvador");

    const secondList = await fetch(`${BASE_URL}/api/clients`, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(secondList.status, 200);
    const secondListBody = await secondList.json();
    assert.deepEqual(
      secondListBody.clients.map((client: { name: string }) => client.name),
      ["Cliente Tenant B"],
      "Listagem do Tenant B vazou clientes de outra empresa.",
    );

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
    console.log("✓ cadastro, consulta, edição e listagem de clientes validados");
    console.log("✓ CPF duplicado bloqueado dentro do tenant e permitido entre tenants");
    console.log("✓ cliente de outro tenant invisível pela API");
    console.log("✓ troca autorizada de empresa validada");
    console.log("✓ troca sem membership bloqueada com 403");
    console.log("✓ logout e invalidação de sessão validados");
  } finally {
    await db.session.deleteMany({ where: { userId: user.id } });
    await db.client.deleteMany({ where: { document: TEST_DOCUMENT } });
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
