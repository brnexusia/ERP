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
    data: { name: "Vendedora Finance Smoke", email: `finance-seller-${Date.now()}@example.test` },
  });
  const sellerMembership = await db.membership.create({
    data: { organizationId: organization.id, userId: seller.id, role: "SELLER" },
  });
  const client = await db.client.create({
    data: {
      organizationId: organization.id,
      responsibleSellerMembershipId: sellerMembership.id,
      name: "Cliente Finance Smoke",
      documentType: "CPF",
      document: `3905334470${Date.now() % 10}`,
      whatsapp: "5571999990000",
      email: `finance-client-${Date.now()}@example.test`,
    },
  });
  const sale = await db.sale.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      sellerMembershipId: sellerMembership.id,
      stage: "ORDER",
      channel: "SITE",
      totalAmount: "100.00",
      orderedAt: new Date(),
    },
  });
  const salePayment = await db.salePayment.create({
    data: {
      organizationId: organization.id,
      saleId: sale.id,
      method: "BOLETO",
      status: "PENDING",
      amount: "100.00",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

  let payableId: string | null = null;
  let creditBankEntryId: string | null = null;
  let debitBankEntryId: string | null = null;
  let mismatchBankEntryId: string | null = null;
  let secondOrganizationId: string | null = null;

  try {
    const receivablesResponse = await requestJson("/api/finance/receivables", cookie);
    assert.equal(receivablesResponse.status, 200);
    const receivables = (await receivablesResponse.json()).receivables;
    const pendingReceivable = receivables.find((item: { id: string }) => item.id === salePayment.id);
    assert.ok(pendingReceivable, "Pagamento pendente deveria aparecer em contas a receber.");
    assert.equal(pendingReceivable.status, "PENDING");
    assert.equal(Number(pendingReceivable.amount), 100);

    const payableResponse = await requestJson("/api/finance/payables", cookie, {
      method: "POST",
      body: {
        description: "Fornecedor Finance Smoke",
        amount: "40.00",
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    assert.equal(payableResponse.status, 201, `Conta a pagar falhou: ${payableResponse.status}`);
    const payable = (await payableResponse.json()).payable;
    payableId = payable.id;
    assert.equal(payable.status, "PENDING");

    const settlePayableResponse = await requestJson(`/api/finance/payables/${payableId}/settle`, cookie, {
      method: "POST",
    });
    assert.equal(settlePayableResponse.status, 200);
    const settledPayable = (await settlePayableResponse.json()).payable;
    assert.equal(settledPayable.status, "PAID");
    assert.ok(settledPayable.paidAt);

    const settleReceivableResponse = await requestJson(
      `/api/sales/${sale.id}/payments/${salePayment.id}`,
      cookie,
      { method: "PATCH", body: { status: "PAID" } },
    );
    assert.equal(settleReceivableResponse.status, 200);
    const settledSalePayment = (await settleReceivableResponse.json()).result.payment;
    assert.equal(settledSalePayment.status, "PAID");
    assert.ok(settledSalePayment.settledAt);

    const cashFlowResponse = await requestJson("/api/finance/cash-flow", cookie);
    assert.equal(cashFlowResponse.status, 200);
    const cashFlow = (await cashFlowResponse.json()).cashFlow;
    assert.ok(Number(cashFlow.totals.inflow) >= 100);
    assert.ok(Number(cashFlow.totals.outflow) >= 40);
    const financeReceipt = cashFlow.entries.find(
      (item: { source: string; sourceId: string }) => item.source === "SALE_PAYMENT" && item.sourceId === salePayment.id,
    );
    const financePayment = cashFlow.entries.find(
      (item: { source: string; sourceId: string }) => item.source === "ACCOUNT_PAYABLE" && item.sourceId === payableId,
    );
    assert.ok(financeReceipt && financePayment, "Fluxo de caixa deveria conter entrada e saída realizadas.");

    const creditEntryResponse = await requestJson("/api/finance/bank-entries", cookie, {
      method: "POST",
      body: {
        direction: "CREDIT",
        amount: "100.00",
        occurredAt: new Date().toISOString(),
        description: "Crédito do cliente Finance Smoke",
        reference: "FIN-SMOKE-CREDIT",
      },
    });
    assert.equal(creditEntryResponse.status, 201);
    creditBankEntryId = (await creditEntryResponse.json()).entry.id;

    const creditReconciliationResponse = await requestJson(
      `/api/finance/bank-entries/${creditBankEntryId}/reconcile`,
      cookie,
      {
        method: "POST",
        body: { salePaymentId: salePayment.id, amount: "100.00" },
      },
    );
    assert.equal(creditReconciliationResponse.status, 201);

    const debitEntryResponse = await requestJson("/api/finance/bank-entries", cookie, {
      method: "POST",
      body: {
        direction: "DEBIT",
        amount: "40.00",
        occurredAt: new Date().toISOString(),
        description: "Débito do fornecedor Finance Smoke",
        reference: "FIN-SMOKE-DEBIT",
      },
    });
    assert.equal(debitEntryResponse.status, 201);
    debitBankEntryId = (await debitEntryResponse.json()).entry.id;

    const debitReconciliationResponse = await requestJson(
      `/api/finance/bank-entries/${debitBankEntryId}/reconcile`,
      cookie,
      {
        method: "POST",
        body: { accountPayableId: payableId, amount: "40.00" },
      },
    );
    assert.equal(debitReconciliationResponse.status, 201);

    const mismatchEntryResponse = await requestJson("/api/finance/bank-entries", cookie, {
      method: "POST",
      body: {
        direction: "CREDIT",
        amount: "40.00",
        occurredAt: new Date().toISOString(),
        description: "Crédito incompatível para teste",
      },
    });
    assert.equal(mismatchEntryResponse.status, 201);
    mismatchBankEntryId = (await mismatchEntryResponse.json()).entry.id;
    const mismatchReconciliation = await requestJson(
      `/api/finance/bank-entries/${mismatchBankEntryId}/reconcile`,
      cookie,
      {
        method: "POST",
        body: { accountPayableId: payableId, amount: "40.00" },
      },
    );
    assert.equal(mismatchReconciliation.status, 422, "Crédito bancário não deve conciliar conta paga.");

    const bankEntriesResponse = await requestJson("/api/finance/bank-entries", cookie);
    assert.equal(bankEntriesResponse.status, 200);
    const bankEntries = (await bankEntriesResponse.json()).entries;
    const savedCredit = bankEntries.find((item: { id: string }) => item.id === creditBankEntryId);
    const savedDebit = bankEntries.find((item: { id: string }) => item.id === debitBankEntryId);
    assert.equal(savedCredit?.fullyReconciled, true);
    assert.equal(savedDebit?.fullyReconciled, true);

    const reportResponse = await requestJson("/api/finance/reports", cookie);
    assert.equal(reportResponse.status, 200);
    const report = (await reportResponse.json()).report;
    assert.ok(Number(report.cashFlow.inflow) >= 100);
    assert.ok(Number(report.cashFlow.outflow) >= 40);
    assert.ok(Number(report.bankReconciliation.reconciledAmount) >= 140);

    const payableAudit = await db.auditLog.count({
      where: {
        organizationId: organization.id,
        entityType: "AccountPayable",
        entityId: payableId,
        action: { in: ["ACCOUNT_PAYABLE_CREATE", "ACCOUNT_PAYABLE_SETTLE"] },
      },
    });
    assert.equal(payableAudit, 2);

    const reconciliationAudit = await db.auditLog.count({
      where: {
        organizationId: organization.id,
        action: "BANK_RECONCILE",
      },
    });
    assert.ok(reconciliationAudit >= 2);

    const secondOrganization = await db.organization.create({
      data: { name: "Finance CI Second", slug: `finance-ci-second-${Date.now()}` },
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

    const crossTenantReceivables = await requestJson("/api/finance/receivables", cookie);
    assert.equal(crossTenantReceivables.status, 200);
    assert.equal((await crossTenantReceivables.json()).receivables.length, 0);
    const crossTenantPayables = await requestJson("/api/finance/payables", cookie);
    assert.equal(crossTenantPayables.status, 200);
    assert.equal((await crossTenantPayables.json()).payables.length, 0);
    const crossTenantReconcile = await requestJson(
      `/api/finance/bank-entries/${creditBankEntryId}/reconcile`,
      cookie,
      { method: "POST", body: { salePaymentId: salePayment.id, amount: "1.00" } },
    );
    assert.equal(crossTenantReconcile.status, 404);

    console.log("✓ contas a receber derivadas dos pagamentos reais de venda");
    console.log("✓ contas a pagar e baixa de pagamento validadas");
    console.log("✓ fluxo de caixa realizado com entradas e saídas validadas");
    console.log("✓ conciliação bancária manual com crédito/débito e limites validada");
    console.log("✓ relatório financeiro consolidado validado");
    console.log("✓ financeiro isolado entre empresas");
  } finally {
    await db.session.deleteMany({ where: { userId: admin.id } });
    if (secondOrganizationId) await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    await db.bankStatementEntry.deleteMany({
      where: {
        organizationId: organization.id,
        id: { in: [creditBankEntryId, debitBankEntryId, mismatchBankEntryId].filter((id): id is string => Boolean(id)) },
      },
    });
    if (payableId) await db.accountPayable.deleteMany({ where: { id: payableId, organizationId: organization.id } });
    await db.sale.deleteMany({ where: { id: sale.id, organizationId: organization.id } });
    await db.client.deleteMany({ where: { id: client.id, organizationId: organization.id } });
    await db.membership.deleteMany({ where: { id: sellerMembership.id } });
    await db.user.deleteMany({ where: { id: seller.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
