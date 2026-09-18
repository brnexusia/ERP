import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";
import type { PurchaseComparisonInput } from "@/modules/reports/schema";

type PeriodTotals = {
  purchases: number;
  revenue: Prisma.Decimal;
};

function emptyTotals(): PeriodTotals {
  return { purchases: 0, revenue: new Prisma.Decimal(0) };
}

function inPeriod(date: Date, start: Date, end: Date) {
  return date >= start && date <= end;
}

function metricValue(metric: PurchaseComparisonInput["metric"], totals: PeriodTotals) {
  return metric === "REVENUE"
    ? totals.revenue
    : new Prisma.Decimal(totals.purchases);
}

export async function getClientPurchaseComparison(
  context: ClientAccessContext,
  input: PurchaseComparisonInput,
) {
  assertPermission(context.role, "clients:read");
  assertPermission(context.role, "sales:read");

  const [clients, sales] = await Promise.all([
    db.client.findMany({
      where: { organizationId: context.organizationId },
      include: {
        segment: true,
        responsibleSeller: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    }),
    db.sale.findMany({
      where: {
        organizationId: context.organizationId,
        stage: "PAID",
        paidAt: {
          not: null,
          gte: input.previousStart < input.currentStart
            ? input.previousStart
            : input.currentStart,
          lte: input.previousEnd > input.currentEnd
            ? input.previousEnd
            : input.currentEnd,
        },
      },
      select: {
        clientId: true,
        paidAt: true,
        totalAmount: true,
      },
    }),
  ]);

  const totals = new Map<
    string,
    { previous: PeriodTotals; current: PeriodTotals }
  >();

  for (const sale of sales) {
    if (!sale.paidAt) continue;
    const entry = totals.get(sale.clientId) ?? {
      previous: emptyTotals(),
      current: emptyTotals(),
    };

    if (inPeriod(sale.paidAt, input.previousStart, input.previousEnd)) {
      entry.previous.purchases += 1;
      entry.previous.revenue = entry.previous.revenue.add(sale.totalAmount);
    }

    if (inPeriod(sale.paidAt, input.currentStart, input.currentEnd)) {
      entry.current.purchases += 1;
      entry.current.revenue = entry.current.revenue.add(sale.totalAmount);
    }

    totals.set(sale.clientId, entry);
  }

  const compared = clients.map((client) => {
    const entry = totals.get(client.id) ?? {
      previous: emptyTotals(),
      current: emptyTotals(),
    };

    const previousValue = metricValue(input.metric, entry.previous);
    const currentValue = metricValue(input.metric, entry.current);
    const absoluteChange = currentValue.minus(previousValue);
    const comparison = currentValue.comparedTo(previousValue);
    const direction = comparison < 0
      ? "REDUCED"
      : comparison > 0
        ? "INCREASED"
        : "UNCHANGED";

    return {
      client,
      previous: entry.previous,
      current: entry.current,
      delta: {
        purchases: entry.current.purchases - entry.previous.purchases,
        revenue: entry.current.revenue.minus(entry.previous.revenue),
      },
      selectedMetric: {
        metric: input.metric,
        previousValue,
        currentValue,
        absoluteChange,
        percentChange: previousValue.isZero()
          ? null
          : absoluteChange
              .div(previousValue)
              .mul(100)
              .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
        direction,
        reduced: direction === "REDUCED",
      },
    };
  });

  return {
    basis: "PAID_SALES" as const,
    metric: input.metric,
    periods: {
      previous: { start: input.previousStart, end: input.previousEnd },
      current: { start: input.currentStart, end: input.currentEnd },
    },
    summary: {
      totalClients: compared.length,
      reduced: compared.filter((entry) => entry.selectedMetric.direction === "REDUCED").length,
      increased: compared.filter((entry) => entry.selectedMetric.direction === "INCREASED").length,
      unchanged: compared.filter((entry) => entry.selectedMetric.direction === "UNCHANGED").length,
    },
    clients: compared,
  };
}
