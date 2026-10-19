import assert from "node:assert/strict";
import { db } from "../lib/db";
import { verifySeparatedSale } from "../modules/sales/fulfillment";
import { getCommissionPreview } from "../modules/commissions/service";
import { getSaleTimeline } from "../modules/sales/timeline";
import { buildPackingSlipPdf } from "../modules/sales/packing-slip-pdf";

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
    data: { organizationId: organization.id, userId: seller.id, role: "SELLER", commissionPercent: "5.00" },
  });

  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password }),
    redirect: "manual",
  });
  assert.equal(login.status, 200);
  const cookie = cookiePair(login.headers.get("set-cookie"));

  const multiPage = buildPackingSlipPdf({
    organization: "Atacado de Homologacao",
    saleId: "pedido-multi-pagina",
    orderedAt: new Date("2026-10-14T12:00:00Z"),
    createdAt: new Date("2026-10-14T11:00:00Z"),
    client: "Cliente Comercio de Bijuterias",
    seller: "Vendedora Smoke",
    address: "Rua da Confiabilidade, 99 - Centro - Salvador BA",
    status: "SEPARATED",
    separatedBy: "Operador A",
    items: Array.from({ length: 80 }, (_, index) => ({
      sku: "REF-" + String(index + 1).padStart(3, "0"),
      description: "Produto de conferência código " + (index + 1) +
        " com descrição extensível e informações de lote",
      quantity: "12.000",
    })),
  });
  const rawPdf = multiPage.toString("latin1");
  assert.ok(rawPdf.startsWith("%PDF-1.4"), "Arquivo deve ser PDF real.");
  assert.ok(rawPdf.includes("xref") && rawPdf.includes("%%EOF"), "PDF deve ter referências e trailer.");
  assert.ok((rawPdf.match(/\/Type \/Page\b/g) ?? []).length >= 2,
    "Romaneio com muitos itens deve ser paginado.");
  assert.ok(rawPdf.includes("Pagina 2/"), "Páginas precisam ser numeradas.");
  assert.ok(!rawPdf.includes("preco") && !rawPdf.includes("costPrice"),
    "Romaneio nao deve carregar valores privados.");
  console.log("✓ PDF multipágina real, com paginação e sem dados financeiros");

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

    const forbiddenRomaneio = await requestJson(`/api/sales/${saleId}/packing-slip`, cookie);
    assert.equal(forbiddenRomaneio.status, 422,
      "Romaneio não deve ser gerado para orçamento não confirmado.");

    const anonymousRomaneio = await fetch(`${BASE_URL}/api/sales/${saleId}/packing-slip`, { redirect: "manual" });
    assert.equal(anonymousRomaneio.status, 401, "Romaneio exige autenticação.");

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

    // One integrated commercial journey must use the same sale record:
    // quote -> manager-approved discount -> order -> separation/check -> delivery -> paid -> commission.
    const discountRequested = await requestJson("/api/sales/" + saleId + "/discounts", cookie, {
      method: "POST",
      body: { percent: "10", reason: "Condição comercial aprovada para teste integrado" },
    });
    assert.equal(discountRequested.status, 201);
    const discount = (await discountRequested.json()).discount;
    assert.equal(discount.status, "PENDING");
    const blockedOrder = await requestJson("/api/sales/" + saleId + "/order", cookie, { method: "POST" });
    assert.equal(blockedOrder.status, 422, "Pedido deve esperar aprovação do desconto.");
    const approval = await requestJson(
      "/api/sales/" + saleId + "/discounts/" + discount.id + "/decision", cookie,
      { method: "POST", body: { decision: "APPROVE", reason: "Conferido pela gestão" } },
    );
    assert.equal(approval.status, 200);
    const discountedSale = await db.sale.findUniqueOrThrow({ where: { id: saleId! } });
    assert.equal(discountedSale.totalAmount.toFixed(2), "22.50");
    assert.equal(discountedSale.discountAmount.toFixed(2), "2.50");

    const orderResponse = await requestJson(`/api/sales/${saleId}/order`, cookie, { method: "POST" });
    assert.equal(orderResponse.status, 200);
    assert.equal((await db.sale.findUniqueOrThrow({ where: { id: saleId! } })).totalAmount.toFixed(2), "22.50");
    const pdfResponse = await requestJson(`/api/sales/${saleId}/packing-slip`, cookie);
    assert.equal(pdfResponse.status, 200, "Romaneio de pedido deve ser emitido.");
    assert.match(pdfResponse.headers.get("content-type") ?? "", /application\/pdf/);
    assert.match(pdfResponse.headers.get("content-disposition") ?? "", /attachment/);
    assert.match(pdfResponse.headers.get("cache-control") ?? "", /no-store/);
    const binary = Buffer.from(await pdfResponse.arrayBuffer());
    assert.ok(binary.toString("latin1").startsWith("%PDF-1.4"));
    assert.ok(binary.toString("latin1").includes("Cliente Suporte Smoke"));
    assert.ok(binary.toString("latin1").includes("Produto Support Smoke"));



    const orderBody = await orderResponse.json();
    const saleItemId = orderBody.sale.items[0].id as string;
    const saleQty = String(orderBody.sale.items[0].quantity);
    assert.equal(orderBody.sale.fulfillmentRequired, true);

    const blockedNewDispatch = await requestJson(`/api/sales/${saleId}/delivery`, cookie, {
      method: "PUT", body: { method: "PICKUP", pickupRegisteredAt: "2026-10-14T15:00:00.000Z" },
    });
    assert.equal(blockedNewDispatch.status, 422, "Entrega sem conferência deve ser bloqueada.");

    const invalidPack = await requestJson(`/api/sales/${saleId}/fulfillment/separate`, cookie, {
      method: "POST", body: { items: [{ saleItemId, quantity: "2" }] },
    });
    assert.equal(invalidPack.status, 422, "Separação com quantidade diferente deve ser recusada.");

    const packed = await requestJson(`/api/sales/${saleId}/fulfillment/separate`, cookie, {
      method: "POST", body: { items: [{ saleItemId, quantity: saleQty }] },
    });
    assert.equal(packed.status, 200);
    const packing = (await packed.json()).fulfillment;
    assert.equal(packing.status, "SEPARATED");
    const repeatedPack = await requestJson(`/api/sales/${saleId}/fulfillment/separate`, cookie, {
      method: "POST", body: { items: [{ saleItemId, quantity: saleQty }] },
    });
    assert.equal(repeatedPack.status, 422, "Separação duplicada deve ser recusada.");

    const selfChecked = await requestJson(`/api/sales/${saleId}/fulfillment/verify`, cookie, {
      method: "POST", body: { items: [{ saleItemId, quantity: saleQty }] },
    });
    assert.equal(selfChecked.status, 422, "A mesma pessoa não pode conferir a própria separação.");

    const verified = await verifySeparatedSale(
      { organizationId: organization.id, userId: seller.id, role: "SELLER" },
      saleId!, [{ saleItemId, quantity: saleQty }],
    );
    assert.equal(verified.status, "VERIFIED");
    assert.equal(verified.separatedByUserId, admin.id);
    assert.equal(verified.verifiedByUserId, seller.id);

    const checkView = await requestJson(`/api/sales/${saleId}/fulfillment`, cookie);
    assert.equal(checkView.status, 200);
    assert.equal((await checkView.json()).fulfillment.status, "VERIFIED");
    const repeatedCheck = await requestJson(`/api/sales/${saleId}/fulfillment/verify`, cookie, {
      method: "POST", body: { items: [{ saleItemId, quantity: saleQty }] },
    });
    assert.equal(repeatedCheck.status, 422, "Conferência encerrada não deve aceitar duplicação.");

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

    const paymentResponse = await requestJson("/api/sales/" + saleId + "/payments", cookie, {
      method: "POST", body: { method: "PIX", status: "PAID", amount: "22.50" },
    });
    assert.equal(paymentResponse.status, 201);
    const paid = (await paymentResponse.json()).result;
    assert.equal(paid.sale.stage, "PAID", "Pedido deve ficar quitado pelo total líquido.");
    const extraPayment = await requestJson("/api/sales/" + saleId + "/payments", cookie, {
      method: "POST", body: { method: "PIX", status: "PAID", amount: "0.01" },
    });
    assert.equal(extraPayment.status, 422, "Pagamento duplicado não pode ultrapassar total aprovado.");

    const state = await db.sale.findUniqueOrThrow({
      where: { id: saleId! },
      include: {
        items: true, payments: true, fulfillment: true, delivery: true, discountRequests: true,
      },
    });
    assert.equal(state.items.length, 1);
    assert.equal(state.items[0].lineTotal.toFixed(2), "25.00",
      "Item preserva preço bruto do catálogo.");
    assert.equal(state.payments.length, 1);
    assert.equal(state.discountRequests.length, 1);
    assert.equal(state.fulfillment?.status, "VERIFIED");
    assert.equal(state.delivery?.id, carrier.id);
    assert.equal(await db.sale.count({
      where: { id: saleId!, organizationId: organization.id },
    }), 1, "Orçamento, pedido, pagamento e entrega devem compartilhar a mesma venda.");

    const stock = await db.productStock.findUniqueOrThrow({ where: { productId: productId! } });
    assert.equal(stock.quantity.toFixed(3), "10.000",
      "Fluxo comercial não pode movimentar estoque antes das regras do módulo 3.");

    const previewMonth = state.orderedAt!.toISOString().slice(0, 7);
    const payableCountBefore = await db.accountPayable.count({
      where: { organizationId: organization.id },
    });
    const commissionPreview = await getCommissionPreview({
      organizationId: organization.id, userId: admin.id, role: "OWNER",
    }, previewMonth);
    const commissionLine = commissionPreview.sellers.flatMap((group) => group.sales)
      .find((item) => item.saleId === saleId);
    assert.equal(commissionLine?.commission.toFixed(2), "1.13",
      "Comissão de 5% usa total líquido de 22,50, com arredondamento comercial.");
    assert.equal(await db.accountPayable.count({
      where: { organizationId: organization.id },
    }), payableCountBefore, "Prévia não gera conta a pagar.");

    const commercialHistory = await getSaleTimeline({
      organizationId: organization.id, userId: admin.id, role: "OWNER",
    }, saleId!);
    assert.equal(commercialHistory.sale.client.id, clientId);
    assert.equal(commercialHistory.sale.seller.membershipId, sellerMembership.id);
    for (const event of ["QUOTE_CREATED", "ORDER_CONFIRMED", "PAYMENT_REGISTERED",
      "PAYMENT_SETTLED", "SALE_PAID", "DELIVERY_REGISTERED"]) {
      assert.ok(commercialHistory.timeline.some((row) => row.type === event),
        "Histórico comercial deve conter: " + event);
    }
    for (const [action, entityId, entityType] of [
      ["SALE_DISCOUNT_APPROVE", discount.id, "SaleDiscountRequest"],
      ["SALE_ITEMS_SEPARATED", packing.id, "SaleFulfillment"],
      ["SALE_ITEMS_VERIFIED", packing.id, "SaleFulfillment"],
    ]) {
      const auditCount: number = await db.auditLog.count({
        where: { organizationId: organization.id, action, entityId, entityType },
      });
      assert.equal(auditCount, 1, "Evento auditável deve ocorrer uma única vez: " + action);
    }
    console.log("✓ jornada integrada: desconto aprovado, pedido, conferência, entrega e pagamento líquido");
    console.log("✓ mesma venda e cliente, comissão sobre valor líquido e estoque preservado");

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
    const crossTenantPackingSlip = await requestJson(`/api/sales/${saleId}/packing-slip`, cookie);
    assert.equal(crossTenantPackingSlip.status, 404,
      "Romaneio não pode consultar pedido de outra empresa.");

    const crossTenantFulfillment = await requestJson(`/api/sales/${saleId}/fulfillment`, cookie);
    assert.equal(crossTenantFulfillment.status, 404);

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
