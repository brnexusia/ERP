import { CommissionAdjustmentDirection } from "@prisma/client";
import { z } from "zod";

const money = z.union([z.string(), z.number()])
  .transform((v) => String(v).trim().replace(",", "."))
  .refine((v) => /^\d{1,12}(?:\.\d{1,2})?$/.test(v) && Number(v) > 0,
    "Valor positivo com até duas casas decimais obrigatório.");

export const adjustmentRequestSchema = z.object({
  direction: z.nativeEnum(CommissionAdjustmentDirection),
  amount: money,
  reason: z.string().trim().min(8).max(500),
});
export const adjustmentDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().max(500).optional(),
});
