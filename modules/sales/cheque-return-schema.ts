import { ChequeRecoveryMethod } from "@prisma/client";
import { z } from "zod";

const date = z.string().datetime({ offset: true }).transform((value) => new Date(value));
const amount = z.union([z.string(), z.number()])
  .transform((value) => String(value).trim().replace(",", "."))
  .refine((value) => /^\d{1,12}(?:\.\d{1,2})?$/.test(value) && Number(value) > 0);

export const returnedChequeSchema = z.object({
  returnedAt: date,
  reason: z.string().trim().min(5).max(500),
});

export const chequeRecoverySchema = z.object({
  method: z.nativeEnum(ChequeRecoveryMethod),
  receivedAt: date,
  amount,
  idempotencyKey: z.string().uuid(),
  note: z.string().trim().max(500).nullable().optional(),
});
