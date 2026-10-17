import { ManualReceiptMethod } from "@prisma/client";
import { z } from "zod";

const money = z.union([z.string(), z.number()])
  .transform((value) => String(value).trim().replace(",", "."))
  .refine((value) => /^\d{1,12}(?:\.\d{1,2})?$/.test(value) && Number(value) > 0,
    "Informe um valor positivo com até duas casas decimais.");
const date = z.string().datetime({ offset: true }).transform((value) => new Date(value));

export const manualReceivableCreateSchema = z.object({
  clientId: z.string().cuid(),
  sourceReference: z.string().trim().min(4).max(80),
  description: z.string().trim().min(5).max(500),
  amount: money,
  dueDate: date,
});
export const manualReceiptCreateSchema = z.object({
  amount: money,
  method: z.nativeEnum(ManualReceiptMethod),
  receivedAt: date,
  idempotencyKey: z.string().uuid(),
  note: z.string().trim().max(500).nullable().optional(),
});
