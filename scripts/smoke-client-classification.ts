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

async function createClient(
  cookie: string,
  name: string,
  document: string,
  email: string,
  whatsapp: string,
) {
  const response = await requestJson("/api/clients", cookie, {
    method: "POST",
    body: {
      name,
      document,
      whatsapp,
      email,
      address: {
        postalCode: "44470-000",
        street: "Rua Classificação",
        number: "100",
        district: "Centro",
        city: "Vera Cruz",
        state: "BA",
        country: "BR",
      },
    },
  });
  assert.equal(response.status, 201, `Falha ao criar ${name}: ${response.status}`);
  return (await response.json()).client.id as string;
}

async function createPaidSale(
  cookie: string,
  clientId: string,
  productId: string,
  paidAt: Date,
) {
  const quote = await requestJson("/api/sales", cookie, {
    method: "POST",
    body: {
      clientId,
      channel: "WHATSAPP",
      items: [{ productId, quantity: "1" }],
    },
  });
  assert.equal(quote.status, 201, `Orçamento falhou: ${quote.status}`);
  const saleId = (await quote.json()).sale.id as string;

  const order = await requestJson(`/api/sales/${saleId}/order`, cookie, { method: "POST" });
  assert.equal(order.status, 200, `Pedido falhou: ${order.status}`);

  const payment = await requestJson(`/api/sales/${saleId}/payments`, cookie, {
    method: "POST",
    body: { method: "PIX", status: "PAID", amount: "30.00" },
  });
  assert.equal(payment.status, 201, `Pagamento falhou: ${payment.status}`);

  await db.sale.update({ where: { id: saleId }, data: { paidAt } });
  return saleId;
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  if (!adminEmail || !password) throw new Error("Credenciais seed são obrigatórias.");

  const organization = await db.organization.findUnique({ where: { slug } });
  const admin = await db.user.findUnique({ where: { email: adminEmail } });
  assert.ok(organization && admin, "Seed base não encontrado.");

  const previousSettings = await db.clientModuleSettings.findUnique({
    where: { organizationId: organization.id },
  });

  const seller = await db.user.create({
    data: { name: "Vendedora Classification Smoke", email: `classification-seller-${Date.now()}@example.test` },
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

  const clientIds: string[] = [];
  const saleIds: string[] = [];
  let categoryId: string | null = null;
  let productId: string | null = null;
  let secondOrganizationId: string | null = null;

  try {
    const settingsResponse = await requestJson("/api/client-settings", cookie, {
      method: "PATCH",
      body: { inactivityDays: 30 },
    });
    assert.equal(settingsResponse.status, 200);

    const clients = {
      noPurchase: await createClient(
        cookie,
        "Cliente Sem Compra Classification",
        "390.533.447-05",
        "classification-none@example.test",
        "5571999000001",
      ),
      newActive: await createClient(
        cookie,
        "Cliente Novo Classification",
        "529.982.247-25",
        "classification-new@example.test",
        "5571999000002",
      ),
      recurring: await createClient(
        cookie,
        "Cliente Recorrente Classification",
        "111.444.777-35",
        "classification-recurring@example.test",
        "5571999000003",
      ),
      stopped: await createClient(
        cookie,
        "Cliente Parado Classification",
        "935.411.347-80",
        "classification-stopped@example.test",
        "5571999000004",
      ),
    };
    clientIds.push(...Object.values(clients));

    for (const clientId of [clients.newActive, clients.recurring, clients.stopped]) {
      const assignment = await requestJson(`/api/clients/${clientId}/responsible-seller`, cookie, {
        method: "PATCH",
        body: { membershipId: sellerMembership.id },
      });
      assert.equal(assignment.status, 200);
    }

    const categoryResponse = await requestJson("/api/product-categories", cookie, {
      method: "POST",
      body: { name: "Classification Smoke" },
    });
    assert.equal(categoryResponse.status, 201);
    categoryId = (await categoryResponse.json()).category.id;

    const productResponse = await requestJson("/api/products", cookie, {
      method: "POST",
      body: {
        name: "Produto Classification Smoke",
        sku: `CLASSIFICATION-${Date.now()}`,
        categoryId,
        brandManufacturer: "Marca Classification",
        description: "Produto para validar classificação de clientes.",
        costPrice: "10.00",
        salePrice: "30.00",
        unitMeasure: "UN",
        stock: { quantity: "100", minimum: "1", maximum: "200" },
      },
    });
    assert.equal(productResponse.status, 201);
    productId = (await productResponse.json()).product.id;

    saleIds.push(
      await createPaidSale(cookie, clients.newActive, productId!, new Date(Date.now() - 5 * 86_400_000)),
      await createPaidSale(cookie, clients.recurring, productId!, new Date(Date.now() - 60 * 86_400_000)),
      await createPaidSale(cookie, clients.recurring, productId!, new Date(Date.now() - 2 * 86_400_000)),
      await createPaidSale(cookie, clients.stopped, productId!, new Date(Date.now() - 45 * 86_400_000)),
    );

    const classificationResponse = await requestJson("/api/reports/clients/classification", cookie);
    assert.equal(classificationResponse.status, 200, `Classificação falhou: ${classificationResponse.status}`);
    const report = (await classificationResponse.json()).report;
    assert.equal(report.inactivityDays, 30);
    assert.equal(report.reducedPurchases.status, "PENDING_RULE_DEFINITION");

    const byId = new Map(report.clients.map((entry: { client: { id: string } }) => [entry.client.id, entry]));

    const noPurchase = byId.get(clients.noPurchase) as {
      customerType: string;
      stoppedBuying: boolean | null;
      purchaseCount: number;
    };
    assert.equal(noPurchase.customerType, "NO_PURCHASE");
    assert.equal(noPurchase.purchaseCount, 0);
    assert.equal(noPurchase.stoppedBuying, false);

    const newActive = byId.get(clients.newActive) as {
      customerType: string;
      stoppedBuying: boolean | null;
      purchaseCount: number;
    };
    assert.equal(newActive.customerType, "NEW");
    assert.equal(newActive.purchaseCount, 1);
    assert.equal(newActive.stoppedBuying, false);

    const recurring = byId.get(clients.recurring) as {
      customerType: string;
      stoppedBuying: boolean | null;
      purchaseCount: number;
    };
    assert.equal(recurring.customerType, "RECURRING");
    assert.equal(recurring.purchaseCount, 2);
    assert.equal(recurring.stoppedBuying, false);

    const stopped = byId.get(clients.stopped) as {
      customerType: string;
      stoppedBuying: boolean | null;
      purchaseCount: number;
      daysWithoutPurchase: number;
    };
    assert.equal(stopped.customerType, "NEW");
    assert.equal(stopped.purchaseCount, 1);
    assert.equal(stopped.stoppedBuying, true);
    assert.ok(stopped.daysWithoutPurchase >= 45);
    assert.ok(report.summary.stoppedBuying >= 1);

    const secondOrganization = await db.organization.create({
      data: { name: "Classification CI Second", slug: `classification-ci-second-${Date.now()}` },
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

    const isolatedResponse = await requestJson("/api/reports/clients/classification", cookie);
    assert.equal(isolatedResponse.status, 200);
    const isolated = (await isolatedResponse.json()).report;
    assert.equal(
      isolated.clients.some((entry: { client: { id: string } }) => clientIds.includes(entry.client.id)),
      false,
      "Classificação não pode vazar clientes entre empresas.",
    );

    console.log("✓ clientes sem compra, novos e recorrentes classificados pelo histórico real");
    console.log("✓ cliente que parou de comprar usa o X dias já configurado no módulo de clientes");
    console.log("✓ redução de compras permanece explicitamente pendente sem regra inventada");
    console.log("✓ classificação permanece isolada entre empresas");
  } finally {
    await db.session.deleteMany({ where: { userId: admin.id } });
    if (secondOrganizationId) await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    await db.sale.deleteMany({ where: { id: { in: saleIds } } });
    if (productId) await db.product.deleteMany({ where: { id: productId, organizationId: organization.id } });
    if (categoryId) await db.productCategory.deleteMany({ where: { id: categoryId, organizationId: organization.id } });
    await db.client.deleteMany({ where: { id: { in: clientIds }, organizationId: organization.id } });
    if (previousSettings) {
      await db.clientModuleSettings.update({
        where: { organizationId: organization.id },
        data: { inactivityDays: previousSettings.inactivityDays },
      });
    } else {
      await db.clientModuleSettings.deleteMany({ where: { organizationId: organization.id } });
    }
    await db.membership.deleteMany({ where: { id: sellerMembership.id } });
    await db.user.deleteMany({ where: { id: seller.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
