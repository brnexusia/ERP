import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "../lib/db";

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";

function cookiePair(setCookie: string | null): string {
  if (!setCookie) throw new Error("Login não retornou cookie de sessão.");
  return setCookie.split(";", 1)[0];
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  if (!email || !password) throw new Error("Credenciais seed obrigatórias.");

  const organization = await db.organization.findUnique({ where: { slug } });
  assert.ok(organization, "Tenant seed não encontrado.");

  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  assert.equal(login.status, 200);
  const cookie = cookiePair(login.headers.get("set-cookie"));
  const sessionToken = cookie.slice(cookie.indexOf("=") + 1);
  const sessionTokenHash = createHash("sha256").update(sessionToken).digest("hex");

  const suffix = Date.now().toString();
  const sellerUser = await db.user.create({
    data: { name: "Vendedora Payment History", email: `payment-history-seller-${suffix}@example.test` },
  });
  const seller = await db.membership.create({
    data: { organizationId: organization.id, userId: sellerUser.id, role: "SELLER" },
  });
  const client = await db.client.create({
    data: {
      organizationId: organization.id,
      responsibleSellerMembershipId: seller.id,
      name: "Cliente Payment History",
      documentType: "CPF",
      document: `payment-history-${suffix}`,
      whatsapp: `55719${suffix.slice(-8)}`,
      email: `payment-history-client-${suffix}@example.test`,
    },
  });

  const now = new Date();
  const paidSale = await db.sale.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      sellerMembershipId: seller.id,
      stage: "PAID",
      channel: "WHATSAPP",
      totalAmount: new Prisma.Decimal("100.00"),
      orderedAt: now,
      paidAt: now,
    },
  });
  const pendingSale = await db.sale.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      sellerMembershipId: seller.id,
      stage: "ORDER",
      channel: "SITE",
      totalAmount: new Prisma.Decimal("80.00"),
      orderedAt: now,
    },
  });

  await db.salePayment.createMany({
    data: [
      {
        organizationId: organization.id,
        saleId: paidSale.id,
        method: "PIX",
        status: "PAID",
        amount: new Prisma.Decimal("60.00"),
        settledAt: now,
      },
      {
        organizationId: organization.id,
        saleId: paidSale.id,
        method: "CARD",
        status: "PAID",
        amount: new Prisma.Decimal("40.00"),
        settledAt: now,
      },
      {
        organizationId: organization.id,
        saleId: pendingSale.id,
        method: "BOLETO",
        status: "PENDING",
        amount: new Prisma.Decimal("80.00"),
        dueDate: new Date(Date.now() + 86_400_000),
      },
    ],
  });

  let secondOrganizationId: string | null = null;
  let secondClientId: string | null = null;

  try {
    const response = await fetch(`${BASE_URL}/api/clients/${client.id}/payment-history`, {
      headers: { Cookie: cookie },
    });
    assert.equal(response.status, 200, `Histórico de pagamento falhou: ${response.status}`);
    const history = (await response.json()).paymentHistory;

    assert.equal(history.client.id, client.id);
    assert.equal(history.summary.records, 3);
    assert.equal(history.summary.paidRecords, 2);
    assert.equal(history.summary.pendingRecords, 1);
    assert.equal(history.summary.registeredAmount, "180");
    assert.equal(history.summary.paidAmount, "100");
    assert.equal(history.summary.byMethod.PIX.records, 1);
    assert.equal(history.summary.byMethod.PIX.paidRecords, 1);
    assert.equal(history.summary.byMethod.CARD.paidAmount, "40");
    assert.equal(history.summary.byMethod.BOLETO.pendingRecords, 1);
    assert.equal(history.summary.byMethod.CHEQUE.records, 0);
    assert.ok(history.payments.some((payment: { sale: { id: string }; method: string; status: string }) =>
      payment.sale.id === pendingSale.id && payment.method === "BOLETO" && payment.status === "PENDING"));

    const centralResponse = await fetch(`${BASE_URL}/api/clients/${client.id}/central-profile`, {
      headers: { Cookie: cookie },
    });
    assert.equal(centralResponse.status, 200);
    const central = (await centralResponse.json()).profile;
    assert.equal(central.financial.paymentHistory.summary.records, 3);
    assert.equal(central.financial.paymentHistory.summary.paidAmount, "100");

    const secondOrganization = await db.organization.create({
      data: { name: "Payment History Second", slug: `payment-history-second-${suffix}` },
    });
    secondOrganizationId = secondOrganization.id;
    const secondClient = await db.client.create({
      data: {
        organizationId: secondOrganization.id,
        name: "Cliente Outro Tenant",
        documentType: "CPF",
        document: `payment-history-second-${suffix}`,
        whatsapp: `55718${suffix.slice(-8)}`,
        email: `payment-history-second-client-${suffix}@example.test`,
      },
    });
    secondClientId = secondClient.id;

    const isolatedResponse = await fetch(`${BASE_URL}/api/clients/${secondClient.id}/payment-history`, {
      headers: { Cookie: cookie },
    });
    assert.equal(isolatedResponse.status, 404);

    console.log("✓ histórico de formas de pagamento lista registros reais com status e venda de origem");
    console.log("✓ resumo separa valores registrados, quitados e pendentes por forma de pagamento");
    console.log("✓ perfil central do cliente incorpora o histórico financeiro de pagamentos");
    console.log("✓ histórico de pagamento permanece isolado entre empresas");
  } finally {
    if (secondClientId) await db.client.deleteMany({ where: { id: secondClientId } });
    if (secondOrganizationId) await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    await db.salePayment.deleteMany({ where: { saleId: { in: [paidSale.id, pendingSale.id] } } });
    await db.sale.deleteMany({ where: { id: { in: [paidSale.id, pendingSale.id] } } });
    await db.client.deleteMany({ where: { id: client.id } });
    await db.membership.deleteMany({ where: { id: seller.id } });
    await db.user.deleteMany({ where: { id: sellerUser.id } });
    await db.session.deleteMany({ where: { tokenHash: sessionTokenHash } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
