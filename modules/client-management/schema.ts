import { z } from "zod";

const moneyPattern = /^-?\d{1,12}(?:\.\d{1,2})?$/;
const nonNegativeMoneyPattern = /^\d{1,12}(?:\.\d{1,2})?$/;

function normalizeMoney(value: string | number): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NaN";
    return value.toString();
  }
  return value.trim().replace(",", ".");
}

const nonNegativeMoney = z
  .union([z.string(), z.number()])
  .transform(normalizeMoney)
  .refine((value) => nonNegativeMoneyPattern.test(value), "Valor monetário inválido.");

const signedMoney = z
  .union([z.string(), z.number()])
  .transform(normalizeMoney)
  .refine((value) => moneyPattern.test(value), "Valor monetário inválido.")
  .refine((value) => Number(value) !== 0, "A movimentação não pode ser zero.");

const optionalNote = z.string().trim().max(500).optional().nullable();

export const segmentCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const clientSegmentAssignSchema = z.object({
  segmentId: z.string().cuid().nullable(),
});

export const creditLimitSchema = z.object({
  creditLimit: nonNegativeMoney,
});

export const creditMovementSchema = z.object({
  amountDelta: signedMoney,
  note: optionalNote,
});

export const valeMovementSchema = z.object({
  amountDelta: signedMoney,
  note: optionalNote,
});

const isoDate = z.string().datetime({ offset: true }).transform((value) => new Date(value));
const optionalNullableIsoDate = z
  .union([z.string().datetime({ offset: true }).transform((value) => new Date(value)), z.null()])
  .optional();

export const crmEntryCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(5000),
  occurredAt: isoDate.optional(),
  followUpAt: optionalNullableIsoDate,
});

export const crmEntryUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    content: z.string().trim().min(1).max(5000).optional(),
    occurredAt: isoDate.optional(),
    followUpAt: optionalNullableIsoDate,
    completedAt: optionalNullableIsoDate,
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualização.");

export const inactivitySettingsSchema = z.object({
  inactivityDays: z.number().int().positive().nullable(),
});

export type SegmentCreateInput = z.infer<typeof segmentCreateSchema>;
export type ClientSegmentAssignInput = z.infer<typeof clientSegmentAssignSchema>;
export type CreditLimitInput = z.infer<typeof creditLimitSchema>;
export type CreditMovementInput = z.infer<typeof creditMovementSchema>;
export type ValeMovementInput = z.infer<typeof valeMovementSchema>;
export type CrmEntryCreateInput = z.infer<typeof crmEntryCreateSchema>;
export type CrmEntryUpdateInput = z.infer<typeof crmEntryUpdateSchema>;
export type InactivitySettingsInput = z.infer<typeof inactivitySettingsSchema>;
