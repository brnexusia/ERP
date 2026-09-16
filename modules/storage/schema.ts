import { z } from "zod";

export const filePurposeSchema = z.enum([
  "PRODUCT_IMAGE",
  "DELIVERY_PROOF",
  "CLIENT_FILE",
  "OTHER",
]);

export const fileVisibilitySchema = z.enum(["public", "private"]);

export const fileUploadMetadataSchema = z.object({
  purpose: filePurposeSchema,
  visibility: fileVisibilitySchema.default("private"),
});

export type FilePurpose = z.infer<typeof filePurposeSchema>;
export type FileVisibility = z.infer<typeof fileVisibilitySchema>;
export type FileUploadMetadata = z.infer<typeof fileUploadMetadataSchema>;
