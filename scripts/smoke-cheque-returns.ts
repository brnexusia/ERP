import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
import { recordReturnedCheque, recordChequeRecovery } from "../modules/sales/cheque-returns";

const BASE = process.env.APP_URL ?? "http://127.0.0.1:3000";
async function request(path: string, cookie?: string, method = "GET", body?: unknown) {
  return fetch(BASE + path, {
    method, redirect: "manual",
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Seed credentials missing.");
  const organization = await db.organization.findUniqueOrThrow({
    where: { slug: process.env.SEED_ORG_SLUG ?? "pedro-ci" },
  });
  const admin = await db.user.findUniqueOrThrow({ where: { email } });
  const stamp = Date.now();
  const seller = await db.user.create({
    data: { name: "Vendedora Cheques Smoke", email: `seller-cheque-${stamp}@example.test` },
  });
  const membership = await db.membership.create({
    data: { organizationId: organization.id, userId: seller.id, role: "SELLER" },
  });
  const client = await db.client.create({
    data: {
      organizationId: organization.id, name: "Cliente Cheque Smoke",
      documentType: "CPF", document: `cheque-${stamp}`,
      email: `cheque-${stamp}@example.test`,
      whatsapp: "5511999999999",
    },
  });
  const settlement = new Date(Date.now() - 10 * 60_000);
  const returnedAt = new Date(Date.now() - 5 * 60_000);
  const sale = await db.sale.create({
    data: {
      organizationId: organization.id,
      clientId: client.id, sellerMembershipId: membership.id,
      stage: "PAID", channel: "PHYSICAL_STORE", totalAmount: "100.00",
      orderedAt: settlement, paidAt: settlement,
      payments: { create: [{
        organizationId: organization.id, method: "CHEQUE",
        status: "PAID", amount: "100.00",
        chequeBank: "Banco CI", chequeNumber: "SMOKE-100",
        settledAt: settlement,
      }] },
    },
    include: { payments: true },
  });
  const cheque = sale.payments[0];
  const login = await request("/api/auth/login", undefined, "POST", { email, password });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie);
  let secondOrgId: string | null = null;
  let bankEntryId: string | null = null;
  try {
    const anonymous = await request(`/api/sales/${sale.id}/cheque-returns`);
    assert.equal(anonymous.status, 401);

    const denied = await recordReturnedCheque(
      { organizationId: organization.id, userId: seller.id, role: "SELLER" },
      sale.id, cheque.id,
      { reason: "Devolução informada pelo banco", returnedAt },
    ).then(() => false).catch(() => true);
    assert.equal(denied, true, "Only finance can report returned cheques.");

    const originalFlow = await request("/api/finance/cash-flow", cookie);
    assert.equal(originalFlow.status, 200);
    const first = (await originalFlow.json()).cashFlow;
    assert.ok(first.entries.some((row: { sourceId: string }) => row.sourceId === cheque.id));

    // A reconciled historical cheque is preserved when it is later returned.
    const bank = await request("/api/finance/bank-entries", cookie, "POST", {
      direction: "CREDIT", amount: "100.00",
      occurredAt: settlement.toISOString(), description: "Smoke original cheque settlement",
      reference: `SMOKE-CHEQUE-${stamp}`,
    });
    assert.equal(bank.status, 201);
    bankEntryId = (await bank.json()).entry.id;
    const priorReconciliation = await request(
      `/api/finance/bank-entries/${bankEntryId}/reconcile`, cookie, "POST",
      { salePaymentId: cheque.id, amount: "100.00" },
    );
    assert.equal(priorReconciliation.status, 201);

    const ret = await request(`/api/sales/${sale.id}/payments/${cheque.id}/return`, cookie, "POST", {
      returnedAt: returnedAt.toISOString(), reason: "Cheque devolvido por falta de fundos",
    });
    assert.equal(ret.status, 201, await ret.text().catch(() => "failed"));
    const incident = (await ret.clone().json()).returnedCheque; // Clone after response parse is not allowed; handled below.
    assert.equal(incident.recoveryStatus, "OPEN");
    assert.equal(Number(incident.outstandingAmount), 100);
    const duplicate = await request(`/api/sales/${sale.id}/payments/${cheque.id}/return`, cookie, "POST", {
      returnedAt: returnedAt.toISOString(), reason: "Tentativa duplicada do mesmo cheque",
    });
    assert.equal(duplicate.status, 422);

    const report = await request("/api/finance/reports", cookie);
    assert.equal(report.status, 200);
    const reportData = (await report.json()).report;
    assert.ok(Number(reportData.chequeReturns.outstandingAmount) >= 100);
    assert.ok(Number(reportData.accountsReceivable.pendingAmount) >= 100);

    const reversedFlow = await request("/api/finance/cash-flow", cookie);
    const reversedEntries = (await reversedFlow.json()).cashFlow.entries as
      Array<{ source: string; sourceId: string; amount: string }>;
    assert.ok(reversedEntries.some((row) => row.source === "CHEQUE_RETURN" && row.sourceId === incident.id));
    assert.ok(reversedEntries.some((row) => row.source === "SALE_PAYMENT" && row.sourceId === cheque.id));
    const receiptsForCheque = reversedEntries.filter((row) =>
      (row.source === "CHEQUE_RETURN" && row.sourceId === incident.id) ||
      (row.source === "SALE_PAYMENT" && row.sourceId === cheque.id));
    assert.equal(receiptsForCheque.reduce((sum, row) =>
      sum + (row.source === "CHEQUE_RETURN" ? -Number(row.amount) : Number(row.amount)), 0), 0);

    const reconAfterReturn = await request(
      `/api/finance/bank-entries/${bankEntryId}/reconcile`, cookie, "POST",
      { salePaymentId: cheque.id, amount: "0.01" },
    );
    assert.ok([404, 422].includes(reconAfterReturn.status));

    const token = randomUUID();
    const recoverPath = `/api/sales/${sale.id}/payments/${cheque.id}/recoveries`;
    const partial = {
      method: "PIX", amount: "40.00",
      receivedAt: new Date().toISOString(),
      idempotencyKey: token,
    };
    const partialResponse = await request(recoverPath, cookie, "POST", partial);
    assert.equal(partialResponse.status, 201);
    const partialId = (await partialResponse.json()).recovery.id;
    const repeated = await request(recoverPath, cookie, "POST", partial);
    assert.equal(repeated.status, 201);
    assert.equal((await repeated.json()).recovery.id, partialId);
    const altered = await request(recoverPath, cookie, "POST", { ...partial, amount: "41.00" });
    assert.equal(altered.status, 422, "Token cannot change the recovered amount.");
    const exceeded = await request(recoverPath, cookie, "POST", {
      ...partial, idempotencyKey: randomUUID(), amount: "61.00",
    });
    assert.equal(exceeded.status, 422);

    const getAfterPartial = await request(`/api/sales/${sale.id}/cheque-returns`, cookie);
    const afterPartial = (await getAfterPartial.json()).returnedCheques[0];
    assert.equal(Number(afterPartial.recoveredAmount), 40);
    assert.equal(Number(afterPartial.outstandingAmount), 60);
    assert.equal(afterPartial.recoveries.length, 1);

    const settle = await request(recoverPath, cookie, "POST", {
      method: "TRANSFER", amount: "60.00",
      receivedAt: new Date().toISOString(), idempotencyKey: randomUUID(),
    });
    assert.equal(settle.status, 201);
    const after = await request(`/api/sales/${sale.id}/cheque-returns`, cookie);
    const recovered = (await after.json()).returnedCheques[0];
    assert.equal(recovered.recoveryStatus, "RECOVERED");
    assert.equal(Number(recovered.outstandingAmount), 0);
    const ledgerCount = await db.saleChequeRecovery.count({ where: { returnId: incident.id } });
    assert.equal(ledgerCount, 2);
    const originalPayment = await db.salePayment.findUniqueOrThrow({ where: { id: cheque.id } });
    assert.equal(originalPayment.status, "PAID", "Original cheque payment stays immutable.");
    assert.equal(await db.bankReconciliation.count({
      where: { organizationId: organization.id, salePaymentId: cheque.id },
    }), 1, "Original reconciliation must be preserved.");

    const allFinance = await request("/api/finance/cheque-returns", cookie);
    assert.equal(allFinance.status, 200);
    assert.ok((await allFinance.json()).returnedCheques.some((row: { id: string }) => row.id === incident.id));
    const tenant = await db.organization.create({
      data: { name: "Cheque Smoke Second", slug: `cheque-smoke-${stamp}` },
    });
    secondOrgId = tenant.id;
    await db.membership.create({ data: { organizationId: tenant.id, userId: admin.id, role: "ADMIN" } });
    const switchResponse = await request("/api/auth/organization", cookie, "POST", {
      organizationId: tenant.id,
    });
    assert.equal(switchResponse.status, 200);
    const otherTenant = await request(`/api/sales/${sale.id}/cheque-returns`, cookie);
    assert.equal(otherTenant.status, 404);
    const otherTenantReturn = await request(`/api/sales/${sale.id}/payments/${cheque.id}/return`,
      cookie, "POST", { returnedAt: returnedAt.toISOString(), reason: "Fraudulent other tenant" });
    assert.equal(otherTenantReturn.status, 404);
    console.log("✓ cheque devolvido: histórico intacto, cobrança, estorno e recuperação parcial");
    console.log("✓ limites, chave idempotente, conciliação histórica, permissões e isolamento entre empresas");
  } finally {
    await db.session.deleteMany({ where: { userId: admin.id } });
    if (secondOrgId) await db.organization.deleteMany({ where: { id: secondOrgId } });
    if (bankEntryId) await db.bankStatementEntry.deleteMany({ where: { id: bankEntryId } });
    await db.saleChequeReturn.deleteMany({ where: { salePaymentId: cheque.id } });
    await db.sale.deleteMany({ where: { id: sale.id } });
    await db.client.deleteMany({ where: { id: client.id } });
    await db.membership.deleteMany({ where: { id: membership.id } });
    await db.user.deleteMany({ where: { id: seller.id } });
    await db.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
