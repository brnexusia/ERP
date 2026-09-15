import { BankEntryDirection } from "@prisma/client";
import { z } from "zod";

const money = z
  .union([z.string(), z.number()])
  .transform((value) => (typeof value === "number" ? value.toString() : value.trim().replace(",", ".")))
  .refine((value) => /^\d{1,12}(?:\.\d{1,2})?$/.test(value) && Number(value) > 0, "Valor inválido.");

const dateTime = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

export const accountPayableCreateSchema = z.object({
  description: z.string().trim().min(1).max(500),
  amount: money,
  dueDate: dateTime,
});

export const bankStatementEntryCreateSchema = z.object({
  direction: z.nativeEnum(BankEntryDirection),
  amount: money,
  occurredAt: dateTime,
  description: z.string().trim().min(1).max(500),
  reference: z.string().trim().min(1).max(200).nullable().optional(),
});

export const bankReconciliationCreateSchema = z
  .object({
    salePaymentId: z.string().cuid().optional(),
    accountPayableId: z.string().cuid().optional(),
    amount: money,
    note: z.string().trim().min(1).max(500).nullable().optional(),
  })
  .refine(
    (value) => Number(Boolean(value.salePaymentId)) + Number(Boolean(value.accountPayableId)) === 1,
    "Informe exatamente um pagamento de venda ou uma conta a pagar.",
  );

export const financePeriodSchema = z
  .object({
    from: dateTime.optional(),
    to: dateTime.optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, "Período inválido.");

export type AccountPayableCreateInput = z.infer<typeof accountPayableCreateSchema>;
export type BankStatementEntryCreateInput = z.infer<typeof bankStatementEntryCreateSchema>;
export type BankReconciliationCreateInput = z.infer<typeof bankReconciliationCreateSchema>;
export type FinancePeriodInput = z.infer<typeof financePeriodSchema>;
