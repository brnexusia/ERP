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
  let categoryId: string | null = null;
  let productId: string | null = null;
  let saleId: string | null = null;
  let secondOrganizationId: string | null = null;

  try {
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
    assert.equal(quote.sellerMembershipId, sellerMembership.id);
    assert.equal(String(quote.totalAmount), "59.8");
    assert.equal(quote.items.length, 1);

    const updateQuoteResponse = await requestJson(`/api/sales/${saleId}`, cookie, {
      method: "PATCH",
      body: { items: [{ productId, quantity: "3" }], channel: "SITE" }
    });
    assert.equal(updateQuoteResponse.status, 200);
    const updatedQuote = (await updateQuoteResponse.json()).sale;
    assert.equal(updatedQuote.id, saleId);
    assert.equal(updatedQuote.stage, "QUOTE");
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

    const purchaseHistoryResponse = await requestJson(`/api/clients/${clientId}/purchases`, cookie);
    assert.equal(purchaseHistoryResponse.status, 200);
    const purchases = (await purchaseHistoryResponse.json()).purchases;
    assert.equal(purchases.length, 1);
    assert.equal(purchases[0].id, saleId);
    assert.equal(purchases[0].stage, "PAID");
    assert.equal(purchases[0].payments.length, 2);

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
    console.log("✓ boleto pendente, Pix pago e quitação final validados");
    console.log("✓ histórico de compras real do cliente validado");
    console.log("✓ isolamento multiempresa do fluxo comercial validado");
  } finally {
    await db.session.deleteMany({ where: { userId: admin.id } });
    if (secondOrganizationId) {
      await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    }
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
