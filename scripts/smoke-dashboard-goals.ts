import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { db } from "../lib/db";
import { getGeneralDashboard } from "../modules/dashboard/service";

async function main() {
  const slug = process.env.SEED_ORG_SLUG ?? "pedro-ci";
  const organization = await db.organization.findUnique({ where: { slug } });
  const adminMembership = await db.membership.findFirst({
    where: { organizationId: organization?.id, role: "OWNER" },
  });
  assert.ok(organization && adminMembership, "Seed base não encontrado.");

  const suffix = Date.now().toString();
  const sellerUser = await db.user.create({
    data: { name: "Vendedora Dashboard Metas", email: `dashboard-goals-${suffix}@example.test` },
  });
  const seller = await db.membership.create({
    data: { organizationId: organization.id, userId: sellerUser.id, role: "SELLER" },
  });
  const client = await db.client.create({
    data: {
      organizationId: organization.id,
      responsibleSellerMembershipId: seller.id,
      name: "Cliente Dashboard Meta",
      documentType: "CPF",
      document: `dashboard-goal-${suffix}`,
      whatsapp: `55719${suffix.slice(-8)}`,
      email: `dashboard-goal-client-${suffix}@example.test`,
    },
  });
  const paidAt = new Date();
  const sale = await db.sale.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      sellerMembershipId: seller.id,
      stage: "PAID",
      channel: "WHATSAPP",
      totalAmount: new Prisma.Decimal("250.00"),
      orderedAt: paidAt,
      paidAt,
    },
  });
  const goal = await db.sellerGoal.create({
    data: {
      organizationId: organization.id,
      sellerMembershipId: seller.id,
      metric: "REVENUE",
      targetValue: new Prisma.Decimal("200.00"),
      startAt: new Date(Date.now() - 86_400_000),
      endAt: new Date(Date.now() + 86_400_000),
      createdByUserId: adminMembership.userId,
    },
  });

  let secondOrganizationId: string | null = null;
  let secondMembershipId: string | null = null;

  try {
    const context = {
      organizationId: organization.id,
      userId: adminMembership.userId,
      role: adminMembership.role,
    };
    const dashboard = await getGeneralDashboard(context, {});
    assert.equal(dashboard.permissions.sellerGoals, true);
    assert.ok(dashboard.sellerGoals);
    assert.equal(dashboard.sellerGoals.summary.total, 1);
    assert.equal(dashboard.sellerGoals.summary.active, 1);
    assert.equal(dashboard.sellerGoals.summary.achieved, 1);
    assert.equal(dashboard.sellerGoals.goals[0].id, goal.id);
    assert.equal(dashboard.sellerGoals.goals[0].seller.membershipId, seller.id);
    assert.equal(dashboard.sellerGoals.goals[0].seller.user.name, "Vendedora Dashboard Metas");
    assert.equal(dashboard.sellerGoals.goals[0].actualValue.toFixed(2), "250.00");
    assert.equal(dashboard.sellerGoals.goals[0].progressPercent.toFixed(2), "125.00");

    const filteredOut = await getGeneralDashboard(context, {
      start: new Date(Date.now() + 5 * 86_400_000),
      end: new Date(Date.now() + 6 * 86_400_000),
    });
    assert.equal(filteredOut.sellerGoals?.summary.total, 0, "Meta fora do período do dashboard não deve ser incluída.");

    const secondOrganization = await db.organization.create({
      data: { name: "Dashboard Goals Second", slug: `dashboard-goals-second-${suffix}` },
    });
    secondOrganizationId = secondOrganization.id;
    const secondMembership = await db.membership.create({
      data: {
        organizationId: secondOrganization.id,
        userId: adminMembership.userId,
        role: "ADMIN",
      },
    });
    secondMembershipId = secondMembership.id;

    const isolated = await getGeneralDashboard({
      organizationId: secondOrganization.id,
      userId: adminMembership.userId,
      role: "ADMIN",
    }, {});
    assert.equal(isolated.sellerGoals?.summary.total, 0);

    console.log("✓ dashboard comercial agrega metas reais por vendedora");
    console.log("✓ realizado e percentual usam o período próprio da meta");
    console.log("✓ filtro do dashboard seleciona metas por sobreposição de período");
    console.log("✓ metas do dashboard permanecem isoladas entre empresas");
  } finally {
    if (secondMembershipId) await db.membership.deleteMany({ where: { id: secondMembershipId } });
    if (secondOrganizationId) await db.organization.deleteMany({ where: { id: secondOrganizationId } });
    await db.sellerGoal.deleteMany({ where: { id: goal.id } });
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
