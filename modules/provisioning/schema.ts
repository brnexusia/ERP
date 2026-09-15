import { z } from "zod";

export const organizationProvisioningSchema = z.object({
  organizationName: z.string().trim().min(2).max(160),
  organizationSlug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido."),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().trim().email().transform((value) => value.toLowerCase()),
  ownerPassword: z.string().min(10).max(200),
});

export type OrganizationProvisioningInput = z.infer<typeof organizationProvisioningSchema>;
