import { z } from "zod";

const targetValueSchema = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const normalized = typeof value === "number" ? value.toString() : value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized) || Number(normalized) <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Meta deve ser um valor positivo com até duas casas decimais." });
    return z.NEVER;
  }
  return normalized;
});

const dateSchema = z.string().datetime({ offset: true }).transform((value) => new Date(value));

export const sellerGoalMetricSchema = z.enum(["REVENUE", "SALES", "CLIENTS"]);

export const createSellerGoalSchema = z.object({
  metric: sellerGoalMetricSchema,
  targetValue: targetValueSchema,
  startAt: dateSchema,
  endAt: dateSchema,
  note: z.string().trim().max(500).optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.endAt < value.startAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endAt"], message: "Fim da meta deve ser igual ou posterior ao início." });
  }
  if (value.metric !== "REVENUE" && !/^\d+$/.test(value.targetValue)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetValue"], message: "Metas de vendas ou clientes exigem quantidade inteira." });
  }
});

export const updateSellerGoalSchema = z.object({
  metric: sellerGoalMetricSchema.optional(),
  targetValue: targetValueSchema.optional(),
  startAt: dateSchema.optional(),
  endAt: dateSchema.optional(),
  note: z.string().trim().max(500).optional().nullable(),
}).refine((value) => Object.keys(value).length > 0, {
  message: "Informe ao menos um campo para atualizar.",
});

export type CreateSellerGoalInput = z.infer<typeof createSellerGoalSchema>;
export type UpdateSellerGoalInput = z.infer<typeof updateSellerGoalSchema>;
