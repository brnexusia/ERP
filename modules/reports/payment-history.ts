import { Prisma, type PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";
import { ReportNotFoundError } from "@/modules/reports/service";

const PAYMENT_METHODS: PaymentMethod[] = ["CARD", "PIX", "BOLETO", "CHEQUE"];

export async function getClientPaymentHistory(
  context: ClientAccessContext,
  clientId: string,
) {
  assertPermission(context.role, "clients:read");
  assertPermission(context.role, "sales:read");

  const client = await db.client.findFirst({
    where: { id: clientId, organizationId: context.organizationId },
    select: { id: true, name: true },
  });
  if (!client) throw new ReportNotFoundError("Cliente não encontrado.");

  const payments = await db.salePayment.findMany({
    where: {
      organizationId: context.organizationId,
      sale: {
        organizationId: context.organizationId,
        clientId,
      },
    },
    include: {
      sale: {
        select: {
          id: true,
          stage: true,
          channel: true,
          totalAmount: true,
          quotedAt: true,
          orderedAt: true,
          paidAt: true,
          sellerMembershipId: true,
          seller: {
            select: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const byMethod = Object.fromEntries(
    PAYMENT_METHODS.map((method) => [
      method,
      {
        records: 0,
        paidRecords: 0,
        pendingRecords: 0,
        registeredAmount: new Prisma.Decimal(0),
        paidAmount: new Prisma.Decimal(0),
      },
    ]),
  ) as Record<
    PaymentMethod,
    {
      records: number;
      paidRecords: number;
      pendingRecords: number;
      registeredAmount: Prisma.Decimal;
      paidAmount: Prisma.Decimal;
    }
  >;

  let registeredAmount = new Prisma.Decimal(0);
  let paidAmount = new Prisma.Decimal(0);
  let paidRecords = 0;
  let pendingRecords = 0;

  for (const payment of payments) {
    const method = byMethod[payment.method];
    method.records += 1;
    method.registeredAmount = method.registeredAmount.add(payment.amount);
    registeredAmount = registeredAmount.add(payment.amount);

    if (payment.status === "PAID") {
      method.paidRecords += 1;
      method.paidAmount = method.paidAmount.add(payment.amount);
      paidRecords += 1;
      paidAmount = paidAmount.add(payment.amount);
    } else {
      method.pendingRecords += 1;
      pendingRecords += 1;
    }
  }

  return {
    client,
    summary: {
      records: payments.length,
      paidRecords,
      pendingRecords,
      registeredAmount,
      paidAmount,
      byMethod,
    },
    payments,
  };
}
