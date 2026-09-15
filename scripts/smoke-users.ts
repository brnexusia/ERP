import assert from "node:assert/strict";
import { db } from "../lib/db";

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";

function cookiePair(setCookie: string | null): string {
  if (!setCookie) throw new Error("Login não retornou cookie de sessão.");
  return setCookie.split(";", 1)[0];
}

async function login(email: string, password: string) {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  assert.equal(response.status, 200, `Login falhou para ${email}: ${response.status}`);
  return cookiePair(response.headers.get("set-cookie"));
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
  const ownerEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const ownerPassword = process.env.SEED_ADMIN_PASSWORD;
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  if (!ownerEmail || !ownerPassword) throw new Error("Credenciais seed são obrigatórias.");

  const organization = await db.organization.findUnique({ where: { slug } });
  const owner = await db.user.findUnique({ where: { email: ownerEmail } });
  assert.ok(organization && owner, "Seed base não encontrado.");

  const ownerMembership = await db.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: owner.id,
      },
    },
  });
  assert.equal(ownerMembership?.role, "OWNER", "Seed precisa manter proprietário.");

  const suffix = Date.now();
  const newEmail = `tenant-user-${suffix}@example.test`;
  const newPassword = `tenant-user-${suffix}-password`;
  let newUserId: string | null = null;
  let newMembershipId: string | null = null;
  let secondOrganizationId: string | null = null;

  const ownerCookie = await login(ownerEmail, ownerPassword);

  try {
    const createResponse = await requestJson("/api/users", ownerCookie, {
      method: "POST",
      body: {
        name: "Usuária Gestão Smoke",
        email: newEmail,
        password: newPassword,
        role: "SELLER",
      },
    });
    assert.equal(createResponse.status, 201, `Criação falhou: ${createResponse.status}`);
    const created = (await createResponse.json()).user;
    newMembershipId = created.id;
    newUserId = created.user.id;
    assert.equal(created.role, "SELLER");
    assert.equal(created.user.email, newEmail);
    assert.equal("passwordHash" in created.user, false, "Hash de senha não pode sair pela API.");

    const listResponse = await requestJson("/api/users", ownerCookie);
    assert.equal(listResponse.status, 200);
    const users = (await listResponse.json()).users;
    assert.ok(users.some((entry: { id: string }) => entry.id === newMembershipId));

    const sellerCookie = await login(newEmail, newPassword);
    const sellerListResponse = await requestJson("/api/users", sellerCookie);
    assert.equal(sellerListResponse.status, 403, "Vendedora não deveria gerenciar usuários.");

    const promoteOwnerResponse = await requestJson(`/api/users/${newMembershipId}`, sellerCookie, {
      method: "PATCH",
      body: { role: "OWNER" },
    });
    assert.equal(promoteOwnerResponse.status, 403, "Vendedora não deveria promover usuários.");

    const updateResponse = await requestJson(`/api/users/${newMembershipId}`, ownerCookie, {
      method: "PATCH",
      body: { role: "SUPPORT" },
    });
    assert.equal(updateResponse.status, 200);
    assert.equal((await updateResponse.json()).user.role, "SUPPORT");

    const selfDemotionResponse = await requestJson(`/api/users/${ownerMembership!.id}`, ownerCookie, {
      method: "PATCH",
      body: { role: "ADMIN" },
    });
    assert.equal(selfDemotionResponse.status, 422, "Proprietário não deve alterar o próprio papel por esta rota.");

    const secondOrganization = await db.organization.create({
      data: { name: "Users CI Second", slug: `users-ci-second-${suffix}` },
    });
    secondOrganizationId = secondOrganization.id;
    await db.membership.create({
      data: { organizationId: secondOrganization.id, userId: owner.id, role: "OWNER" },
    });

    const switchResponse = await requestJson("/api/auth/organization", ownerCookie, {
      method: "POST",
      body: { organizationId: secondOrganization.id },
    });
    assert.equal(switchResponse.status, 200);

    const isolatedListResponse = await requestJson("/api/users", ownerCookie);
    assert.equal(isolatedListResponse.status, 200);
    const isolatedUsers = (await isolatedListResponse.json()).users;
    assert.equal(
      isolatedUsers.some((entry: { id: string }) => entry.id === newMembershipId),
      false,
      "Usuário da primeira empresa não pode aparecer na segunda.",
    );

    const crossTenantUpdate = await requestJson(`/api/users/${newMembershipId}`, ownerCookie, {
      method: "PATCH",
      body: { role: "MANAGER" },
    });
    assert.equal(crossTenantUpdate.status, 404, "Membership de outra empresa deve ficar invisível.");

    const switchBackResponse = await requestJson("/api/auth/organization", ownerCookie, {
      method: "POST",
      body: { organizationId: organization.id },
    });
    assert.equal(switchBackResponse.status, 200);

    const removeResponse = await requestJson(`/api/users/${newMembershipId}`, ownerCookie, {
      method: "DELETE",
    });
    assert.equal(removeResponse.status, 200);
    assert.equal((await removeResponse.json()).result.removed, true);

    const removedMembership = await db.membership.findUnique({ where: { id: newMembershipId } });
    assert.equal(removedMembership, null);

    const auditActions = await db.auditLog.findMany({
      where: {
        organizationId: organization.id,
        entityType: "Membership",
        entityId: newMembershipId,
        action: {
          in: [
            "ORGANIZATION_USER_ADD",
            "ORGANIZATION_USER_ROLE_UPDATE",
            "ORGANIZATION_USER_REMOVE",
          ],
        },
      },
      select: { action: true },
    });
    assert.deepEqual(
      new Set(auditActions.map((entry) => entry.action)),
      new Set([
        "ORGANIZATION_USER_ADD",
        "ORGANIZATION_USER_ROLE_UPDATE",
        "ORGANIZATION_USER_REMOVE",
      ]),
    );

    console.log("✓ proprietário gerencia acessos da própria empresa");
    console.log("✓ usuário operacional não recebe permissão de gestão");
    console.log("✓ papel e remoção são auditados e revogam acesso tenant-scoped");
    console.log("✓ usuários permanecem isolados entre empresas");
  } finally {
    await db.session.deleteMany({ where: { userId: { in: [owner.id, ...(newUserId ? [newUserId] : [])] } } });
    if (secondOrganizationId) {
      await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    }
    if (newMembershipId) {
      await db.membership.deleteMany({ where: { id: newMembershipId } });
    }
    if (newUserId) {
      await db.user.deleteMany({ where: { id: newUserId } });
    }
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
