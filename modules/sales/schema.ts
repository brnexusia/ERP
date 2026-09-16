import { PaymentMethod, PaymentStatus, SalesChannel } from "@prisma/client";
import { z } from "zod";

const quantity = z
  .union([z.string(), z.number()])
  .transform((value) => (typeof value === "number" ? value.toString() : value.trim().replace(",", ".")))
  .refine((value) => /^\d{1,12}(?:\.\d{1,3})?$/.test(value) && Number(value) > 0, "Quantidade inválida.");

const money = z
  .union([z.string(), z.number()])
  .transform((value) => (typeof value === "number" ? value.toString() : value.trim().replace(",", ".")))
  .refine((value) => /^\d{1,12}(?:\.\d{1,2})?$/.test(value) && Number(value) > 0, "Valor inválido.");

const saleItems = z.array(
  z.object({
    productId: z.string().cuid(),
    quantity,
  }),
).min(1).max(200);

export const clientSellerAssignmentSchema = z.object({
  membershipId: z.string().cuid().nullable(),
});

export const saleCreateSchema = z.object({
  clientId: z.string().cuid(),
  sellerMembershipId: z.string().cuid().optional(),
  channel: z.nativeEnum(SalesChannel),
  items: saleItems,
});

export const saleQuoteUpdateSchema = z
  .object({
    sellerMembershipId: z.string().cuid().optional(),
    channel: z.nativeEnum(SalesChannel).optional(),
    items: saleItems.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualização.");

export const salePaymentCreateSchema = z
  .object({
    method: z.nativeEnum(PaymentMethod),
    status: z.nativeEnum(PaymentStatus),
    amount: money,
    dueDate: z.string().datetime({ offset: true }).transform((value) => new Date(value)).nullable().optional(),
  })
  .superRefine((value, context) => {
    const supportsDueDate = value.method === PaymentMethod.BOLETO || value.method === PaymentMethod.CHEQUE;
    if (value.dueDate && !supportsDueDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dueDate"],
        message: "Vencimento só pode ser informado para boleto ou cheque.",
      });
    }
  });

export const salePaymentUpdateSchema = z.object({
  status: z.nativeEnum(PaymentStatus),
});

export type ClientSellerAssignmentInput = z.infer<typeof clientSellerAssignmentSchema>;
export type SaleCreateInput = z.infer<typeof saleCreateSchema>;
export type SaleQuoteUpdateInput = z.infer<typeof saleQuoteUpdateSchema>;
export type SalePaymentCreateInput = z.infer<typeof salePaymentCreateSchema>;
export type SalePaymentUpdateInput = z.infer<typeof salePaymentUpdateSchema>;
