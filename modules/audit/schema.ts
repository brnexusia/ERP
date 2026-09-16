import { z } from "zod";

const optionalDateTime = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .optional();

export const auditLogQuerySchema = z
  .object({
    action: z.string().trim().min(1).max(120).optional(),
    entityType: z.string().trim().min(1).max(120).optional(),
    userId: z.string().cuid().optional(),
    from: optionalDateTime,
    to: optionalDateTime,
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "Período de auditoria inválido.",
    path: ["to"],
  });

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
