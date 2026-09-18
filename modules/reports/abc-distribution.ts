import { Prisma } from "@prisma/client";
import type { ClientAccessContext } from "@/modules/clients/service";
import type { AbcDistributionInput } from "@/modules/reports/schema";
import { getProductSalesMetrics } from "@/modules/reports/service";

export async function getProductAbcDistribution(
  context: ClientAccessContext,
  input: AbcDistributionInput,
) {
  const metrics = await getProductSalesMetrics(context, {
    start: input.start,
    end: input.end,
  });

  const ranked = metrics.products
    .map((entry) => ({
      ...entry,
      metricValue:
        input.metric === "REVENUE"
          ? entry.revenue
          : entry.soldQuantity,
    }))
    .sort((a, b) => {
      const metricOrder = b.metricValue.comparedTo(a.metricValue);
      if (metricOrder !== 0) return metricOrder;
      return a.product.name.localeCompare(b.product.name);
    });

  const totalMetricValue = ranked.reduce(
    (sum, entry) => sum.add(entry.metricValue),
    new Prisma.Decimal(0),
  );

  let cumulativeValue = new Prisma.Decimal(0);

  return {
    basis: "PAID_SALES" as const,
    period: {
      start: input.start,
      end: input.end,
    },
    metric: input.metric,
    totalMetricValue,
    classificationStatus: "PENDING_THRESHOLDS" as const,
    products: ranked.map((entry, index) => {
      cumulativeValue = cumulativeValue.add(entry.metricValue);
      const sharePercent = totalMetricValue.isZero()
        ? new Prisma.Decimal(0)
        : entry.metricValue
            .div(totalMetricValue)
            .mul(100)
            .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      const cumulativeSharePercent = totalMetricValue.isZero()
        ? new Prisma.Decimal(0)
        : cumulativeValue
            .div(totalMetricValue)
            .mul(100)
            .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);

      return {
        rank: index + 1,
        product: entry.product,
        stock: entry.stock,
        soldQuantity: entry.soldQuantity,
        revenue: entry.revenue,
        paidSales: entry.paidSales,
        lastSaleAt: entry.lastSaleAt,
        selectedMetric: {
          metric: input.metric,
          value: entry.metricValue,
          sharePercent,
          cumulativeSharePercent,
        },
        abcClass: "PENDING_THRESHOLDS" as const,
      };
    }),
  };
}
