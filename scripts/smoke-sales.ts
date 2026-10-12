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

  const sellerEmail = `seller-sales-${Date.now()}@example.test`;
  const seller = await db.user.create({
    data: { name: "Vendedora Smoke", email: sellerEmail },
  });
  const sellerMembership = await db.membership.create({
    data: {
      organizationId: organization.id,
      userId: seller.id,
      role: "SELLER",
    },
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
  let representativeId: string | null = null;
  let secondSaleId: string | null = null;
  let categoryId: string | null = null;
  let productId: string | null = null;
  let saleId: string | null = null;
  let secondOrganizationId: string | null = null;

  try {
    const representativeResponse = await requestJson("/api/representatives", cookie, {
      method: "POST",
      body: { name: "Representante Comercial Smoke", commissionPercent: "5.00" },
    });
    assert.equal(representativeResponse.status, 201);
    representativeId = (await representativeResponse.json()).representative.id;

    const sellersResponse = await requestJson("/api/sellers", cookie);
    assert.equal(sellersResponse.status, 200);
    const sellers = (await sellersResponse.json()).sellers;
    assert.ok(sellers.some((item: { id: string }) => item.id === sellerMembership.id));

    const clientResponse = await requestJson("/api/clients", cookie, {
      method: "POST",
      body: {
        name: "Cliente Comercial Smoke",
        document: "529.982.247-25",
        whatsapp: "55 71 96666-2222",
        email: "cliente-comercial@example.test",
        representativeId,
        address: {
          postalCode: "44470-000",
          street: "Rua Comercial",
          number: "10",
          district: "Centro",
          city: "Vera Cruz",
          state: "BA",
          country: "BR"
        }
      }
    });
    assert.equal(clientResponse.status, 201, `Cliente falhou: ${clientResponse.status}`);
    clientId = (await clientResponse.json()).client.id;

    const assignResponse = await requestJson(`/api/clients/${clientId}/responsible-seller`, cookie, {
      method: "PATCH",
      body: { membershipId: sellerMembership.id }
    });
    assert.equal(assignResponse.status, 200);
    assert.equal((await assignResponse.json()).client.responsibleSeller.id, sellerMembership.id);

    const categoryResponse = await requestJson("/api/product-categories", cookie, {
      method: "POST",
      body: { name: "Categoria Comercial Smoke" }
    });
    assert.equal(categoryResponse.status, 201);
    categoryId = (await categoryResponse.json()).category.id;

    const productResponse = await requestJson("/api/products", cookie, {
      method: "POST",
      body: {
        name: "Produto Comercial Smoke",
        sku: "SALE-SMOKE-001",
        categoryId,
        brandManufacturer: "Marca Smoke",
        description: "Produto para validar o fluxo comercial central.",
        costPrice: "10.00",
        salePrice: "29.90",
        unitMeasure: "UN",
        stock: { quantity: "50", minimum: "5", maximum: "100" }
      }
    });
    assert.equal(productResponse.status, 201);
    productId = (await productResponse.json()).product.id;

    const quoteResponse = await requestJson("/api/sales", cookie, {
      method: "POST",
      body: {
        clientId,
        channel: "WHATSAPP",
        items: [{ productId, quantity: "2" }]
      }
    });
    assert.equal(quoteResponse.status, 201, `Orçamento falhou: ${quoteResponse.status}`);
    const quote = (await quoteResponse.json()).sale;
    saleId = quote.id;
    assert.equal(quote.stage, "QUOTE");
    assert.equal(quote.representativeId, representativeId);
    assert.equal(String(quote.representativeRate), "5");
    assert.equal(quote.sellerMembershipId, sellerMembership.id);
    assert.equal(String(quote.totalAmount), "59.8");
    assert.equal(quote.items.length, 1);

    const updateQuoteResponse = await requestJson(`/api/sales/${saleId}`, cookie, {
      method: "PATCH",
      body: { items: [{ productId, quantity: "3" }], channel: "SITE", representativeRate: "4.50" }
    });
    assert.equal(updateQuoteResponse.status, 200);
    const updatedQuote = (await updateQuoteResponse.json()).sale;
    assert.equal(updatedQuote.id, saleId);
    assert.equal(updatedQuote.stage, "QUOTE");
    assert.equal(String(updatedQuote.representativeRate), "4.5");
    assert.equal(updatedQuote.channel, "SITE");
    assert.equal(String(updatedQuote.totalAmount), "89.7");

    const orderResponse = await requestJson(`/api/sales/${saleId}/order`, cookie, { method: "POST" });
    assert.equal(orderResponse.status, 200);
    const order = (await orderResponse.json()).sale;
    assert.equal(order.id, saleId);
    assert.equal(order.stage, "ORDER");
    assert.ok(order.orderedAt);

    const mutateOrderResponse = await requestJson(`/api/sales/${saleId}`, cookie, {
      method: "PATCH",
      body: { channel: "PHYSICAL_STORE" }
    });
    assert.equal(mutateOrderResponse.status, 422, "Pedido não deve voltar a ser orçamento editável.");

    const invalidPixDueDate = await requestJson(`/api/sales/${saleId}/payments`, cookie, {
      method: "POST",
      body: {
        method: "PIX",
        status: "PAID",
        amount: "1.00",
        dueDate: "2026-10-15T15:00:00.000Z"
      }
    });
    assert.equal(
      invalidPixDueDate.status,
      400,
      "Pix não deve aceitar vencimento; à vista/pré-datado pertence a boleto/cheque no escopo oficial.",
    );

    // Every new instalment needs manager approval and an available credit limit.
    const unauthorizedCredit = await requestJson(`/api/sales/${saleId}/payments`, cookie, {
      method: "POST",
      body: { method: "BOLETO", status: "PENDING", amount: "30.00",
        dueDate: "2026-10-15T15:00:00.000Z" },
    });
    assert.equal(unauthorizedCredit.status, 422, "Compra a prazo exige autorização do gestor.");
    const authorizeCredit = await requestJson(`/api/clients/${clientId}/credit-policy`, cookie, {
      method: "PATCH",
      body: { creditAllowed: true, creditMethods: ["BOLETO", "CHEQUE"] },
    });
    assert.equal(authorizeCredit.status, 200);
    const insufficientCreditLimit = await requestJson(`/api/clients/${clientId}/credit`, cookie, {
      method: "PATCH", body: { creditLimit: "20.00" },
    });
    assert.equal(insufficientCreditLimit.status, 200);
    const exceededCredit = await requestJson(`/api/sales/${saleId}/payments`, cookie, {
      method: "POST",
      body: { method: "BOLETO", status: "PENDING", amount: "30.00",
        dueDate: "2026-10-15T15:00:00.000Z" },
    });
    assert.equal(exceededCredit.status, 422, "Limite insuficiente deve impedir a venda a prazo.");
    const creditLimit = await requestJson(`/api/clients/${clientId}/credit`, cookie, {
      method: "PATCH", body: { creditLimit: "50.00" },
    });
    assert.equal(creditLimit.status, 200);

    const pendingPaymentResponse = await requestJson(`/api/sales/${saleId}/payments`, cookie, {
      method: "POST",
      body: {
        method: "BOLETO",
        status: "PENDING",
        amount: "30.00",
        dueDate: "2026-10-15T15:00:00.000Z"
      }
    });
    assert.equal(pendingPaymentResponse.status, 201);
    const pendingResult = (await pendingPaymentResponse.json()).result;
    const pendingPaymentId = pendingResult.payment.id as string;
    assert.equal(pendingResult.sale.stage, "ORDER");
    assert.equal(pendingResult.payment.settledAt, null);
    assert.ok(pendingResult.payment.dueDate, "Boleto pré-datado deve preservar vencimento.");
    const creditReserved = await db.clientCreditAccount.findFirstOrThrow({
      where: { clientId: clientId!, organizationId: organization.id },
    });
    assert.equal(creditReserved.usedAmount.toFixed(2), "30.00",
      "Parcela a prazo deve reservar exatamente seu valor.");


    const paidPaymentResponse = await requestJson(`/api/sales/${saleId}/payments`, cookie, {
      method: "POST",
      body: {
        method: "PIX",
        status: "PAID",
        amount: "59.70"
      }
    });
    assert.equal(paidPaymentResponse.status, 201);
    const partialResult = (await paidPaymentResponse.json()).result;
    assert.equal(partialResult.sale.stage, "ORDER");
    assert.equal(partialResult.payment.dueDate, null, "Pix à vista não deve possuir vencimento.");

    const overpaymentResponse = await requestJson(`/api/sales/${saleId}/payments`, cookie, {
      method: "POST",
      body: { method: "PIX", status: "PAID", amount: "0.01" }
    });
    assert.equal(overpaymentResponse.status, 422, "Pagamento acima do total registrado deve ser bloqueado.");

    const settleResponse = await requestJson(
      `/api/sales/${saleId}/payments/${pendingPaymentId}`,
      cookie,
      { method: "PATCH", body: { status: "PAID" } },
    );
    assert.equal(settleResponse.status, 200);
    const settled = (await settleResponse.json()).result;
    assert.equal(settled.sale.id, saleId);
    assert.equal(settled.sale.stage, "PAID");
    assert.ok(settled.sale.paidAt);
    const creditReleased = await db.clientCreditAccount.findFirstOrThrow({
      where: { clientId: clientId!, organizationId: organization.id },
    });
    assert.equal(creditReleased.usedAmount.toFixed(2), "0.00",
      "Quitar boleto reservado deve liberar o limite.");


    const purchaseHistoryResponse = await requestJson(`/api/clients/${clientId}/purchases`, cookie);
    assert.equal(purchaseHistoryResponse.status, 200);
    const purchases = (await purchaseHistoryResponse.json()).purchases;
    assert.equal(purchases.length, 1);
    assert.equal(purchases[0].id, saleId);
    assert.equal(purchases[0].stage, "PAID");
    assert.equal(purchases[0].payments.length, 2);

    const extraQuote = await requestJson("/api/sales", cookie, {
      method: "POST",
      body: { clientId, channel: "PHYSICAL_STORE", items: [{ productId, quantity: "1" }] },
    });
    assert.equal(extraQuote.status, 201);
    secondSaleId = (await extraQuote.json()).sale.id;
    const extraOrder = await requestJson(`/api/sales/${secondSaleId}/order`, cookie, { method: "POST" });
    assert.equal(extraOrder.status, 200);
    const valePayment = await requestJson(`/api/sales/${secondSaleId}/payments`, cookie, {
      method: "POST",
      body: { method: "VALE", amount: "20.00", status: "PENDING", dueDate: "2026-12-15T12:00:00.000Z" },
    });
    assert.equal(valePayment.status, 201);
    const valePaymentId = (await valePayment.json()).result.payment.id as string;
    const cashPayment = await requestJson(`/api/sales/${secondSaleId}/payments`, cookie, {
      method: "POST",
      body: { method: "CASH", amount: "9.90", status: "PAID" },
    });
    assert.equal(cashPayment.status, 201);
    const cashBody = (await cashPayment.json()).result;
    assert.equal(cashBody.sale.stage, "ORDER");
    const valeWithoutFunds = await requestJson(`/api/sales/${secondSaleId}/payments/${valePaymentId}`, cookie, {
      method: "PATCH", body: { status: "PAID" },
    });
    assert.equal(valeWithoutFunds.status, 422, "Vale sem saldo não pode quitar pedido.");
    const addValeFunds = await requestJson(`/api/clients/${clientId}/vale/movements`, cookie, {
      method: "POST", body: { amountDelta: "25.00", note: "Crédito para teste de resgate" },
    });
    assert.equal(addValeFunds.status, 201);
    const settleVale = await requestJson(`/api/sales/${secondSaleId}/payments/${valePaymentId}`, cookie, {
      method: "PATCH", body: { status: "PAID" },
    });
    assert.equal(settleVale.status, 200);
    assert.equal((await settleVale.json()).result.sale.stage, "PAID");
    const valeAccount = await db.clientValeAccount.findFirstOrThrow({
      where: { clientId: clientId!, organizationId: organization.id },
    });
    assert.equal(valeAccount.balance.toFixed(2), "5.00");
    const valeDebitCount = await db.clientValeMovement.count({
      where: { clientId: clientId!, organizationId: organization.id, amountDelta: "-20" },
    });
    assert.equal(valeDebitCount, 1, "Resgate de vale deve gerar apenas uma baixa.");
    const duplicateValeSettlement = await requestJson(
      `/api/sales/${secondSaleId}/payments/${valePaymentId}`, cookie,
      { method: "PATCH", body: { status: "PAID" } },
    );
    assert.equal(duplicateValeSettlement.status, 422, "Pedido quitado não deve ser debitado novamente.");
    const stableValeAccount = await db.clientValeAccount.findFirstOrThrow({
      where: { clientId: clientId!, organizationId: organization.id },
    });
    assert.equal(stableValeAccount.balance.toFixed(2), "5.00");
    const cashFlowResponse = await requestJson("/api/finance/cash-flow", cookie);
    assert.equal(cashFlowResponse.status, 200);
    const cashFlow = (await cashFlowResponse.json()).cashFlow;
    assert.equal(
      cashFlow.entries.some((entry: { sourceId: string }) => entry.sourceId === valePaymentId),
      false,
      "Vale pré-pago não representa uma nova entrada bancária.",
    );

    console.log("✓ representante por venda, percentual negociado e pagamentos cash/vale validados");

    const saleCount = await db.sale.count({ where: { id: saleId!, organizationId: organization.id } });
    assert.equal(saleCount, 1, "Orçamento, pedido e pagamento devem permanecer no mesmo registro de venda.");

    const secondOrganization = await db.organization.create({
      data: { name: "Sales CI Second", slug: `sales-ci-second-${Date.now()}` }
    });
    secondOrganizationId = secondOrganization.id;
    await db.membership.create({
      data: { organizationId: secondOrganization.id, userId: admin.id, role: "ADMIN" }
    });

    const switchResponse = await requestJson("/api/auth/organization", cookie, {
      method: "POST",
      body: { organizationId: secondOrganization.id }
    });
    assert.equal(switchResponse.status, 200);

    const crossTenantResponse = await requestJson(`/api/sales/${saleId}`, cookie);
    assert.equal(crossTenantResponse.status, 404, "Venda de outra empresa deveria retornar 404.");

    console.log("✓ vínculo cliente-vendedora validado");
    console.log("✓ orçamento -> pedido -> pagamento no mesmo registro validado");
    console.log("✓ itens, quantidade, canal, valores e vendedora preservados");
    console.log("✓ boleto pré-datado, Pix à vista e quitação final validados");
    console.log("✓ vencimento indevido em Pix bloqueado pela API");
    console.log("✓ histórico de compras real do cliente validado");
    console.log("✓ isolamento multiempresa do fluxo comercial validado");
  } finally {
    await db.session.deleteMany({ where: { userId: admin.id } });
    if (secondOrganizationId) {
      await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    }
    if (saleId || secondSaleId) {
      await db.sale.deleteMany({ where: { id: { in: [saleId, secondSaleId].filter((id): id is string => id !== null) } } });
    }
    if (productId) await db.product.deleteMany({ where: { id: productId, organizationId: organization.id } });
    if (categoryId) await db.productCategory.deleteMany({ where: { id: categoryId, organizationId: organization.id } });
    if (clientId) await db.client.deleteMany({ where: { id: clientId, organizationId: organization.id } });
    if (representativeId) await db.representative.deleteMany({ where: { id: representativeId, organizationId: organization.id } });
    await db.membership.deleteMany({ where: { id: sellerMembership.id } });
    await db.user.deleteMany({ where: { id: seller.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
