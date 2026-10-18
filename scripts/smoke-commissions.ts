import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { db } from "../lib/db";
import { getCommissionPreview, updateSellerCommission } from "../modules/commissions/service";
import { closeCommission, listCommissionClosings } from "../modules/commissions/closings";
import { settleAccountPayable } from "../modules/finance/service";

async function main() {
  const organization = await db.organization.findUniqueOrThrow({
    where: { slug: process.env.SEED_ORG_SLUG ?? "pedro-ci" },
  });
  const admin = await db.user.findUniqueOrThrow({
    where: { email: (process.env.SEED_ADMIN_EMAIL ?? "").toLowerCase() },
  });
  const stamp = Date.now();
  const user = await db.user.create({
    data: { name: "Comissionista Smoke", email: `commission-seller-${stamp}@example.test` },
  });
  const seller = await db.membership.create({
    data: { organizationId: organization.id, userId: user.id, role: "SELLER" },
  });
  const context = { organizationId: organization.id, userId: admin.id, role: "OWNER" as const };
  let clientId: string | undefined;
  let representativeId: string | undefined;
  let saleId: string | undefined;
  let closedSaleId: string | undefined;
  const closingPayables: string[] = [];
  try {
    const configured = await updateSellerCommission(context, seller.id, "1.25");
    assert.equal(configured?.commissionPercent?.toFixed(2), "1.25");
    const denied = await updateSellerCommission(
      { organizationId: organization.id, userId: user.id, role: "SELLER" },
      seller.id, "99.00",
    ).then(() => false, () => true);
    assert.equal(denied, true, "Vendedora não pode ajustar percentual de comissão.");

    const representative = await db.representative.create({
      data: { organizationId: organization.id, name: "Representante Smoke", commissionPercent: "5.00" },
    });
    representativeId = representative.id;
    const client = await db.client.create({
      data: {
        organizationId: organization.id, name: "Cliente Comissão",
        documentType: "CPF", document: `commission-${stamp}`,
        email: `commission-client-${stamp}@example.test`,
        whatsapp: "5511999990000",
      },
    });
    clientId = client.id;

    // A representative's fee is due on the instalment date, regardless of
    // whether the underlying cheque has been compensated.
    const now = new Date();
    const y = now.getUTCFullYear(), monthIndex = now.getUTCMonth();
    const dateInPeriod = new Date(Date.UTC(y, monthIndex, 10, 12));
    const order = await db.sale.create({
      data: {
        organizationId: organization.id, clientId: client.id,
        sellerMembershipId: seller.id, representativeId: representative.id,
        representativeRate: "5.00", sellerCommissionRate: "1.25",
        stage: "ORDER", channel: "WHATSAPP",
        totalAmount: "1000.00", orderedAt: dateInPeriod,
        payments: {
          create: [{
            organizationId: organization.id, method: "CHEQUE",
            amount: "500.00", dueDate: dateInPeriod, status: "PENDING",
          }],
        },
      },
    });
    saleId = order.id;
    const period = `${y}-${String(monthIndex + 1).padStart(2, "0")}`;
    const preview = await getCommissionPreview(context, period);
    const saleCommission = preview.sellers.flatMap((group) => group.sales).find((row) => row.saleId === order.id);
    assert.equal(saleCommission?.commission.toFixed(2), "12.50");
    const repCommission = preview.representatives.flatMap((group) => group.payments)
      .find((row) => row.saleId === order.id);
    assert.equal(repCommission?.commission.toFixed(2), "25.00");
    assert.equal(repCommission?.status, "PENDING");
    assert.equal(preview.provisional, true);
    assert.equal(await db.accountPayable.count({
      where: { organizationId: organization.id, description: { contains: "Comissão Smoke" } },
    }), 0, "Prévia não cria contas a pagar.");

    // Closed competences: each seller has one approved monthly payable;
    // each representative installment has an independent due date.
    const previous = new Date(Date.UTC(y, monthIndex - 1, 10, 12));
    const previousMonth = `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
    const confirmed = await db.sale.create({
      data: {
        organizationId: organization.id, clientId: client.id,
        sellerMembershipId: seller.id, representativeId: representative.id,
        representativeRate: "5.00", sellerCommissionRate: "1.25",
        stage: "ORDER", channel: "WHATSAPP",
        totalAmount: "200.00", orderedAt: previous,
        payments: { create: [{
          organizationId: organization.id, method: "CHEQUE",
          amount: "200.00", dueDate: previous, status: "PENDING",
        }] },
      },
      include: { payments: true },
    });
    closedSaleId = confirmed.id;
    const oldPreview = await getCommissionPreview(context, previousMonth);
    assert.equal(oldPreview.sellers.flatMap((g) => g.sales)
      .find((line) => line.saleId === confirmed.id)?.commission.toFixed(2), "2.50");
    assert.equal(oldPreview.representatives.flatMap((g) => g.payments)
      .find((line) => line.paymentId === confirmed.payments[0].id)?.commission.toFixed(2), "10.00");

    const notManager = await closeCommission({
      organizationId: organization.id, userId: user.id, role: "SELLER",
    }, { month: previousMonth, kind: "SELLER", sourceId: seller.id })
      .then(() => false, () => true);
    assert.equal(notManager, true, "Vendedora não aprova o próprio fechamento.");

    const stillOpen = await closeCommission(context, {
      month: period, kind: "SELLER", sourceId: seller.id,
    }).then(() => false, () => true);
    assert.equal(stillOpen, true, "Competência atual não pode ser fechada antecipadamente.");

    const sellerClosing = await closeCommission(context, {
      month: previousMonth, kind: "SELLER", sourceId: seller.id,
    });
    closingPayables.push(sellerClosing.payableId);
    assert.equal(sellerClosing.amount.toFixed(2), "2.50");
    assert.equal(sellerClosing.payable.status, "PENDING");
    assert.equal(sellerClosing.dueDate.toISOString().slice(0, 10),
      new Date(Date.UTC(previous.getUTCFullYear(), previous.getUTCMonth() + 1, 15, 3))
        .toISOString().slice(0, 10));
    const secondSellerClosing = await closeCommission(context, {
      month: previousMonth, kind: "SELLER", sourceId: seller.id,
    }).then(() => false, () => true);
    assert.equal(secondSellerClosing, true, "Fechamento duplicado deve ser recusado.");

    const repClosing = await closeCommission(context, {
      month: previousMonth, kind: "REPRESENTATIVE", sourceId: confirmed.payments[0].id,
    });
    closingPayables.push(repClosing.payableId);
    assert.equal(repClosing.amount.toFixed(2), "10.00");
    assert.equal(repClosing.dueDate.toISOString(), previous.toISOString(),
      "Representante conserva a data de vencimento da parcela.");
    assert.equal((repClosing.snapshot as Record<string, string>).paymentId, confirmed.payments[0].id);
    const wrongTenant = await listCommissionClosings(
      { organizationId: "not-this-tenant", userId: admin.id, role: "OWNER" },
      previousMonth,
    );
    assert.equal(wrongTenant.length, 0, "Fechamentos são isolados por empresa.");
    const history = await listCommissionClosings(context, previousMonth);
    assert.ok(history.some((row) => row.id === sellerClosing.id));
    assert.ok(history.some((row) => row.id === repClosing.id));

    const settled = await settleAccountPayable(context, sellerClosing.payableId);
    assert.equal(settled.status, "PAID");
    assert.ok(settled.paidAt);
    const settledAgain = await settleAccountPayable(context, sellerClosing.payableId);
    assert.equal(settledAgain.id, settled.id, "Quitação repetida não gera nova movimentação.");
    const repPending = await db.accountPayable.findUniqueOrThrow({
      where: { id: repClosing.payableId },
    });
    assert.equal(repPending.status, "PENDING");
    const closingsAudited = await db.auditLog.count({
      where: { organizationId: organization.id, action: "COMMISSION_CLOSING_APPROVE",
        entityType: "CommissionClosing", entityId: sellerClosing.id },
    });
    assert.equal(closingsAudited, 1, "Fechamento deve ser auditado uma única vez.");

    console.log("✓ fechamento congelado por vendedora/mês e representante/parcela, sem duplicidade");
    console.log("✓ conta a pagar aprovada, baixa manual, histórico e isolamento");

    console.log("✓ percentual de comissão configurável apenas pelo gestor");
    console.log("✓ comissões de vendedora e representante por período e parcela, sem baixa financeira automática");
  } finally {
    await db.commissionClosing.deleteMany({
      where: { organizationId: organization.id, payableId: { in: closingPayables } },
    });
    if (closingPayables.length) {
      await db.accountPayable.deleteMany({ where: { id: { in: closingPayables } } });
    }
    if (closedSaleId) await db.sale.deleteMany({ where: { id: closedSaleId } });
    if (saleId) await db.sale.deleteMany({ where: { id: saleId } });
    if (clientId) await db.client.deleteMany({ where: { id: clientId } });
    if (representativeId) await db.representative.deleteMany({ where: { id: representativeId } });
    await db.membership.deleteMany({ where: { id: seller.id } });
    await db.user.deleteMany({ where: { id: user.id } });
    await db.$disconnect();
  }
}
main().catch((cause) => { console.error(cause); process.exitCode = 1; });
