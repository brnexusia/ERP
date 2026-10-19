import { CommissionRecipientKind } from "@prisma/client";
import { z } from "zod";

export const commissionClosingSchema = z.object({
  month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/, "Mês inválido."),
  kind: z.nativeEnum(CommissionRecipientKind),
  sourceId: z.string().cuid(),
});
