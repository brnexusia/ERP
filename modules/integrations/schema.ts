import { z } from "zod";
import { findUnsafeSettingsPath } from "@/modules/integrations/settings-safety";

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
}).superRefine((input, context) => {
  if (input.settings == null) return;
  const secretPath = findUnsafeSettingsPath(input.settings);
  if (secretPath) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["settings", ...secretPath],
      message: "Metadados da integração não devem conter credenciais. Use apenas a referência de segredo separada.",
    });
  }
});

export type IntegrationConfigInput = z.infer<typeof integrationConfigSchema>;
