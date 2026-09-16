import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";
import type { ReportPeriod } from "@/modules/reports/schema";

export class SellerNotFoundError extends Error {
  constructor(message = "Vendedora não encontrada.") {
    super(message);
    this.name = "SellerNotFoundError";
  }
}

function paidAtFilter(period: ReportPeriod): Prisma.DateTimeNullableFilter | undefined {
  if (!period.start && !period.end) return undefined;
  return {
    not: null,
    ...(period.start ? { gte: period.start } : {}),
    ...(period.end ? { lte: period.end } : {}),
  };
}

function average(total: Prisma.Decimal, count: number): Prisma.Decimal {
  return count === 0
    ? new Prisma.Decimal(0)
    : total.div(count).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export async function getSellerProfile(
  context: ClientAccessContext,
  membershipId: string,
  period: ReportPeriod,
) {
  assertPermission(context.role, "sales:read");
  assertPermission(context.role, "clients:read");

  const seller = await db.membership.findFirst({
    where: {
      id: membershipId,
      organizationId: context.organizationId,
      role: "SELLER",
      user: { status: "ACTIVE" },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
        },
      },
      responsibleClients: {
        include: {
          segment: true,
        },
        orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!seller) throw new SellerNotFoundError();

  const paidAt = paidAtFilter(period);
  const sales = await db.sale.findMany({
    where: {
      organizationId: context.organizationId,
      sellerMembershipId: seller.id,
      stage: "PAID",
      ...(paidAt ? { paidAt } : {}),
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
  });

  const revenue = sales.reduce(
    (total, sale) => total.add(sale.totalAmount),
    new Prisma.Decimal(0),
  );
  const uniqueClientIds = new Set(sales.map((sale) => sale.clientId));
  const channelMap = {
    WHATSAPP: { sales: 0, revenue: new Prisma.Decimal(0) },
    SITE: { sales: 0, revenue: new Prisma.Decimal(0) },
    PHYSICAL_STORE: { sales: 0, revenue: new Prisma.Decimal(0) },
  };

  for (const sale of sales) {
    channelMap[sale.channel].sales += 1;
    channelMap[sale.channel].revenue = channelMap[sale.channel].revenue.add(sale.totalAmount);
  }

  return {
    period,
    seller: {
      membershipId: seller.id,
      role: seller.role,
      createdAt: seller.createdAt,
      user: seller.user,
    },
    assignedClients: seller.responsibleClients,
    performance: {
      sales: sales.length,
      revenue,
      uniqueClients: uniqueClientIds.size,
      averageTicket: average(revenue, sales.length),
      channels: channelMap,
      paidSales: sales,
    },
    goals: {
      status: "PENDING_RULE_DEFINITION" as const,
      reason: "O escopo exige metas, mas não define métrica, periodicidade ou regra de atingimento.",
    },
    commissions: {
      status: "PENDING_RULE_DEFINITION" as const,
      reason: "O escopo exige comissões, mas não define fórmula, percentual, base ou momento de reconhecimento.",
    },
  };
}
