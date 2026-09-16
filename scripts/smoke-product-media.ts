import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
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
  assert.equal(response.status, 200);
  return cookiePair(response.headers.get("set-cookie"));
}

async function uploadProductImage(cookie: string, productId: string, variation: string) {
  const pngBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
  const form = new FormData();
  form.append("file", new Blob([pngBytes.slice().buffer as ArrayBuffer], { type: "image/png" }), "produto.png");
  form.append("variation", variation);

  return fetch(`${BASE_URL}/api/products/${productId}/photos`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
    redirect: "manual",
  });
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  if (!adminEmail || !password) throw new Error("Credenciais seed são obrigatórias.");

  const organization = await db.organization.findUnique({ where: { slug } });
  const admin = await db.user.findUnique({ where: { email: adminEmail } });
  assert.ok(organization && admin, "Seed base não encontrado.");

  const suffix = Date.now();
  const category = await db.productCategory.create({
    data: {
      organizationId: organization.id,
      name: `Product Media Smoke ${suffix}`,
    },
  });
  const product = await db.product.create({
    data: {
      organizationId: organization.id,
      categoryId: category.id,
      name: "Produto Media Smoke",
      sku: `MEDIA-${suffix}`,
      brandManufacturer: "Marca Media",
      description: "Produto usado para validar upload direto de imagem.",
      costPrice: new Prisma.Decimal("10.00"),
      salePrice: new Prisma.Decimal("25.00"),
      unitMeasure: "UN",
    },
  });

  const cookie = await login(adminEmail, password);
  let token: string | null = null;
  let photoId: string | null = null;
  let secondOrganizationId: string | null = null;

  try {
    const uploadResponse = await uploadProductImage(cookie, product.id, "Azul / M");
    assert.equal(uploadResponse.status, 201, `Upload vinculado ao produto falhou: ${uploadResponse.status}`);
    const uploaded = await uploadResponse.json();
    token = String(uploaded.file.token);
    photoId = String(uploaded.photo.id);

    assert.equal(uploaded.photo.productId, product.id);
    assert.equal(uploaded.photo.variation, "Azul / M");
    assert.equal(uploaded.file.purpose, "PRODUCT_IMAGE");
    assert.equal(uploaded.file.visibility, "public");
    assert.equal(uploaded.photo.url, uploaded.file.url);

    const storedPhoto = await db.productPhoto.findUnique({ where: { id: photoId } });
    assert.equal(storedPhoto?.organizationId, organization.id);
    assert.equal(storedPhoto?.productId, product.id);
    assert.equal(storedPhoto?.variation, "Azul / M");

    const publicRead = await fetch(uploaded.photo.url, { redirect: "manual" });
    assert.equal(publicRead.status, 200);
    assert.equal(publicRead.headers.get("content-type"), "image/png");

    const productAfterUpload = await fetch(`${BASE_URL}/api/products/${product.id}`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    assert.equal(productAfterUpload.status, 200);
    const productPayload = (await productAfterUpload.json()).product;
    assert.ok(productPayload.photos.some((photo: { id: string }) => photo.id === photoId));

    const secondOrganization = await db.organization.create({
      data: { name: "Product Media CI Second", slug: `product-media-ci-second-${suffix}` },
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

    const crossTenantUpload = await uploadProductImage(cookie, product.id, "Tentativa externa");
    assert.equal(crossTenantUpload.status, 404, "Produto de outro tenant deve ficar invisível no upload.");

    const switchBack = await fetch(`${BASE_URL}/api/auth/organization`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: organization.id }),
      redirect: "manual",
    });
    assert.equal(switchBack.status, 200);

    const audit = await db.auditLog.findFirst({
      where: {
        organizationId: organization.id,
        action: "PRODUCT_PHOTO_ATTACH",
        entityType: "ProductPhoto",
        entityId: photoId,
      },
    });
    assert.ok(audit, "Vínculo da imagem com o produto precisa ser auditado.");

    console.log("✓ imagem enviada pelo ERP é armazenada e vinculada diretamente ao produto");
    console.log("✓ variação da foto permanece registrada no cadastro do produto");
    console.log("✓ imagem pública vinculada pode ser consumida pelo catálogo");
    console.log("✓ upload de foto de produto permanece isolado entre empresas");
  } finally {
    if (secondOrganizationId) await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    if (photoId) await db.productPhoto.deleteMany({ where: { id: photoId } });
    if (token) {
      await fetch(`${BASE_URL}/api/files/${token}`, {
        method: "DELETE",
        headers: { Cookie: cookie },
        redirect: "manual",
      }).catch(() => undefined);
    }
    await db.product.deleteMany({ where: { id: product.id } });
    await db.productCategory.deleteMany({ where: { id: category.id } });
    await db.session.deleteMany({ where: { userId: admin.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
