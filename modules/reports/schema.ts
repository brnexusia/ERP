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
  })
  .refine(
    (value) => value.end >= value.start,
    { message: "A data final deve ser posterior ou igual à inicial.", path: ["end"] },
  );

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
