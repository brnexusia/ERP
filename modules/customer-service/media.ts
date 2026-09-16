import { db } from "@/lib/db";
import { assertPermission } from "@/lib/auth/permissions";
import type { ClientAccessContext } from "@/modules/clients/service";
import {
  CustomerServiceNotFoundError,
  CustomerServiceRuleError,
} from "@/modules/customer-service/service";
import { removeStoredFile, storeFile } from "@/modules/storage/service";

export type DeliveryProofKind = "shipment" | "delivery";

export async function attachCarrierDeliveryProof(
  context: ClientAccessContext,
  saleId: string,
  kind: DeliveryProofKind,
  file: File,
) {
  assertPermission(context.role, "sales:write");

  const delivery = await db.saleDelivery.findFirst({
    where: {
      organizationId: context.organizationId,
      saleId,
    },
  });
  if (!delivery) {
    throw new CustomerServiceNotFoundError("Entrega não encontrada para esta venda.");
  }
  if (delivery.method !== "CARRIER") {
    throw new CustomerServiceRuleError(
      "Comprovante de transportadora só pode ser anexado a entregas por transportadora.",
    );
  }

  const currentUrl = kind === "shipment" ? delivery.shipmentProofUrl : delivery.deliveryProofUrl;
  if (currentUrl) {
    throw new CustomerServiceRuleError(
      kind === "shipment"
        ? "Esta entrega já possui comprovante de envio registrado."
        : "Esta entrega já possui comprovante de entrega registrado.",
    );
  }

  const stored = await storeFile(context, file, {
    purpose: "DELIVERY_PROOF",
    visibility: "private",
  });

  try {
    const updated = await db.$transaction(async (tx) => {
      const saved = await tx.saleDelivery.update({
        where: { id: delivery.id },
        data:
          kind === "shipment"
            ? { shipmentProofUrl: stored.url }
            : { deliveryProofUrl: stored.url },
      });

      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          userId: context.userId,
          action: "SALE_DELIVERY_PROOF_ATTACH",
          entityType: "SaleDelivery",
          entityId: delivery.id,
          metadata: {
            saleId,
            kind,
            fileToken: stored.token,
          },
        },
      });

      return saved;
    });

    return { delivery: updated, file: stored };
  } catch (error) {
    await removeStoredFile(context, stored.token).catch(() => undefined);
    throw error;
  }
}
