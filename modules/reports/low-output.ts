import { Prisma } from "@prisma/client";
import type { ClientAccessContext } from "@/modules/clients/service";
import type { LowOutputInput } from "@/modules/reports/schema";
import { getProductSalesMetrics } from "@/modules/reports/service";

function selectedValue(
  metric: LowOutputInput["metric"],
  entry: Awaited<ReturnType<typeof getProductSalesMetrics>>["products"][number],
) {
  if (metric === "REVENUE") return entry.revenue;
  if (metric === "SOLD_QUANTITY") return entry.soldQuantity;
  return new Prisma.Decimal(entry.paidSales);
}

export async function getLowOutputProducts(
  context: ClientAccessContext,
  input: LowOutputInput,
) {
  const metrics = await getProductSalesMetrics(context, {
    start: input.start,
    end: input.end,
  });
  const threshold = new Prisma.Decimal(input.threshold);

  const products = metrics.products
    .map((entry) => {
      const value = selectedValue(input.metric, entry);
      return {
        product: entry.product,
        stock: entry.stock,
        soldQuantity: entry.soldQuantity,
        revenue: entry.revenue,
        paidSales: entry.paidSales,
        lastSaleAt: entry.lastSaleAt,
        selectedMetric: {
          metric: input.metric,
          value,
          threshold,
        },
        lowOutput: value.comparedTo(threshold) <= 0,
      };
    })
    .sort((a, b) => {
      const metricOrder = a.selectedMetric.value.comparedTo(b.selectedMetric.value);
      if (metricOrder !== 0) return metricOrder;
      return a.product.name.localeCompare(b.product.name);
    });

  return {
    basis: "PAID_SALES" as const,
    period: {
      start: input.start,
      end: input.end,
    },
    criteria: {
      metric: input.metric,
      threshold,
      comparison: "LESS_THAN_OR_EQUAL" as const,
      source: "EXPLICIT_REQUEST" as const,
    },
    summary: {
      totalProducts: products.length,
      lowOutput: products.filter((entry) => entry.lowOutput).length,
      aboveThreshold: products.filter((entry) => !entry.lowOutput).length,
    },
    products,
  };
}
