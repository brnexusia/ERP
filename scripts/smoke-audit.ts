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
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  if (!adminEmail || !adminPassword) throw new Error("Credenciais seed são obrigatórias.");

  const organization = await db.organization.findUnique({ where: { slug } });
  const admin = await db.user.findUnique({ where: { email: adminEmail } });
  assert.ok(organization && admin, "Seed base não encontrado.");

  const adminCookie = await login(adminEmail, adminPassword);
  const suffix = Date.now();
  const sellerEmail = `audit-seller-${suffix}@example.test`;
  const sellerPassword = `audit-${suffix}-password`;
  let sellerUserId: string | null = null;
  let sellerMembershipId: string | null = null;
  let secondOrganizationId: string | null = null;

  try {
    const createSeller = await requestJson("/api/users", adminCookie, {
      method: "POST",
      body: {
        name: "Vendedora Audit Smoke",
        email: sellerEmail,
        password: sellerPassword,
        role: "SELLER",
      },
    });
    assert.equal(createSeller.status, 201, `Criação da vendedora falhou: ${createSeller.status}`);
    const seller = (await createSeller.json()).user;
    sellerMembershipId = seller.id;
    sellerUserId = seller.user.id;

    const auditResponse = await requestJson(
      `/api/audit-logs?action=ORGANIZATION_USER_ADD&entityType=Membership&limit=10`,
      adminCookie,
    );
    assert.equal(auditResponse.status, 200, `Consulta de auditoria falhou: ${auditResponse.status}`);
    const audit = (await auditResponse.json()).audit;
    assert.equal(audit.filters.action, "ORGANIZATION_USER_ADD");
    assert.ok(
      audit.logs.some((entry: { entityId: string | null }) => entry.entityId === sellerMembershipId),
      "Evento de criação de acesso precisa aparecer na auditoria.",
    );
    assert.ok(
      audit.logs.every((entry: { organizationId: string }) => entry.organizationId === organization.id),
      "Auditoria não pode misturar tenants.",
    );

    const sellerCookie = await login(sellerEmail, sellerPassword);
    const forbidden = await requestJson("/api/audit-logs", sellerCookie);
    assert.equal(forbidden.status, 403, "Vendedora não deve consultar log administrativo.");

    const secondOrganization = await db.organization.create({
      data: { name: "Audit CI Second", slug: `audit-ci-second-${suffix}` },
    });
    secondOrganizationId = secondOrganization.id;
    await db.membership.create({
      data: { organizationId: secondOrganization.id, userId: admin.id, role: "ADMIN" },
    });
    await db.auditLog.create({
      data: {
        organizationId: secondOrganization.id,
        userId: admin.id,
        action: "AUDIT_SECOND_TENANT_MARKER",
        entityType: "Test",
        entityId: `audit-marker-${suffix}`,
      },
    });

    const switchResponse = await requestJson("/api/auth/organization", adminCookie, {
      method: "POST",
      body: { organizationId: secondOrganization.id },
    });
    assert.equal(switchResponse.status, 200);

    const isolated = await requestJson("/api/audit-logs?limit=100", adminCookie);
    assert.equal(isolated.status, 200);
    const isolatedAudit = (await isolated.json()).audit;
    assert.ok(isolatedAudit.logs.length >= 1);
    assert.ok(
      isolatedAudit.logs.every((entry: { organizationId: string }) => entry.organizationId === secondOrganization.id),
      "Tenant ativo só pode receber seus próprios logs.",
    );
    assert.equal(
      isolatedAudit.logs.some((entry: { entityId: string | null }) => entry.entityId === sellerMembershipId),
      false,
      "Log da empresa principal não pode aparecer no segundo tenant.",
    );

    console.log("✓ proprietário/admin consulta trilha administrativa da empresa ativa");
    console.log("✓ filtros de ação e entidade funcionam sem atravessar tenants");
    console.log("✓ papel operacional sem gestão da organização recebe 403");
    console.log("✓ logs permanecem isolados entre empresas");
  } finally {
    await db.session.deleteMany({
      where: { userId: { in: [admin.id, ...(sellerUserId ? [sellerUserId] : [])] } },
    });
    if (secondOrganizationId) await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    if (sellerMembershipId) await db.membership.deleteMany({ where: { id: sellerMembershipId } });
    if (sellerUserId) await db.user.deleteMany({ where: { id: sellerUserId } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
