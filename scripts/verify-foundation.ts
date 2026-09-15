import assert from "node:assert/strict";
import { db } from "../lib/db";
import {
  assertOrganizationMembership,
  findTenantIntegration,
  listTenantIntegrations,
} from "../lib/tenant-data";
import { hasPermission } from "../lib/auth/permissions";

async function main() {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let organizationAId: string | null = null;
  let organizationBId: string | null = null;
  let userAId: string | null = null;
  let userBId: string | null = null;

  try {
    const [organizationA, organizationB] = await Promise.all([
      db.organization.create({
        data: { name: "Tenant A - Teste", slug: `foundation-a-${nonce}` },
      }),
      db.organization.create({
        data: { name: "Tenant B - Teste", slug: `foundation-b-${nonce}` },
      }),
    ]);

    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const [userA, userB] = await Promise.all([
      db.user.create({
        data: {
          name: "Usuário Tenant A",
          email: `foundation-a-${nonce}@example.test`,
        },
      }),
      db.user.create({
        data: {
          name: "Usuário Tenant B",
          email: `foundation-b-${nonce}@example.test`,
        },
      }),
    ]);

    userAId = userA.id;
    userBId = userB.id;

    await Promise.all([
      db.membership.create({
        data: {
          organizationId: organizationA.id,
          userId: userA.id,
          role: "OWNER",
        },
      }),
      db.membership.create({
        data: {
          organizationId: organizationB.id,
          userId: userB.id,
          role: "OWNER",
        },
      }),
    ]);

    const [integrationA, integrationB] = await Promise.all([
      db.integration.create({
        data: {
          organizationId: organizationA.id,
          provider: "foundation-test",
          key: "tenant-a",
          displayName: "Integração Tenant A",
        },
      }),
      db.integration.create({
        data: {
          organizationId: organizationB.id,
          provider: "foundation-test",
          key: "tenant-b",
          displayName: "Integração Tenant B",
        },
      }),
    ]);

    const tenantAIntegrations = await listTenantIntegrations(organizationA.id);
    const tenantBIntegrations = await listTenantIntegrations(organizationB.id);

    assert.deepEqual(
      tenantAIntegrations.map((item) => item.id),
      [integrationA.id],
      "Tenant A recebeu dados pertencentes a outro tenant.",
    );
    assert.deepEqual(
      tenantBIntegrations.map((item) => item.id),
      [integrationB.id],
      "Tenant B recebeu dados pertencentes a outro tenant.",
    );

    assert.equal(
      await findTenantIntegration(organizationA.id, integrationB.id),
      null,
      "Tenant A conseguiu acessar uma integração do Tenant B pelo ID.",
    );
    assert.equal(
      await findTenantIntegration(organizationB.id, integrationA.id),
      null,
      "Tenant B conseguiu acessar uma integração do Tenant A pelo ID.",
    );

    await assertOrganizationMembership(userA.id, organizationA.id);
    await assert.rejects(
      () => assertOrganizationMembership(userA.id, organizationB.id),
      /Acesso não autorizado/,
      "Usuário do Tenant A conseguiu assumir o Tenant B sem vínculo.",
    );

    assert.equal(hasPermission("OWNER", "organization:manage"), true);
    assert.equal(hasPermission("SELLER", "finance:write"), false);
    assert.equal(hasPermission("VIEWER", "clients:write"), false);

    console.log("✓ isolamento de dados A/B validado");
    console.log("✓ acesso entre empresas sem membership bloqueado");
    console.log("✓ matriz inicial de permissões validada");
  } finally {
    if (organizationAId || organizationBId) {
      await db.organization.deleteMany({
        where: {
          id: { in: [organizationAId, organizationBId].filter((id): id is string => Boolean(id)) },
        },
      });
    }

    if (userAId || userBId) {
      await db.user.deleteMany({
        where: {
          id: { in: [userAId, userBId].filter((id): id is string => Boolean(id)) },
        },
      });
    }

    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
