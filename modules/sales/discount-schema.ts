import { z } from "zod";

const percent = z.union([z.string(), z.number()])
  .transform((value) => String(value).trim().replace(",", "."))
  .refine((value) => /^(?:0?[0-9]|[1-9][0-9])(?:\.\d{1,2})?$/.test(value)
    && Number(value) > 0 && Number(value) < 100,
    "Desconto deve ser maior que zero e menor que 100%.");

export const discountRequestSchema = z.object({
  percent,
  reason: z.string().trim().min(5).max(500),
});

export const discountDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().max(500).optional(),
});

