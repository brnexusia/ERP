import assert from "node:assert/strict";
import { db } from "../lib/db";
import { listOrganizationSupportRecords } from "../modules/customer-service/service";

const URL_BASE = process.env.APP_URL ?? "http://127.0.0.1:3000";
async function http(path: string, cookie?: string, method = "GET", body?: object) {
  return fetch(URL_BASE + path, {
    redirect: "manual", method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw Error("Credenciais CI ausentes.");
  const organization = await db.organization.findUniqueOrThrow({
    where: { slug: process.env.SEED_ORG_SLUG ?? "pedro-ci" },
  });
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const login = await http("/api/auth/login", undefined, "POST", { email, password });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie);
  const stamp = Date.now();
  const client = await db.client.create({
    data: {
      organizationId: organization.id, name: "SAC Workspace Smoke",
      documentType: "CPF", document: "sac-workspace-" + stamp,
      email: "sac-workspace-" + stamp + "@example.test",
      whatsapp: "5571999999999",
    },
  });
  try {
    const anonymous = await http("/api/support");
    assert.equal(anonymous.status, 401);
    const ui = await http("/support", cookie);
    assert.equal(ui.status, 200);
    assert.match(await ui.text(), /Atendimento &amp; SAC|Atendimento & SAC/);
    const restricted = await http("/support");
    assert.ok([302,303,307,308].includes(restricted.status));

    const register = await http("/api/clients/" + client.id + "/support", cookie, "POST", {
      kind: "COMPLAINT", content: "Relato da cliente para pesquisa SAC smoke.",
    });
    assert.equal(register.status, 201);
    const recordId = (await register.json()).record.id;
    const audit = await db.auditLog.count({
      where: { organizationId: organization.id, entityType: "SupportRecord",
        entityId: recordId, action: "CLIENT_SUPPORT_RECORD_CREATE" },
    });
    assert.equal(audit, 1);

    await db.supportRecord.createMany({
      data: Array.from({ length: 22 }, (_, i) => ({
        organizationId: organization.id, clientId: client.id,
        createdByUserId: user.id, kind: "ATTENDANCE" as const,
        content: "Atendimento paginado " + (i + 1),
      })),
    });
    const base = "/api/support?clientId=" + client.id;
    const first = await http(base + "&page=1", cookie);
    assert.equal(first.status, 200);
    const result = await first.json();
    assert.equal(result.total, 23);
    assert.equal(result.records.length, 20);
    assert.equal(result.pages, 2);
    assert.ok(result.records.every((row: { clientId: string }) => row.clientId === client.id));
    const second = await http(base + "&page=2", cookie);
    assert.equal((await second.json()).records.length, 3);
    const category = await http(base + "&kind=COMPLAINT", cookie);
    assert.equal((await category.json()).total, 1);
    const matching = await http(base + "&search=pesquisa%20SAC", cookie);
    assert.equal((await matching.json()).total, 1);
    const noMatch = await http(base + "&search=sem-resultado-xyz", cookie);
    assert.equal((await noMatch.json()).total, 0);
    const invalid = await http("/api/support?page=0", cookie);
    assert.equal(invalid.status, 400);
    const invalidKind = await http("/api/support?kind=OUTRO", cookie);
    assert.equal(invalidKind.status, 400);
    const tenant = await listOrganizationSupportRecords({
      organizationId: "isolated-other-organization", userId: user.id, role: "OWNER",
    }, { page: 1, clientId: client.id });
    assert.equal(tenant.total, 0);
    console.log("✓ SAC: autenticação, registro auditado, categorias, pesquisa e paginação");
    console.log("✓ histórico geral limitado à empresa sem mistura com outros clientes");
  } finally {
    await db.client.delete({ where: { id: client.id } });
    await db.session.deleteMany({ where: { userId: user.id } });
    await db.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
