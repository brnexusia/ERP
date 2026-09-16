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

async function uploadProof(cookie: string, saleId: string, kind: "shipment" | "delivery") {
  const pdf = new TextEncoder().encode(`%PDF-1.4\nERP ${kind} PROOF\n%%EOF`);
  const form = new FormData();
  form.append("file", new Blob([pdf.slice().buffer as ArrayBuffer], { type: "application/pdf" }), `${kind}.pdf`);
  form.append("kind", kind);

  return fetch(`${BASE_URL}/api/sales/${saleId}/delivery/proofs`, {
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
  const seller = await db.membership.findFirst({
    where: { organizationId: organization?.id, role: "SELLER" },
  }) ?? await db.membership.findFirst({
    where: { organizationId: organization?.id },
  });
  assert.ok(organization && admin && seller, "Seed base não encontrado.");

  const suffix = Date.now();
  const client = await db.client.create({
    data: {
      organizationId: organization.id,
      name: "Cliente Delivery Media Smoke",
      documentType: "CPF",
      document: `delivery-media-${suffix}`,
      whatsapp: `55${suffix}`,
      email: `delivery-media-${suffix}@example.test`,
    },
  });
  const sale = await db.sale.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      sellerMembershipId: seller.id,
      stage: "ORDER",
      channel: "WHATSAPP",
      totalAmount: new Prisma.Decimal("90.00"),
      orderedAt: new Date(),
    },
  });
  const delivery = await db.saleDelivery.create({
    data: {
      organizationId: organization.id,
      saleId: sale.id,
      method: "CARRIER",
      carrierName: "Transportadora Smoke",
    },
  });

  const cookie = await login(adminEmail, password);
  const tokens: string[] = [];
  let secondOrganizationId: string | null = null;

  try {
    const shipmentResponse = await uploadProof(cookie, sale.id, "shipment");
    assert.equal(shipmentResponse.status, 201, `Upload de comprovante de envio falhou: ${shipmentResponse.status}`);
    const shipment = await shipmentResponse.json();
    tokens.push(String(shipment.file.token));
    assert.equal(shipment.file.visibility, "private");
    assert.equal(shipment.file.purpose, "DELIVERY_PROOF");
    assert.equal(shipment.delivery.shipmentProofUrl, shipment.file.url);

    const anonymousShipment = await fetch(shipment.file.url, { redirect: "manual" });
    assert.equal(anonymousShipment.status, 401, "Comprovante de envio não pode ser público.");

    const duplicateShipment = await uploadProof(cookie, sale.id, "shipment");
    assert.equal(duplicateShipment.status, 422, "Segundo comprovante do mesmo tipo deve exigir decisão explícita de substituição.");

    const deliveryResponse = await uploadProof(cookie, sale.id, "delivery");
    assert.equal(deliveryResponse.status, 201, `Upload de comprovante de entrega falhou: ${deliveryResponse.status}`);
    const deliveryPayload = await deliveryResponse.json();
    tokens.push(String(deliveryPayload.file.token));
    assert.equal(deliveryPayload.delivery.deliveryProofUrl, deliveryPayload.file.url);

    const stored = await db.saleDelivery.findUnique({ where: { id: delivery.id } });
    assert.equal(stored?.shipmentProofUrl, shipment.file.url);
    assert.equal(stored?.deliveryProofUrl, deliveryPayload.file.url);

    const secondOrganization = await db.organization.create({
      data: { name: "Delivery Media CI Second", slug: `delivery-media-ci-second-${suffix}` },
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

    const crossTenantUpload = await uploadProof(cookie, sale.id, "shipment");
    assert.equal(crossTenantUpload.status, 404, "Entrega de outro tenant deve ficar invisível.");

    const switchBack = await fetch(`${BASE_URL}/api/auth/organization`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: organization.id }),
      redirect: "manual",
    });
    assert.equal(switchBack.status, 200);

    const audit = await db.auditLog.count({
      where: {
        organizationId: organization.id,
        action: "SALE_DELIVERY_PROOF_ATTACH",
        entityType: "SaleDelivery",
        entityId: delivery.id,
      },
    });
    assert.equal(audit, 2);

    console.log("✓ comprovantes de envio e entrega ficam ligados à mesma entrega/venda");
    console.log("✓ comprovantes são privados e não abrem sem sessão");
    console.log("✓ duplicação acidental não substitui comprovante já registrado");
    console.log("✓ comprovantes permanecem isolados entre empresas e auditados");
  } finally {
    if (secondOrganizationId) await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    await db.saleDelivery.updateMany({
      where: { id: delivery.id },
      data: { shipmentProofUrl: null, deliveryProofUrl: null },
    });
    for (const token of tokens) {
      await fetch(`${BASE_URL}/api/files/${token}`, {
        method: "DELETE",
        headers: { Cookie: cookie },
        redirect: "manual",
      }).catch(() => undefined);
    }
    await db.sale.deleteMany({ where: { id: sale.id } });
    await db.client.deleteMany({ where: { id: client.id } });
    await db.session.deleteMany({ where: { userId: admin.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
