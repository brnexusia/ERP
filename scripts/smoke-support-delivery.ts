import assert from "node:assert/strict";
import { db } from "../lib/db";

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";

function cookiePair(setCookie: string | null): string {
  if (!setCookie) throw new Error("Login não retornou cookie de sessão.");
  return setCookie.split(";", 1)[0];
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
  const password = process.env.SEED_ADMIN_PASSWORD;
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  if (!adminEmail || !password) throw new Error("Credenciais seed são obrigatórias.");

  const organization = await db.organization.findUnique({ where: { slug } });
  const admin = await db.user.findUnique({ where: { email: adminEmail } });
  assert.ok(organization && admin, "Seed base não encontrado.");

  const seller = await db.user.create({
    data: { name: "Vendedora Support Smoke", email: `support-seller-${Date.now()}@example.test` },
  });
  const sellerMembership = await db.membership.create({
    data: { organizationId: organization.id, userId: seller.id, role: "SELLER" },
  });

  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password }),
    redirect: "manual",
  });
  assert.equal(login.status, 200);
  const cookie = cookiePair(login.headers.get("set-cookie"));

  let clientId: string | null = null;
  let categoryId: string | null = null;
  let productId: string | null = null;
  let saleId: string | null = null;
  let secondOrganizationId: string | null = null;

  try {
    const clientResponse = await requestJson("/api/clients", cookie, {
      method: "POST",
      body: {
        name: "Cliente Suporte Smoke",
        document: "11.222.333/0001-81",
        whatsapp: "55 71 94444-0000",
        email: "support-client@example.test",
        address: {
          postalCode: "44470-000",
          street: "Rua Suporte",
          number: "30",
          district: "Centro",
          city: "Vera Cruz",
          state: "BA",
          country: "BR",
        },
      },
    });
    assert.equal(clientResponse.status, 201, `Cliente falhou: ${clientResponse.status}`);
    clientId = (await clientResponse.json()).client.id;

    const assignResponse = await requestJson(`/api/clients/${clientId}/responsible-seller`, cookie, {
      method: "PATCH",
      body: { membershipId: sellerMembership.id },
    });
    assert.equal(assignResponse.status, 200);

    const categoryResponse = await requestJson("/api/product-categories", cookie, {
      method: "POST",
      body: { name: "Categoria Support Smoke" },
    });
    assert.equal(categoryResponse.status, 201);
    categoryId = (await categoryResponse.json()).category.id;

    const productResponse = await requestJson("/api/products", cookie, {
      method: "POST",
      body: {
        name: "Produto Support Smoke",
        sku: "SUPPORT-SMOKE-001",
        categoryId,
        brandManufacturer: "Marca Support",
        description: "Produto para validar suporte e logística.",
        costPrice: "10.00",
        salePrice: "25.00",
        unitMeasure: "UN",
        stock: { quantity: "10", minimum: "1", maximum: "30" },
      },
    });
    assert.equal(productResponse.status, 201);
    productId = (await productResponse.json()).product.id;

    const quoteResponse = await requestJson("/api/sales", cookie, {
      method: "POST",
      body: {
        clientId,
        channel: "WHATSAPP",
        items: [{ productId, quantity: "1" }],
      },
    });
    assert.equal(quoteResponse.status, 201);
    saleId = (await quoteResponse.json()).sale.id;

    const quoteDeliveryResponse = await requestJson(`/api/sales/${saleId}/delivery`, cookie, {
      method: "PUT",
      body: {
        method: "CORREIOS",
        trackingCode: "BR000000001XX",
      },
    });
    assert.equal(quoteDeliveryResponse.status, 422, "Orçamento não deveria aceitar entrega.");

    for (const kind of ["ATTENDANCE", "AFTER_SALES", "COMPLAINT", "SAC"] as const) {
      const supportResponse = await requestJson(`/api/clients/${clientId}/support`, cookie, {
        method: "POST",
        body: {
          kind,
          saleId,
          content: `Registro ${kind} do smoke test.`,
        },
      });
      assert.equal(supportResponse.status, 201, `Registro ${kind} falhou: ${supportResponse.status}`);
    }

    const supportHistoryResponse = await requestJson(`/api/clients/${clientId}/support`, cookie);
    assert.equal(supportHistoryResponse.status, 200);
    const supportHistory = (await supportHistoryResponse.json()).records;
    assert.equal(supportHistory.length, 4);
    assert.deepEqual(
      new Set(supportHistory.map((record: { kind: string }) => record.kind)),
      new Set(["ATTENDANCE", "AFTER_SALES", "COMPLAINT", "SAC"]),
    );
    assert.ok(supportHistory.every((record: { sale: { id: string } | null }) => record.sale?.id === saleId));

    const orderResponse = await requestJson(`/api/sales/${saleId}/order`, cookie, { method: "POST" });
    assert.equal(orderResponse.status, 200);

    const pickupAt = "2026-09-15T20:00:00.000-03:00";
    const pickupResponse = await requestJson(`/api/sales/${saleId}/delivery`, cookie, {
      method: "PUT",
      body: { method: "PICKUP", pickupRegisteredAt: pickupAt },
    });
    assert.equal(pickupResponse.status, 200);
    const pickup = (await pickupResponse.json()).delivery;
    assert.equal(pickup.method, "PICKUP");
    assert.ok(pickup.pickupRegisteredAt);
    assert.equal(pickup.trackingCode, null);

    const correiosResponse = await requestJson(`/api/sales/${saleId}/delivery`, cookie, {
      method: "PUT",
      body: { method: "CORREIOS", trackingCode: "BR000000002XX" },
    });
    assert.equal(correiosResponse.status, 200);
    const correios = (await correiosResponse.json()).delivery;
    assert.equal(correios.method, "CORREIOS");
    assert.equal(correios.trackingCode, "BR000000002XX");
    assert.equal(correios.pickupRegisteredAt, null);

    const carrierResponse = await requestJson(`/api/sales/${saleId}/delivery`, cookie, {
      method: "PUT",
      body: {
        method: "CARRIER",
        carrierName: "Transportadora Smoke",
        shipmentProofUrl: "https://example.test/comprovante-envio.pdf",
        deliveryProofUrl: "https://example.test/comprovante-entrega.pdf",
      },
    });
    assert.equal(carrierResponse.status, 200);
    const carrier = (await carrierResponse.json()).delivery;
    assert.equal(carrier.method, "CARRIER");
    assert.equal(carrier.carrierName, "Transportadora Smoke");
    assert.equal(carrier.shipmentProofUrl, "https://example.test/comprovante-envio.pdf");
    assert.equal(carrier.deliveryProofUrl, "https://example.test/comprovante-entrega.pdf");
    assert.equal(carrier.trackingCode, null);

    const getDeliveryResponse = await requestJson(`/api/sales/${saleId}/delivery`, cookie);
    assert.equal(getDeliveryResponse.status, 200);
    const savedDelivery = (await getDeliveryResponse.json()).delivery;
    assert.equal(savedDelivery.id, carrier.id, "Atualização logística deve permanecer no mesmo registro de entrega.");

    const supportAuditCount = await db.auditLog.count({
      where: {
        organizationId: organization.id,
        action: "CLIENT_SUPPORT_RECORD_CREATE",
        entityId: { in: supportHistory.map((record: { id: string }) => record.id) },
      },
    });
    assert.equal(supportAuditCount, 4);

    const deliveryAuditCount = await db.auditLog.count({
      where: {
        organizationId: organization.id,
        action: "SALE_DELIVERY_SAVE",
        entityId: carrier.id,
      },
    });
    assert.equal(deliveryAuditCount, 3);

    const secondOrganization = await db.organization.create({
      data: { name: "Support CI Second", slug: `support-ci-second-${Date.now()}` },
    });
    secondOrganizationId = secondOrganization.id;
    await db.membership.create({
      data: { organizationId: secondOrganization.id, userId: admin.id, role: "ADMIN" },
    });

    const switchResponse = await requestJson("/api/auth/organization", cookie, {
      method: "POST",
      body: { organizationId: secondOrganization.id },
    });
    assert.equal(switchResponse.status, 200);

    const crossTenantSupport = await requestJson(`/api/clients/${clientId}/support`, cookie);
    assert.equal(crossTenantSupport.status, 404);
    const crossTenantDelivery = await requestJson(`/api/sales/${saleId}/delivery`, cookie);
    assert.equal(crossTenantDelivery.status, 404);

    console.log("✓ atendimento, pós-venda, reclamações e SAC registrados no histórico do cliente");
    console.log("✓ suporte vinculado à venda sem quebrar o histórico comercial");
    console.log("✓ retirada registrada por data/hora");
    console.log("✓ código de rastreio dos Correios registrado");
    console.log("✓ transportadora e comprovantes de envio/entrega registrados");
    console.log("✓ suporte e logística isolados entre empresas");
  } finally {
    await db.session.deleteMany({ where: { userId: admin.id } });
    if (secondOrganizationId) await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    if (saleId) await db.sale.deleteMany({ where: { id: saleId } });
    if (productId) await db.product.deleteMany({ where: { id: productId, organizationId: organization.id } });
    if (categoryId) await db.productCategory.deleteMany({ where: { id: categoryId, organizationId: organization.id } });
    if (clientId) await db.client.deleteMany({ where: { id: clientId, organizationId: organization.id } });
    await db.membership.deleteMany({ where: { id: sellerMembership.id } });
    await db.user.deleteMany({ where: { id: seller.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
