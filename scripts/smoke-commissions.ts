import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { db } from "../lib/db";
import { getCommissionPreview, updateSellerCommission } from "../modules/commissions/service";

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

    console.log("✓ percentual de comissão configurável apenas pelo gestor");
    console.log("✓ comissões de vendedora e representante por período e parcela, sem baixa financeira automática");
  } finally {
    if (saleId) await db.sale.deleteMany({ where: { id: saleId } });
    if (clientId) await db.client.deleteMany({ where: { id: clientId } });
    if (representativeId) await db.representative.deleteMany({ where: { id: representativeId } });
    await db.membership.deleteMany({ where: { id: seller.id } });
    await db.user.deleteMany({ where: { id: user.id } });
    await db.$disconnect();
  }
}
main().catch((cause) => { console.error(cause); process.exitCode = 1; });
