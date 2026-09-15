import { z } from "zod";

export const integrationProviders = [
  "VAXCHAT",
  "VAXLAB",
  "GOPAGE",
  "SHOPVAX",
  "WHATSAPP",
  "PAYMENT_GATEWAY",
  "ECOMMERCE",
] as const;

export const integrationConfigSchema = z.object({
  provider: z.enum(integrationProviders),
  key: z.string().trim().min(1).max(80).regex(/^[a-z0-9][a-z0-9_-]*$/i, "Chave de integração inválida."),
  displayName: z.string().trim().min(1).max(120),
  settings: z.record(z.unknown()).nullable().optional(),
  secretRef: z.string().trim().min(1).max(250).nullable().optional(),
  enabled: z.boolean().optional().default(true),
});

export type IntegrationConfigInput = z.infer<typeof integrationConfigSchema>;
