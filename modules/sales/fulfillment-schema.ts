import { z } from "zod";

const checkedQuantity = z.union([z.string(), z.number()])
  .transform((value) => String(value).trim().replace(",", "."))
  .refine(
    (value) => /^\d{1,12}(?:\.\d{1,3})?$/.test(value) && Number(value) > 0,
    "Quantidade inválida.",
  );

export const fulfillItemsSchema = z.object({
  items: z.array(z.object({
    saleItemId: z.string().cuid(),
    quantity: checkedQuantity,
  })).min(1).max(200),
});
