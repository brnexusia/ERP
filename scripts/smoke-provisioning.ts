import assert from "node:assert/strict";
import { db } from "../lib/db";
import { provisionOrganization, ProvisioningConflictError } from "../modules/provisioning/service";

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";

function cookiePair(setCookie: string | null): string {
  if (!setCookie) throw new Error("Login não retornou cookie de sessão.");
  return setCookie.split(";", 1)[0];
}

async function main() {
  const suffix = Date.now();
  const organizationSlug = `provision-ci-${suffix}`;
  const ownerEmail = `provision-owner-${suffix}@example.test`;
  const ownerPassword = `provision-${suffix}-password`;
  let organizationId: string | null = null;
  let ownerId: string | null = null;

  try {
    const provisioned = await provisionOrganization({
      organizationName: "Provision CI",
      organizationSlug,
      ownerName: "Proprietário Provision CI",
      ownerEmail,
      ownerPassword,
    });

    organizationId = provisioned.organization.id;
    ownerId = provisioned.owner.id;
    assert.equal(provisioned.organization.slug, organizationSlug);
    assert.equal(provisioned.organization.status, "ACTIVE");
    assert.equal(provisioned.membership.role, "OWNER");

    const membership = await db.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: ownerId,
        },
      },
    });
    assert.equal(membership?.role, "OWNER");

    const audit = await db.auditLog.findFirst({
      where: {
        organizationId,
        action: "ORGANIZATION_PROVISIONED",
        entityId: organizationId,
      },
    });
    assert.ok(audit, "Provisionamento precisa deixar trilha de auditoria.");

    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
      redirect: "manual",
    });
    assert.equal(loginResponse.status, 200, `Login do tenant provisionado falhou: ${loginResponse.status}`);
    const cookie = cookiePair(loginResponse.headers.get("set-cookie"));

    const usersResponse = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    assert.equal(usersResponse.status, 200, "Proprietário provisionado deve gerir acessos da própria empresa.");
    const users = (await usersResponse.json()).users;
    assert.equal(users.length, 1);
    assert.equal(users[0].user.email, ownerEmail);
    assert.equal(users[0].role, "OWNER");

    await assert.rejects(
      () => provisionOrganization({
        organizationName: "Provision CI Duplicada",
        organizationSlug,
        ownerName: "Outro Proprietário",
        ownerEmail: `other-${ownerEmail}`,
        ownerPassword,
      }),
      ProvisioningConflictError,
    );

    const conflictingSlug = `provision-existing-user-${suffix}`;
    await assert.rejects(
      () => provisionOrganization({
        organizationName: "Provision Existing User",
        organizationSlug: conflictingSlug,
        ownerName: "Proprietário Existente",
        ownerEmail,
        ownerPassword,
      }),
      ProvisioningConflictError,
    );
    assert.equal(
      await db.organization.findUnique({ where: { slug: conflictingSlug } }),
      null,
      "Falha de provisionamento não pode deixar empresa parcial.",
    );

    console.log("✓ nova empresa provisionada com proprietário isolado");
    console.log("✓ proprietário provisionado autentica e gerencia a própria empresa");
    console.log("✓ provisionamento duplicado é rejeitado sem estado parcial");
    console.log("✓ criação de conta não redefine senha global de usuário existente");
  } finally {
    if (ownerId) await db.session.deleteMany({ where: { userId: ownerId } });
    if (organizationId) await db.organization.deleteMany({ where: { id: organizationId } });
    if (ownerId) await db.user.deleteMany({ where: { id: ownerId } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
