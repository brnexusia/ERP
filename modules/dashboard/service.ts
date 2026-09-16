import type { MembershipRole } from "@prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import type { ReportPeriod } from "@/modules/reports/schema";
import { getCommercialDashboard, listInactivityAlerts } from "@/modules/reports/service";
import { getClientPurchaseRanking } from "@/modules/reports/client-ranking";
import { listLowStockProducts } from "@/modules/products/service";
import { getFinancialReport } from "@/modules/finance/service";

export type DashboardAccessContext = {
  organizationId: string;
  userId: string;
  role: MembershipRole;
};

export async function getGeneralDashboard(
  context: DashboardAccessContext,
  period: ReportPeriod,
) {
  const canReadSales = hasPermission(context.role, "sales:read");
  const canReadClients = hasPermission(context.role, "clients:read");
  const canReadInventory = hasPermission(context.role, "inventory:read");
  const canReadFinance = hasPermission(context.role, "finance:read");

  const [commercial, inactivity, clientRanking, lowStock, finance] = await Promise.all([
    canReadSales ? getCommercialDashboard(context, period) : Promise.resolve(null),
    canReadSales && canReadClients ? listInactivityAlerts(context) : Promise.resolve(null),
    canReadSales && canReadClients ? getClientPurchaseRanking(context, period) : Promise.resolve(null),
    canReadInventory ? listLowStockProducts(context) : Promise.resolve(null),
    canReadFinance
      ? getFinancialReport(context, { from: period.start, to: period.end })
      : Promise.resolve(null),
  ]);

  return {
    period,
    permissions: {
      commercial: canReadSales,
      clients: canReadSales && canReadClients,
      inventory: canReadInventory,
      finance: canReadFinance,
    },
    commercial,
    clients: canReadSales && canReadClients
      ? {
          inactivity,
          topBuyers: clientRanking?.ranking.slice(0, 10) ?? [],
        }
      : null,
    inventory: canReadInventory
      ? {
          lowStockCount: lowStock?.length ?? 0,
          lowStock: lowStock ?? [],
        }
      : null,
    finance,
  };
}
