import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";

const DAY_MS = 86_400_000;

export async function getClientLifecycleClassification(context: ClientAccessContext) {
  assertPermission(context.role, "clients:read");
  assertPermission(context.role, "sales:read");

  const [clients, purchases, settings] = await Promise.all([
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
    db.sale.groupBy({
      by: ["clientId"],
      where: {
        organizationId: context.organizationId,
        stage: "PAID",
        paidAt: { not: null },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
      _min: { paidAt: true },
      _max: { paidAt: true },
    }),
    db.clientModuleSettings.findUnique({
      where: { organizationId: context.organizationId },
    }),
  ]);

  const purchaseByClient = new Map(purchases.map((entry) => [entry.clientId, entry]));
  const now = Date.now();
  const inactivityDays = settings?.inactivityDays ?? null;

  const classified = clients.map((client) => {
    const purchase = purchaseByClient.get(client.id);
    const purchaseCount = purchase?._count._all ?? 0;
    const firstPurchaseAt = purchase?._min.paidAt ?? null;
    const lastPurchaseAt = purchase?._max.paidAt ?? null;
    const daysWithoutPurchase = lastPurchaseAt
      ? Math.max(0, Math.floor((now - lastPurchaseAt.getTime()) / DAY_MS))
      : null;

    const customerType = purchaseCount === 0
      ? "NO_PURCHASE"
      : purchaseCount === 1
        ? "NEW"
        : "RECURRING";

    const stoppedBuying = inactivityDays === null || lastPurchaseAt === null
      ? false
      : daysWithoutPurchase! >= inactivityDays;

    return {
      client,
      purchaseCount,
      totalPurchased: purchase?._sum.totalAmount ?? new Prisma.Decimal(0),
      firstPurchaseAt,
      lastPurchaseAt,
      daysWithoutPurchase,
      customerType,
      stoppedBuying,
    };
  });

  return {
    inactivityDays,
    summary: {
      totalClients: classified.length,
      withoutPurchase: classified.filter((entry) => entry.customerType === "NO_PURCHASE").length,
      newClients: classified.filter((entry) => entry.customerType === "NEW").length,
      recurringClients: classified.filter((entry) => entry.customerType === "RECURRING").length,
      stoppedBuying: classified.filter((entry) => entry.stoppedBuying).length,
    },
    clients: classified,
    reducedPurchases: {
      status: "PENDING_RULE_DEFINITION" as const,
      reason: "O documento exige identificar redução de compras, mas não define períodos, métrica ou limiar de queda.",
    },
  };
}
