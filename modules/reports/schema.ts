import { z } from "zod";

const requiredDateSchema = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

export const reportPeriodSchema = z
  .object({
    start: requiredDateSchema.optional(),
    end: requiredDateSchema.optional(),
  })
  .refine(
    (value) => !value.start || !value.end || value.end >= value.start,
    { message: "A data final deve ser posterior ou igual à inicial." },
  );

export const purchaseComparisonSchema = z
  .object({
    metric: z.enum(["REVENUE", "PURCHASES"]),
    previousStart: requiredDateSchema,
    previousEnd: requiredDateSchema,
    currentStart: requiredDateSchema,
    currentEnd: requiredDateSchema,
  })
  .superRefine((value, context) => {
    if (value.previousEnd < value.previousStart) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["previousEnd"],
        message: "A data final do período anterior deve ser posterior ou igual à inicial.",
      });
    }

    if (value.currentEnd < value.currentStart) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["currentEnd"],
        message: "A data final do período atual deve ser posterior ou igual à inicial.",
      });
    }
  });

export const abcDistributionSchema = z
  .object({
    metric: z.enum(["REVENUE", "SOLD_QUANTITY"]),
    start: requiredDateSchema,
    end: requiredDateSchema,
    // Optional, query-local ABC bands: no unapproved company-wide defaults.
    classAUpToPercent: z.coerce.number().finite().optional(),
    classBUpToPercent: z.coerce.number().finite().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.end < value.start) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["end"],
        message: "A data final deve ser posterior ou igual à inicial." });
    }
    const a = value.classAUpToPercent;
    const b = value.classBUpToPercent;
    if ((a === undefined) !== (b === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["classBUpToPercent"],
        message: "Informe os dois limites de classe A e B, ou nenhum deles." });
    } else if (a !== undefined && b !== undefined && !(a > 0 && a < b && b < 100)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["classBUpToPercent"],
        message: "Limites inválidos: é obrigatório 0 < A < B < 100." });
    }
  });

export const lowOutputSchema = z
  .object({
    metric: z.enum(["REVENUE", "SOLD_QUANTITY", "PAID_SALES"]),
    threshold: z.coerce.number().finite().nonnegative(),
    start: requiredDateSchema,
    end: requiredDateSchema,
  })
  .refine(
    (value) => value.end >= value.start,
    { message: "A data final deve ser posterior ou igual à inicial.", path: ["end"] },
  );

export type ReportPeriod = z.infer<typeof reportPeriodSchema>;
export type PurchaseComparisonInput = z.infer<typeof purchaseComparisonSchema>;
export type AbcDistributionInput = z.infer<typeof abcDistributionSchema>;
export type LowOutputInput = z.infer<typeof lowOutputSchema>;
