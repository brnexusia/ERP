import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";
import { SaleNotFoundError } from "@/modules/sales/service";

export type SaleTimelineEvent = {
  type:
    | "QUOTE_CREATED"
    | "ORDER_CONFIRMED"
    | "PAYMENT_REGISTERED"
    | "PAYMENT_SETTLED"
    | "SALE_PAID"
    | "SUPPORT_RECORDED"
    | "DELIVERY_REGISTERED"
    | "PICKUP_REGISTERED";
  occurredAt: Date;
  entityId: string;
  data: Record<string, unknown>;
};

export async function getSaleTimeline(
  context: ClientAccessContext,
  saleId: string,
) {
  assertPermission(context.role, "sales:read");

  const sale = await db.sale.findFirst({
    where: {
      id: saleId,
      organizationId: context.organizationId,
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          documentType: true,
          document: true,
          whatsapp: true,
          email: true,
        },
      },
      seller: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      items: {
        orderBy: { createdAt: "asc" },
      },
      payments: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
      supportRecords: {
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
      delivery: true,
    },
  });

  if (!sale) throw new SaleNotFoundError();

  const timeline: SaleTimelineEvent[] = [
    {
      type: "QUOTE_CREATED",
      occurredAt: sale.quotedAt,
      entityId: sale.id,
      data: {
        channel: sale.channel,
        totalAmount: sale.totalAmount,
        itemCount: sale.items.length,
        clientId: sale.clientId,
        sellerMembershipId: sale.sellerMembershipId,
      },
    },
  ];

  if (sale.orderedAt) {
    timeline.push({
      type: "ORDER_CONFIRMED",
      occurredAt: sale.orderedAt,
      entityId: sale.id,
      data: { totalAmount: sale.totalAmount },
    });
  }

  for (const payment of sale.payments) {
    timeline.push({
      type: "PAYMENT_REGISTERED",
      occurredAt: payment.createdAt,
      entityId: payment.id,
      data: {
        method: payment.method,
        status: payment.status,
        amount: payment.amount,
        dueDate: payment.dueDate,
      },
    });

    if (payment.settledAt) {
      timeline.push({
        type: "PAYMENT_SETTLED",
        occurredAt: payment.settledAt,
        entityId: payment.id,
        data: {
          method: payment.method,
          amount: payment.amount,
        },
      });
    }
  }

  if (sale.paidAt) {
    timeline.push({
      type: "SALE_PAID",
      occurredAt: sale.paidAt,
      entityId: sale.id,
      data: { totalAmount: sale.totalAmount },
    });
  }

  for (const support of sale.supportRecords) {
    timeline.push({
      type: "SUPPORT_RECORDED",
      occurredAt: support.createdAt,
      entityId: support.id,
      data: {
        kind: support.kind,
        content: support.content,
        createdBy: support.createdBy,
      },
    });
  }

  if (sale.delivery) {
    timeline.push({
      type: "DELIVERY_REGISTERED",
      occurredAt: sale.delivery.createdAt,
      entityId: sale.delivery.id,
      data: {
        method: sale.delivery.method,
        trackingCode: sale.delivery.trackingCode,
        carrierName: sale.delivery.carrierName,
        shipmentProofUrl: sale.delivery.shipmentProofUrl,
        deliveryProofUrl: sale.delivery.deliveryProofUrl,
      },
    });

    if (sale.delivery.pickupRegisteredAt) {
      timeline.push({
        type: "PICKUP_REGISTERED",
        occurredAt: sale.delivery.pickupRegisteredAt,
        entityId: sale.delivery.id,
        data: { method: sale.delivery.method },
      });
    }
  }

  timeline.sort((left, right) => {
    const byTime = left.occurredAt.getTime() - right.occurredAt.getTime();
    if (byTime !== 0) return byTime;
    return left.type.localeCompare(right.type);
  });

  return {
    sale: {
      id: sale.id,
      stage: sale.stage,
      channel: sale.channel,
      totalAmount: sale.totalAmount,
      quotedAt: sale.quotedAt,
      orderedAt: sale.orderedAt,
      paidAt: sale.paidAt,
      client: sale.client,
      seller: {
        membershipId: sale.seller.id,
        user: sale.seller.user,
      },
      items: sale.items,
      payments: sale.payments,
      delivery: sale.delivery,
    },
    supportRecords: sale.supportRecords,
    timeline,
  };
}
