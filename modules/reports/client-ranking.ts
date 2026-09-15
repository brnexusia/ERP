import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";
import type { ReportPeriod } from "@/modules/reports/schema";

function paidAtFilter(period: ReportPeriod): Prisma.DateTimeNullableFilter | undefined {
  if (!period.start && !period.end) return undefined;
  return {
    not: null,
    ...(period.start ? { gte: period.start } : {}),
    ...(period.end ? { lte: period.end } : {}),
  };
}

export async function getClientPurchaseRanking(context: ClientAccessContext, period: ReportPeriod) {
  assertPermission(context.role, "clients:read");
  assertPermission(context.role, "sales:read");

  const paidAt = paidAtFilter(period);
  const grouped = await db.sale.groupBy({
    by: ["clientId"],
    where: {
      organizationId: context.organizationId,
      stage: "PAID",
      ...(paidAt ? { paidAt } : {}),
    },
    _count: { _all: true },
    _sum: { totalAmount: true },
    _min: { paidAt: true },
    _max: { paidAt: true },
  });

  const clients = await db.client.findMany({
    where: {
      organizationId: context.organizationId,
      id: { in: grouped.map((entry) => entry.clientId) },
    },
    include: {
      segment: true,
      responsibleSeller: { include: { user: true } },
    },
  });
  const clientById = new Map(clients.map((client) => [client.id, client]));

  const ranking = grouped
    .map((entry) => ({
      client: clientById.get(entry.clientId),
      purchases: entry._count._all,
      totalPurchased: entry._sum.totalAmount ?? new Prisma.Decimal(0),
      firstPurchaseAt: entry._min.paidAt,
      lastPurchaseAt: entry._max.paidAt,
    }))
    .filter((entry): entry is typeof entry & { client: NonNullable<typeof entry.client> } => Boolean(entry.client))
    .sort((a, b) => {
      const byRevenue = b.totalPurchased.comparedTo(a.totalPurchased);
      return byRevenue !== 0 ? byRevenue : b.purchases - a.purchases;
    })
    .map((entry, index) => ({ rank: index + 1, ...entry }));

  return { period, ranking };
}
