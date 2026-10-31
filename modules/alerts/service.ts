import type { MembershipRole } from "@prisma/client";
import { PermissionDeniedError, hasPermission } from "@/lib/auth/permissions";
import { listInactivityAlerts } from "@/modules/reports/service";
import { listLowStockProducts } from "@/modules/products/service";

export type AlertAccessContext = {
  organizationId: string;
  userId: string;
  role: MembershipRole;
};

/**
 * Alerts are derived afresh from the official configured inactivity thresholds
 * and the actual quantity/minimum of each product. No new commercial rules,
 * background delivery or external notification provider are implied.
 */
export async function getOperationalAlerts(context: AlertAccessContext) {
  const clientsAllowed = hasPermission(context.role, "clients:read") &&
    hasPermission(context.role, "sales:read");
  const inventoryAllowed = hasPermission(context.role, "inventory:read");
  if (!clientsAllowed && !inventoryAllowed) {
    throw new PermissionDeniedError(["clients:read", "inventory:read"]);
  }

  const [clientsResult, stockResult] = await Promise.all([
    clientsAllowed ? listInactivityAlerts(context) : Promise.resolve(null),
    inventoryAllowed ? listLowStockProducts(context) : Promise.resolve(null),
  ]);

  // Explicit projections limit sensitive information in the unified alert
  // payload. In particular, acquisition costs never leave this service.
  const inactiveClients = (clientsResult?.alerts ?? []).map((entry) => ({
    id: entry.client.id,
    name: entry.client.name,
    daysWithoutPurchase: entry.daysWithoutPurchase,
    thresholdDays: entry.thresholdDays,
    lastPurchaseAt: entry.lastPurchaseAt?.toISOString() ?? null,
    responsibleSellerName: entry.sellerToNotify?.name ?? null,
  }));
  const lowStockProducts = (stockResult ?? []).map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    quantity: product.stock?.quantity.toString() ?? "0",
    minimum: product.stock?.minimum.toString() ?? "0",
    unitMeasure: product.unitMeasure,
  }));

  return {
    generatedAt: new Date().toISOString(),
    permissions: { clients: clientsAllowed, inventory: inventoryAllowed },
    configuredInactivityDays: clientsResult?.inactivityDays ?? null,
    summary: {
      total: inactiveClients.length + lowStockProducts.length,
      inactiveClients: inactiveClients.length,
      lowStockProducts: lowStockProducts.length,
    },
    inactiveClients,
    lowStockProducts,
  };
}
