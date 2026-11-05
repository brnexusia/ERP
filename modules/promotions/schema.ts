import { z } from "zod";

/** Registry metadata only. No promotion ever changes a price until rules are approved. */
const common = {
  name: z.string().trim().min(1).max(160),
  notes: z.string().trim().max(2000).nullable().optional(),
};
const product = z.object({
  ...common, kind: z.literal("PRODUCT"), productId: z.string().cuid(),
}).strict();
const category = z.object({
  ...common, kind: z.literal("CATEGORY"), categoryId: z.string().cuid(),
}).strict();
const byAmount = z.object({
  ...common, kind: z.literal("PROGRESSIVE_VALUE"),
}).strict();
const byQuantity = z.object({
  ...common, kind: z.literal("PROGRESSIVE_QUANTITY"),
}).strict();

export const promotionDraftCreateSchema = z.discriminatedUnion("kind", [
  product, category, byAmount, byQuantity,
]);
export type PromotionDraftCreateInput = z.infer<typeof promotionDraftCreateSchema>;
