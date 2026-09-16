import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { db } from "../lib/db";
import { getSaleTimeline } from "../modules/sales/timeline";
import { SaleNotFoundError } from "../modules/sales/service";

async function main() {
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  const organization = await db.organization.findUnique({ where: { slug } });
  const owner = await db.membership.findFirst({
    where: { organizationId: organization?.id, role: "OWNER" },
  });
  assert.ok(organization && owner, "Seed base não encontrado.");

  const suffix = Date.now();
  const sellerUser = await db.user.create({
    data: { name: "Vendedora Timeline Smoke", email: `timeline-seller-${suffix}@example.test` },
  });
  const seller = await db.membership.create({
    data: { organizationId: organization.id, userId: sellerUser.id, role: "SELLER" },
  });
  const client = await db.client.create({
    data: {
      organizationId: organization.id,
      responsibleSellerMembershipId: seller.id,
      name: "Cliente Timeline Smoke",
      documentType: "CPF",
      document: `timeline-${suffix}`,
      whatsapp: `55${suffix}`,
      email: `timeline-client-${suffix}@example.test`,
    },
  });

  const quotedAt = new Date(Date.now() - 5 * 60_000);
  const orderedAt = new Date(Date.now() - 4 * 60_000);
  const paymentCreatedAt = new Date(Date.now() - 3 * 60_000);
  const settledAt = new Date(Date.now() - 2 * 60_000);
  const paidAt = new Date(Date.now() - 2 * 60_000 + 1000);
  const supportAt = new Date(Date.now() - 60_000);
  const deliveryAt = new Date(Date.now() - 30_000);

  const sale = await db.sale.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      sellerMembershipId: seller.id,
      stage: "PAID",
      channel: "SITE",
      totalAmount: new Prisma.Decimal("120.00"),
      quotedAt,
      orderedAt,
      paidAt,
    },
  });
  const payment = await db.salePayment.create({
    data: {
      organizationId: organization.id,
      saleId: sale.id,
      method: "PIX",
      status: "PAID",
      amount: new Prisma.Decimal("120.00"),
      settledAt,
      createdAt: paymentCreatedAt,
    },
  });
  const support = await db.supportRecord.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      saleId: sale.id,
      kind: "AFTER_SALES",
      content: "Pós-venda vinculado à mesma venda.",
      createdByUserId: owner.userId,
      createdAt: supportAt,
    },
  });
  const delivery = await db.saleDelivery.create({
    data: {
      organizationId: organization.id,
      saleId: sale.id,
      method: "CORREIOS",
      trackingCode: `BR${suffix}`,
      createdAt: deliveryAt,
    },
  });

  let secondOrganizationId: string | null = null;

  try {
    const context = {
      organizationId: organization.id,
      userId: owner.userId,
      role: owner.role,
    };
    const result = await getSaleTimeline(context, sale.id);

    assert.equal(result.sale.id, sale.id);
    assert.equal(result.sale.client.id, client.id);
    assert.equal(result.sale.seller.membershipId, seller.id);
    assert.equal(result.sale.payments.length, 1);
    assert.equal(result.sale.payments[0].id, payment.id);
    assert.equal(result.supportRecords.length, 1);
    assert.equal(result.supportRecords[0].id, support.id);
    assert.equal(result.sale.delivery?.id, delivery.id);

    const types = result.timeline.map((event) => event.type);
    assert.deepEqual(types, [
      "QUOTE_CREATED",
      "ORDER_CONFIRMED",
      "PAYMENT_REGISTERED",
      "PAYMENT_SETTLED",
      "SALE_PAID",
      "SUPPORT_RECORDED",
      "DELIVERY_REGISTERED",
    ]);

    for (let index = 1; index < result.timeline.length; index += 1) {
      assert.ok(
        result.timeline[index - 1].occurredAt <= result.timeline[index].occurredAt,
        "Timeline precisa permanecer cronológica.",
      );
    }

    const secondOrganization = await db.organization.create({
      data: { name: "Timeline CI Second", slug: `timeline-ci-second-${suffix}` },
    });
    secondOrganizationId = secondOrganization.id;

    await assert.rejects(
      () => getSaleTimeline({ ...context, organizationId: secondOrganization.id }, sale.id),
      SaleNotFoundError,
    );

    console.log("✓ orçamento, pedido e pagamento permanecem ligados à mesma venda");
    console.log("✓ pagamento, pós-venda e entrega aparecem em uma única timeline cronológica");
    console.log("✓ cliente e vendedora permanecem vinculados ao histórico comercial");
    console.log("✓ timeline permanece isolada entre empresas");
  } finally {
    if (secondOrganizationId) await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    await db.sale.deleteMany({ where: { id: sale.id } });
    await db.client.deleteMany({ where: { id: client.id } });
    await db.membership.deleteMany({ where: { id: seller.id } });
    await db.user.deleteMany({ where: { id: sellerUser.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
