import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
import { createManualReceivable, receiveManualReceivable } from "../modules/finance/manual-receivables";

const BASE_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";
async function request(path: string, cookie?: string, method = "GET", body?: unknown) {
  return fetch(BASE_URL + path, {
    method, redirect: "manual",
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw Error("CI seed credentials are required.");
  const org = await db.organization.findUniqueOrThrow({
    where: { slug: process.env.SEED_ORG_SLUG ?? "pedro-ci" },
  });
  const admin = await db.user.findUniqueOrThrow({ where: { email } });
  const stamp = Date.now();
  const seller = await db.user.create({
    data: { name: "Cobrança Seller Smoke", email: `manual-seller-${stamp}@example.test` },
  });
  const membership = await db.membership.create({
    data: { organizationId: org.id, userId: seller.id, role: "SELLER" },
  });
  const client = await db.client.create({
    data: {
      organizationId: org.id, name: "Cliente Débito Smoke",
      documentType: "CPF", document: `manual-${stamp}`,
      email: `manual-client-${stamp}@example.test`,
      whatsapp: "5511999999000",
    },
  });
  const login = await request("/api/auth/login", undefined, "POST", { email, password });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie);

  let debtId: string | null = null;
  let secondOrg: string | null = null;
  const dueDate = new Date(Date.now() - 86400_000);
  const receivedAt = new Date(Date.now() - 1000);
  const context = { organizationId: org.id, userId: admin.id, role: "OWNER" as const };
  try {
    const anonymous = await request("/api/finance/manual-receivables");
    assert.equal(anonymous.status, 401);
    const sellerDenied = await createManualReceivable(
      { organizationId: org.id, userId: seller.id, role: "SELLER" }, {
        clientId: client.id, sourceReference: `NEG-${stamp}`,
        description: "Ajuste teste", amount: "150.00", dueDate,
      },
    ).then(() => false, () => true);
    assert.equal(sellerDenied, true);

    const originalSales = await db.sale.count({ where: { organizationId: org.id, clientId: client.id } });
    const before = await request("/api/finance/cash-flow", cookie);
    const beforeSources = (await before.json()).cashFlow.entries as Array<{ source: string }>;
    const create = await request("/api/finance/manual-receivables", cookie, "POST", {
      clientId: client.id, sourceReference: `AVULSO-${stamp}`,
      description: "Ajuste de saldo comercial", amount: "150.00",
      dueDate: dueDate.toISOString(),
    });
    assert.equal(create.status, 201);
    const debt = (await create.json()).receivable;
    debtId = debt.id;
    assert.equal(debt.status, "OPEN");
    assert.equal(Number(debt.outstandingAmount), 150);
    const sameRef = await request("/api/finance/manual-receivables", cookie, "POST", {
      clientId: client.id, sourceReference: `AVULSO-${stamp}`,
      description: "Tentativa de cobrança duplicada", amount: "150.00", dueDate: dueDate.toISOString(),
    });
    assert.equal(sameRef.status, 422);
    const invalid = await request("/api/finance/manual-receivables", cookie, "POST", {
      clientId: client.id, sourceReference: "ABCD", description: "Valor zerado", amount: "0",
      dueDate: dueDate.toISOString(),
    });
    assert.equal(invalid.status, 400);
    const afterCreate = await request("/api/finance/cash-flow", cookie);
    assert.equal((await afterCreate.json()).cashFlow.entries.length, beforeSources.length,
      "Creating debt must not book cash before actual payment.");
    const countSales = await db.sale.count({ where: { organizationId: org.id, clientId: client.id } });
    assert.equal(countSales, originalSales, "Manual receivables do not create duplicate sales.");

    const token = randomUUID();
    const payPath = `/api/finance/manual-receivables/${debtId}/receipts`;
    const partial = { amount: "60.00", method: "PIX",
      receivedAt: receivedAt.toISOString(), idempotencyKey: token,
      note: "Primeira parcela recebida" };
    const firstReceipt = await request(payPath, cookie, "POST", partial);
    assert.equal(firstReceipt.status, 201);
    const firstId = (await firstReceipt.json()).receipt.id;
    const duplicate = await request(payPath, cookie, "POST", partial);
    assert.equal(duplicate.status, 201);
    assert.equal((await duplicate.json()).receipt.id, firstId);
    const changedPayload = await request(payPath, cookie, "POST", { ...partial, amount: "61.00" });
    assert.equal(changedPayload.status, 422);
    const overpay = await request(payPath, cookie, "POST", {
      ...partial, amount: "91.00", idempotencyKey: randomUUID(),
    });
    assert.equal(overpay.status, 422);
    const listing = await request(`/api/finance/manual-receivables?clientId=${client.id}`, cookie);
    assert.equal(listing.status, 200);
    const partialState = (await listing.json()).receivables.find((item: { id: string }) => item.id === debtId);
    assert.equal(partialState.status, "PARTIAL");
    assert.equal(Number(partialState.receivedAmount), 60);
    assert.equal(Number(partialState.outstandingAmount), 90);
    assert.equal(partialState.overdue, true);
    const report = await request("/api/finance/reports", cookie);
    assert.equal(report.status, 200);
    const reportData = (await report.json()).report;
    assert.ok(Number(reportData.manualReceivables.outstandingAmount) >= 90);
    assert.ok(Number(reportData.accountsReceivable.pendingAmount) >= 90);

    const finalReceipt = await request(payPath, cookie, "POST", {
      ...partial, method: "TRANSFER", amount: "90.00",
      idempotencyKey: randomUUID(),
    });
    assert.equal(finalReceipt.status, 201);
    const after = await request(`/api/finance/manual-receivables?clientId=${client.id}`, cookie);
    const settled = (await after.json()).receivables[0];
    assert.equal(settled.status, "PAID");
    assert.equal(Number(settled.outstandingAmount), 0);
    assert.equal(settled.receipts.length, 2);
    const tooLate = await request(payPath, cookie, "POST", {
      ...partial, amount: "0.01", idempotencyKey: randomUUID(),
    });
    assert.equal(tooLate.status, 422);
    const cash = await request("/api/finance/cash-flow", cookie);
    const newEntries = (await cash.json()).cashFlow.entries
      .filter((item: { source: string }) => item.source === "MANUAL_RECEIPT");
    assert.ok(newEntries.some((row: { sourceId: string }) => row.sourceId === firstId));
    const receiptAudit = await db.auditLog.count({
      where: { organizationId: org.id,
        action: "MANUAL_RECEIPT_CREATE",
        entityType: "ClientManualReceipt",
        entityId: firstId },
    });
    assert.equal(receiptAudit, 1, "Replay cannot duplicate audit events.");

    const other = await db.organization.create({
      data: { name: "Avulso Smoke Second", slug: `avulso-ci-${stamp}` },
    });
    secondOrg = other.id;
    await db.membership.create({
      data: { organizationId: other.id, userId: admin.id, role: "ADMIN" },
    });
    const changed = await request("/api/auth/organization", cookie, "POST", { organizationId: other.id });
    assert.equal(changed.status, 200);
    const hidden = await request("/api/finance/manual-receivables", cookie);
    assert.equal(hidden.status, 200);
    assert.equal((await hidden.json()).receivables.length, 0);
    const blocked = await request(payPath, cookie, "POST", {
      ...partial, amount: "1.00", idempotencyKey: randomUUID(),
    });
    assert.equal(blocked.status, 404);
    const filtered = await request(`/api/finance/manual-receivables?clientId=${client.id}`, cookie);
    assert.equal(filtered.status, 404);
    const serverRejected = await receiveManualReceivable(
      { organizationId: org.id, userId: seller.id, role: "SELLER" },
      debtId!, { ...partial, amount: "1.00", method: "PIX" },
    ).then(() => false, () => true);
    assert.equal(serverRejected, true);

    console.log("✓ cobranças avulsas por cliente com referência única e recebimentos parciais");
    console.log("✓ proteção de caixa, saldos, chave idempotente, permissões e multiempresa");
  } finally {
    await db.session.deleteMany({ where: { userId: admin.id } });
    if (secondOrg) await db.organization.deleteMany({ where: { id: secondOrg } });
    if (debtId) {
      await db.clientManualReceipt.deleteMany({ where: { receivableId: debtId } });
      await db.clientManualReceivable.deleteMany({ where: { id: debtId } });
    }
    await db.client.deleteMany({ where: { id: client.id } });
    await db.membership.deleteMany({ where: { id: membership.id } });
    await db.user.deleteMany({ where: { id: seller.id } });
    await db.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
