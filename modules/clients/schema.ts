import { z } from "zod";
import { detectDocumentType, onlyDigits } from "@/modules/clients/document";

const normalizedDocument = z
  .string()
  .min(1)
  .transform(onlyDigits)
  .refine((value) => detectDocumentType(value) !== null, "CPF/CNPJ inválido.");

const normalizedWhatsapp = z
  .string()
  .min(1)
  .transform(onlyDigits)
  .refine((value) => value.length >= 10 && value.length <= 15, "WhatsApp inválido.");

const normalizedPostalCode = z
  .string()
  .min(1)
  .transform(onlyDigits)
  .refine((value) => value.length === 8, "CEP inválido.");

export const clientAddressSchema = z.object({
  postalCode: normalizedPostalCode,
  street: z.string().trim().min(2).max(200),
  number: z.string().trim().min(1).max(30),
  complement: z.string().trim().max(120).optional().nullable(),
  district: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  country: z.string().trim().length(2).transform((value) => value.toUpperCase()).default("BR"),
});

export const clientCreateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  document: normalizedDocument,
  whatsapp: normalizedWhatsapp,
  email: z.string().trim().toLowerCase().email().max(254),
  address: clientAddressSchema,
});

export const clientUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    document: normalizedDocument.optional(),
    whatsapp: normalizedWhatsapp.optional(),
    email: z.string().trim().toLowerCase().email().max(254).optional(),
    address: clientAddressSchema.partial().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualização.");

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;
