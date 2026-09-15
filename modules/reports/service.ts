import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";
import type { ReportPeriod } from "@/modules/reports/schema";

export class ReportNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportNotFoundError";
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

function decimalAverage(total: Prisma.Decimal, count: number) {
  return count === 0 ? new Prisma.Decimal(0) : total.div(count).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export async function getCommercialDashboard(context: ClientAccessContext, period: ReportPeriod) {
  assertPermission(context.role, "sales:read");

  const paidAt = paidAtFilter(period);
  const sales = await db.sale.findMany({
    where: {
      organizationId: context.organizationId,
      stage: "PAID",
      ...(paidAt ? { paidAt } : {}),
    },
    include: {
      client: { select: { id: true, name: true } },
      seller: { include: { user: true } },
    },
    orderBy: { paidAt: "asc" },
  });

  const revenue = sales.reduce((sum, sale) => sum.add(sale.totalAmount), new Prisma.Decimal(0));
  const uniqueClients = new Set(sales.map((sale) => sale.clientId));
  const channels = {
    WHATSAPP: { sales: 0, revenue: new Prisma.Decimal(0) },
    SITE: { sales: 0, revenue: new Prisma.Decimal(0) },
    PHYSICAL_STORE: { sales: 0, revenue: new Prisma.Decimal(0) },
  };

  const sellerMap = new Map<
    string,
    {
      membershipId: string;
      userId: string;
      sellerName: string;
      sales: number;
      revenue: Prisma.Decimal;
      clientIds: Set<string>;
    }
  >();

  for (const sale of sales) {
    channels[sale.channel].sales += 1;
    channels[sale.channel].revenue = channels[sale.channel].revenue.add(sale.totalAmount);

    const current = sellerMap.get(sale.sellerMembershipId) ?? {
      membershipId: sale.sellerMembershipId,
      userId: sale.seller.userId,
      sellerName: sale.seller.user.name,
      sales: 0,
      revenue: new Prisma.Decimal(0),
      clientIds: new Set<string>(),
    };
    current.sales += 1;
    current.revenue = current.revenue.add(sale.totalAmount);
    current.clientIds.add(sale.clientId);
    sellerMap.set(sale.sellerMembershipId, current);
  }

  let ticketByClientAge: {
    newClients: { sales: number; averageTicket: Prisma.Decimal };
    existingClients: { sales: number; averageTicket: Prisma.Decimal };
  } | null = null;

  if (period.start && uniqueClients.size > 0) {
    const firstPurchases = await db.sale.groupBy({
      by: ["clientId"],
      where: {
        organizationId: context.organizationId,
        stage: "PAID",
        clientId: { in: [...uniqueClients] },
        paidAt: { not: null, ...(period.end ? { lte: period.end } : {}) },
      },
      _min: { paidAt: true },
    });
    const firstByClient = new Map(firstPurchases.map((entry) => [entry.clientId, entry._min.paidAt]));

    let newCount = 0;
    let newRevenue = new Prisma.Decimal(0);
    let existingCount = 0;
    let existingRevenue = new Prisma.Decimal(0);
    for (const sale of sales) {
      const firstPurchase = firstByClient.get(sale.clientId);
      if (firstPurchase && firstPurchase >= period.start) {
        newCount += 1;
        newRevenue = newRevenue.add(sale.totalAmount);
      } else {
        existingCount += 1;
        existingRevenue = existingRevenue.add(sale.totalAmount);
      }
    }

    ticketByClientAge = {
      newClients: { sales: newCount, averageTicket: decimalAverage(newRevenue, newCount) },
      existingClients: { sales: existingCount, averageTicket: decimalAverage(existingRevenue, existingCount) },
    };
  }

  return {
    period,
    sales: sales.length,
    revenue,
    clients: uniqueClients.size,
    averageTicket: decimalAverage(revenue, sales.length),
    channels,
    ticketByClientAge,
    sellers: [...sellerMap.values()]
      .map((seller) => ({
        membershipId: seller.membershipId,
        userId: seller.userId,
        sellerName: seller.sellerName,
        sales: seller.sales,
        revenue: seller.revenue,
        clients: seller.clientIds.size,
        averageTicket: decimalAverage(seller.revenue, seller.sales),
      }))
      .sort((a, b) => b.revenue.comparedTo(a.revenue)),
  };
}

export async function getClientCommercialProfile(context: ClientAccessContext, clientId: string) {
  assertPermission(context.role, "clients:read");
  assertPermission(context.role, "sales:read");

  const client = await db.client.findFirst({
    where: { id: clientId, organizationId: context.organizationId },
    include: {
      address: true,
      segment: true,
      responsibleSeller: { include: { user: true } },
      crmEntries: {
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      },
    },
  });
  if (!client) throw new ReportNotFoundError("Cliente não encontrado.");

  const purchases = await db.sale.findMany({
    where: {
      organizationId: context.organizationId,
      clientId,
      stage: "PAID",
    },
    include: {
      seller: { include: { user: true } },
      items: {
        include: { product: { include: { category: true, subcategory: true } } },
        orderBy: { createdAt: "asc" },
      },
      payments: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { paidAt: "desc" },
  });

  const totalSpent = purchases.reduce((sum, sale) => sum.add(sale.totalAmount), new Prisma.Decimal(0));
  const firstPurchaseAt = purchases.length ? purchases[purchases.length - 1].paidAt : null;
  const lastPurchaseAt = purchases.length ? purchases[0].paidAt : null;

  const categoryMap = new Map<
    string,
    { categoryId: string; categoryName: string; quantity: Prisma.Decimal; revenue: Prisma.Decimal }
  >();
  const paymentMap = new Map<string, { method: string; uses: number; amount: Prisma.Decimal }>();

  for (const sale of purchases) {
    for (const item of sale.items) {
      const category = item.product.category;
      const current = categoryMap.get(category.id) ?? {
        categoryId: category.id,
        categoryName: category.name,
        quantity: new Prisma.Decimal(0),
        revenue: new Prisma.Decimal(0),
      };
      current.quantity = current.quantity.add(item.quantity);
      current.revenue = current.revenue.add(item.lineTotal);
      categoryMap.set(category.id, current);
    }

    for (const payment of sale.payments.filter((entry) => entry.status === "PAID")) {
      const current = paymentMap.get(payment.method) ?? {
        method: payment.method,
        uses: 0,
        amount: new Prisma.Decimal(0),
      };
      current.uses += 1;
      current.amount = current.amount.add(payment.amount);
      paymentMap.set(payment.method, current);
    }
  }

  const settings = await db.clientModuleSettings.findUnique({
    where: { organizationId: context.organizationId },
  });
  const now = new Date();
  const daysWithoutPurchase = lastPurchaseAt
    ? Math.floor((now.getTime() - lastPurchaseAt.getTime()) / 86_400_000)
    : null;
  const inactivityAlert = Boolean(
    settings?.inactivityDays &&
      daysWithoutPurchase !== null &&
      daysWithoutPurchase >= settings.inactivityDays,
  );

  return {
    client,
    commercial: {
      purchaseCount: purchases.length,
      totalSpent,
      averageTicket: decimalAverage(totalSpent, purchases.length),
      firstPurchaseAt,
      lastPurchaseAt,
      customerType: purchases.length > 1 ? "RECURRING" : purchases.length === 1 ? "NEW" : "NO_PURCHASE",
      inactivityDaysConfigured: settings?.inactivityDays ?? null,
      daysWithoutPurchase,
      inactivityAlert,
      predominantCategories: [...categoryMap.values()].sort((a, b) => b.revenue.comparedTo(a.revenue)),
      paymentMethods: [...paymentMap.values()].sort((a, b) => b.amount.comparedTo(a.amount)),
    },
    purchases,
    relationship: client.crmEntries,
  };
}

export async function listInactivityAlerts(context: ClientAccessContext) {
  assertPermission(context.role, "clients:read");
  assertPermission(context.role, "sales:read");

  const settings = await db.clientModuleSettings.findUnique({
    where: { organizationId: context.organizationId },
  });
  if (!settings?.inactivityDays) {
    return { inactivityDays: null, alerts: [] };
  }

  const lastPurchases = await db.sale.groupBy({
    by: ["clientId"],
    where: {
      organizationId: context.organizationId,
      stage: "PAID",
      paidAt: { not: null },
    },
    _max: { paidAt: true },
  });

  const cutoff = new Date(Date.now() - settings.inactivityDays * 86_400_000);
  const inactive = lastPurchases.filter((entry) => entry._max.paidAt && entry._max.paidAt <= cutoff);
  const clients = await db.client.findMany({
    where: {
      organizationId: context.organizationId,
      id: { in: inactive.map((entry) => entry.clientId) },
    },
    include: {
      segment: true,
      responsibleSeller: { include: { user: true } },
    },
  });
  const clientMap = new Map(clients.map((client) => [client.id, client]));

  return {
    inactivityDays: settings.inactivityDays,
    alerts: inactive
      .map((entry) => {
        const lastPurchaseAt = entry._max.paidAt!;
        return {
          client: clientMap.get(entry.clientId),
          lastPurchaseAt,
          daysWithoutPurchase: Math.floor((Date.now() - lastPurchaseAt.getTime()) / 86_400_000),
        };
      })
      .filter((entry) => entry.client)
      .sort((a, b) => b.daysWithoutPurchase - a.daysWithoutPurchase),
  };
}
