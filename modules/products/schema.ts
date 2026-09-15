import { z } from "zod";

const money = z
  .union([z.string(), z.number()])
  .transform((value) => (typeof value === "number" ? value.toString() : value.trim().replace(",", ".")))
  .refine((value) => /^\d{1,12}(?:\.\d{1,2})?$/.test(value), "Valor monetário inválido.");

const quantity = z
  .union([z.string(), z.number()])
  .transform((value) => (typeof value === "number" ? value.toString() : value.trim().replace(",", ".")))
  .refine((value) => /^\d{1,12}(?:\.\d{1,3})?$/.test(value), "Quantidade inválida.");

const technicalAttributeValue = z.union([z.string(), z.number(), z.boolean()]);

export const productCategoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: z.string().cuid().nullable().optional(),
});

export const productPhotoSchema = z.object({
  url: z.string().trim().url().max(2048),
  variation: z.string().trim().min(1).max(120).nullable().optional(),
});

export const productCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    sku: z.string().trim().min(1).max(120),
    barcode: z.string().trim().min(1).max(120).nullable().optional(),
    categoryId: z.string().cuid(),
    subcategoryId: z.string().cuid().nullable().optional(),
    brandManufacturer: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(10000),
    technicalAttributes: z.record(z.string().trim().min(1).max(120), technicalAttributeValue).optional(),
    photos: z.array(productPhotoSchema).max(50).default([]),
    costPrice: money,
    salePrice: money,
    unitMeasure: z.string().trim().min(1).max(40),
    stock: z.object({
      quantity,
      minimum: quantity,
      maximum: quantity,
    }),
  })
  .refine(
    (value) => Number(value.stock.maximum) >= Number(value.stock.minimum),
    { message: "Estoque máximo deve ser maior ou igual ao mínimo.", path: ["stock", "maximum"] },
  );

export const productUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    sku: z.string().trim().min(1).max(120).optional(),
    barcode: z.string().trim().min(1).max(120).nullable().optional(),
    categoryId: z.string().cuid().optional(),
    subcategoryId: z.string().cuid().nullable().optional(),
    brandManufacturer: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(10000).optional(),
    technicalAttributes: z.record(z.string().trim().min(1).max(120), technicalAttributeValue).nullable().optional(),
    photos: z.array(productPhotoSchema).max(50).optional(),
    costPrice: money.optional(),
    salePrice: money.optional(),
    unitMeasure: z.string().trim().min(1).max(40).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualização.");

export const stockUpdateSchema = z
  .object({
    quantity: quantity.optional(),
    minimum: quantity.optional(),
    maximum: quantity.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo de estoque.");

export type ProductCategoryCreateInput = z.infer<typeof productCategoryCreateSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type StockUpdateInput = z.infer<typeof stockUpdateSchema>;
