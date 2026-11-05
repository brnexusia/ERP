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

  const requestedBands = input.classAUpToPercent !== undefined &&
    input.classBUpToPercent !== undefined
    ? { classAUpToPercent: input.classAUpToPercent, classBUpToPercent: input.classBUpToPercent }
    : null;
  let cumulativeValue = new Prisma.Decimal(0);

  return {
    basis: "PAID_SALES" as const,
    period: {
      start: input.start,
      end: input.end,
    },
    metric: input.metric,
    totalMetricValue,
    classificationStatus: requestedBands ? "EXPLICIT_THRESHOLDS" as const : "PENDING_THRESHOLDS" as const,
    thresholds: requestedBands,
    classificationSource: requestedBands ? "EXPLICIT_REQUEST" as const : null,
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

      // Do not assign class to a product without contribution; no metric
      // recorded in the chosen period is different from a low-performing
      // product with nonzero contribution.
      const rawCumulativePercent = totalMetricValue.isZero() ? new Prisma.Decimal(0)
        : cumulativeValue.div(totalMetricValue).mul(100);
      const abcClass = !requestedBands ? "PENDING_THRESHOLDS" as const
        : entry.metricValue.isZero() ? "UNCLASSIFIED" as const
        : rawCumulativePercent.lte(requestedBands.classAUpToPercent) ? "A" as const
        : rawCumulativePercent.lte(requestedBands.classBUpToPercent) ? "B" as const
        : "C" as const;

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
        abcClass,
      };
    }),
  };
}
