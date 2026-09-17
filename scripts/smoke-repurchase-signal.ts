import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { db } from "../lib/db";
import { getClientCommercialProfile } from "../modules/reports/service";

async function main() {
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  const organization = await db.organization.findUnique({ where: { slug } });
  const owner = await db.membership.findFirst({
    where: { organizationId: organization?.id, role: "OWNER" },
  });
  assert.ok(organization && owner, "Seed base não encontrado.");

  const suffix = Date.now();
  const sellerUser = await db.user.create({
    data: { name: "Vendedora Recompra Smoke", email: `repurchase-seller-${suffix}@example.test` },
  });
  const seller = await db.membership.create({
    data: { organizationId: organization.id, userId: sellerUser.id, role: "SELLER" },
  });

  const qualifyingClient = await db.client.create({
    data: {
      organizationId: organization.id,
      responsibleSellerMembershipId: seller.id,
      name: "Cliente Recompra Qualifica",
      documentType: "CPF",
      document: `repurchase-qualify-${suffix}`,
      whatsapp: `55711${String(suffix).slice(-8)}`,
      email: `repurchase-qualify-${suffix}@example.test`,
    },
  });
  const nonQualifyingClient = await db.client.create({
    data: {
      organizationId: organization.id,
      responsibleSellerMembershipId: seller.id,
      name: "Cliente Recompra Fora Janela",
      documentType: "CPF",
      document: `repurchase-outside-${suffix}`,
      whatsapp: `55712${String(suffix).slice(-8)}`,
      email: `repurchase-outside-${suffix}@example.test`,
    },
  });

  const saleData = [
    [qualifyingClient.id, "2026-01-15T12:00:00.000Z", "100.00"],
    [qualifyingClient.id, "2026-03-15T12:00:00.000Z", "120.00"],
    [qualifyingClient.id, "2026-07-20T12:00:00.000Z", "90.00"],
    [nonQualifyingClient.id, "2026-01-01T12:00:00.000Z", "50.00"],
    [nonQualifyingClient.id, "2026-05-02T12:00:00.000Z", "60.00"],
  ] as const;

  const sales = [];
  for (const [clientId, paidAtIso, totalAmount] of saleData) {
    const paidAt = new Date(paidAtIso);
    sales.push(
      await db.sale.create({
        data: {
          organizationId: organization.id,
          clientId,
          sellerMembershipId: seller.id,
          stage: "PAID",
          channel: "WHATSAPP",
          totalAmount: new Prisma.Decimal(totalAmount),
          orderedAt: paidAt,
          paidAt,
        },
      }),
    );
  }

  try {
    const context = {
      organizationId: organization.id,
      userId: owner.userId,
      role: owner.role,
    };

    const qualifyingProfile = await getClientCommercialProfile(context, qualifyingClient.id);
    const qualifying = qualifyingProfile.commercial.repurchaseWithinThreeMonths;
    assert.equal(qualifying.detected, true);
    assert.equal(qualifying.qualifyingRepurchases, 1);
    assert.equal(qualifying.intervals.length, 2);
    assert.equal(qualifying.intervals[0].withinThreeMonths, true);
    assert.equal(qualifying.intervals[0].daysBetween, 59);
    assert.equal(qualifying.intervals[1].withinThreeMonths, false);
    assert.equal(qualifying.firstQualifyingRepurchaseAt?.toISOString(), "2026-03-15T12:00:00.000Z");
    assert.equal(qualifying.latestQualifyingRepurchaseAt?.toISOString(), "2026-03-15T12:00:00.000Z");
    assert.equal(qualifying.basis, "PAID_PURCHASES");
    assert.equal(qualifying.window, "UP_TO_3_CALENDAR_MONTHS");
    assert.equal(qualifying.commercialEffect, "PENDING_RULE_DEFINITION");

    const outsideProfile = await getClientCommercialProfile(context, nonQualifyingClient.id);
    const outside = outsideProfile.commercial.repurchaseWithinThreeMonths;
    assert.equal(outside.detected, false);
    assert.equal(outside.qualifyingRepurchases, 0);
    assert.equal(outside.intervals.length, 1);
    assert.equal(outside.intervals[0].withinThreeMonths, false);

    console.log("✓ recompra em até 3 meses é detectada somente a partir de compras pagas");
    console.log("✓ intervalos fora da janela não são classificados como recompra em até 3 meses");
    console.log("✓ sinal factual não inventa efeito comercial de atacado");
  } finally {
    await db.sale.deleteMany({ where: { id: { in: sales.map((sale) => sale.id) } } });
    await db.client.deleteMany({ where: { id: { in: [qualifyingClient.id, nonQualifyingClient.id] } } });
    await db.membership.deleteMany({ where: { id: seller.id } });
    await db.user.deleteMany({ where: { id: sellerUser.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
