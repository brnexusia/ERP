import { DeliveryMethod, SupportKind } from "@prisma/client";
import { z } from "zod";

export const supportRecordCreateSchema = z.object({
  kind: z.nativeEnum(SupportKind),
  saleId: z.string().cuid().nullable().optional(),
  content: z.string().trim().min(1).max(5000),
});

const pickupDeliverySchema = z.object({
  method: z.literal(DeliveryMethod.PICKUP),
  pickupRegisteredAt: z.string().datetime({ offset: true }).transform((value) => new Date(value)),
});

const correiosDeliverySchema = z.object({
  method: z.literal(DeliveryMethod.CORREIOS),
  trackingCode: z.string().trim().min(1).max(120),
});

const carrierDeliverySchema = z.object({
  method: z.literal(DeliveryMethod.CARRIER),
  carrierName: z.string().trim().min(1).max(200),
  shipmentProofUrl: z.string().trim().url().max(2048).nullable().optional(),
  deliveryProofUrl: z.string().trim().url().max(2048).nullable().optional(),
});

export const saleDeliverySchema = z.discriminatedUnion("method", [
  pickupDeliverySchema,
  correiosDeliverySchema,
  carrierDeliverySchema,
]);

export type SupportRecordCreateInput = z.infer<typeof supportRecordCreateSchema>;
export type SaleDeliveryInput = z.infer<typeof saleDeliverySchema>;
