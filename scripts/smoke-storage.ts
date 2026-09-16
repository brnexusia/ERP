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

async function upload(
  cookie: string,
  input: { name: string; type: string; bytes: Uint8Array; purpose: string; visibility: string },
) {
  const form = new FormData();
  form.append("file", new Blob([input.bytes], { type: input.type }), input.name);
  form.append("purpose", input.purpose);
  form.append("visibility", input.visibility);

  return fetch(`${BASE_URL}/api/files`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
    redirect: "manual",
  });
}

function tamperTokenPurpose(token: string): string {
  const [encodedPayload, signature] = token.split(".");
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
    key: string;
    purpose: string;
  };
  payload.purpose = payload.purpose === "PRODUCT_IMAGE" ? "DELIVERY_PROOF" : "PRODUCT_IMAGE";
  const tamperedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${tamperedPayload}.${signature}`;
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  if (!adminEmail || !adminPassword) throw new Error("Credenciais seed são obrigatórias.");

  const organization = await db.organization.findUnique({ where: { slug } });
  const admin = await db.user.findUnique({ where: { email: adminEmail } });
  assert.ok(organization && admin, "Seed base não encontrado.");

  const cookie = await login(adminEmail, adminPassword);
  let publicToken: string | null = null;
  let privateToken: string | null = null;
  let secondOrganizationId: string | null = null;

  try {
    const pngBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
    const publicUpload = await upload(cookie, {
      name: "foto-produto.png",
      type: "image/png",
      bytes: pngBytes,
      purpose: "PRODUCT_IMAGE",
      visibility: "public",
    });
    assert.equal(publicUpload.status, 201, `Upload público falhou: ${publicUpload.status}`);
    const publicFile = (await publicUpload.json()).file;
    publicToken = publicFile.token;
    assert.equal(publicFile.visibility, "public");
    assert.equal(publicFile.purpose, "PRODUCT_IMAGE");
    assert.equal(publicFile.mimeType, "image/png");
    assert.ok(publicFile.url.includes("/api/public/files/"));

    const publicRead = await fetch(publicFile.url, { redirect: "manual" });
    assert.equal(publicRead.status, 200, "Arquivo público precisa ser acessível sem sessão.");
    assert.equal(publicRead.headers.get("content-type"), "image/png");
    assert.deepEqual(new Uint8Array(await publicRead.arrayBuffer()), pngBytes);

    const tamperedPublic = await fetch(
      `${BASE_URL}/api/public/files/${tamperTokenPurpose(publicToken)}`,
      { redirect: "manual" },
    );
    assert.equal(tamperedPublic.status, 404, "Token adulterado precisa ser rejeitado.");

    const pdfBytes = new TextEncoder().encode("%PDF-1.4\nERP PEDRO STORAGE SMOKE\n%%EOF");
    const privateUpload = await upload(cookie, {
      name: "comprovante.pdf",
      type: "application/pdf",
      bytes: pdfBytes,
      purpose: "DELIVERY_PROOF",
      visibility: "private",
    });
    assert.equal(privateUpload.status, 201, `Upload privado falhou: ${privateUpload.status}`);
    const privateFile = (await privateUpload.json()).file;
    privateToken = privateFile.token;
    assert.ok(privateFile.url.includes("/api/files/"));

    const anonymousPrivate = await fetch(privateFile.url, { redirect: "manual" });
    assert.equal(anonymousPrivate.status, 401, "Arquivo privado não pode ser lido sem sessão.");

    const authenticatedPrivate = await fetch(privateFile.url, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    assert.equal(authenticatedPrivate.status, 200);
    assert.equal(authenticatedPrivate.headers.get("content-type"), "application/pdf");
    assert.deepEqual(new Uint8Array(await authenticatedPrivate.arrayBuffer()), pdfBytes);

    const tamperedDelete = await fetch(`${BASE_URL}/api/files/${tamperTokenPurpose(privateToken)}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    assert.equal(tamperedDelete.status, 404, "Purpose do token não pode ser trocado para contornar permissão.");

    const invalidUpload = await upload(cookie, {
      name: "script.html",
      type: "text/html",
      bytes: new TextEncoder().encode("<script>alert(1)</script>"),
      purpose: "OTHER",
      visibility: "public",
    });
    assert.equal(invalidUpload.status, 415, "HTML executável não deve ser aceito pelo storage.");

    const secondOrganization = await db.organization.create({
      data: { name: "Storage CI Second", slug: `storage-ci-second-${Date.now()}` },
    });
    secondOrganizationId = secondOrganization.id;
    await db.membership.create({
      data: { organizationId: secondOrganization.id, userId: admin.id, role: "ADMIN" },
    });

    const switchResponse = await fetch(`${BASE_URL}/api/auth/organization`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: secondOrganization.id }),
      redirect: "manual",
    });
    assert.equal(switchResponse.status, 200);

    const crossTenantPrivate = await fetch(privateFile.url, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    assert.equal(crossTenantPrivate.status, 404, "Arquivo privado de outro tenant deve ficar invisível.");

    const crossTenantDelete = await fetch(`${BASE_URL}/api/files/${privateToken}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    assert.equal(crossTenantDelete.status, 404, "Outro tenant não pode apagar o arquivo.");

    const switchBack = await fetch(`${BASE_URL}/api/auth/organization`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: organization.id }),
      redirect: "manual",
    });
    assert.equal(switchBack.status, 200);

    const deletePrivate = await fetch(`${BASE_URL}/api/files/${privateToken}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    assert.equal(deletePrivate.status, 200);
    privateToken = null;

    const afterDelete = await fetch(privateFile.url, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    assert.equal(afterDelete.status, 404);

    const deletePublic = await fetch(`${BASE_URL}/api/files/${publicToken}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    assert.equal(deletePublic.status, 200);
    publicToken = null;

    const audit = await db.auditLog.findMany({
      where: {
        organizationId: organization.id,
        action: { in: ["FILE_UPLOAD", "FILE_DELETE"] },
        entityType: "StoredFile",
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    assert.ok(audit.some((entry) => entry.action === "FILE_UPLOAD"));
    assert.ok(audit.some((entry) => entry.action === "FILE_DELETE"));

    console.log("✓ imagens públicas podem alimentar catálogo sem expor arquivos privados");
    console.log("✓ comprovantes privados exigem sessão e tenant correto");
    console.log("✓ token assinado rejeita adulteração de caminho/purpose");
    console.log("✓ tipos executáveis não autorizados são rejeitados");
    console.log("✓ upload e remoção deixam trilha de auditoria");
  } finally {
    if (secondOrganizationId) await db.organization.deleteMany({ where: { id: secondOrganizationId } });

    const activeCookie = await login(adminEmail, adminPassword);
    for (const token of [privateToken, publicToken]) {
      if (!token) continue;
      await fetch(`${BASE_URL}/api/files/${token}`, {
        method: "DELETE",
        headers: { Cookie: activeCookie },
        redirect: "manual",
      }).catch(() => undefined);
    }

    await db.session.deleteMany({ where: { userId: admin.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
