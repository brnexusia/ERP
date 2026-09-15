import { z } from "zod";

export const reportPeriodSchema = z
  .object({
    start: z.string().datetime({ offset: true }).transform((value) => new Date(value)).optional(),
    end: z.string().datetime({ offset: true }).transform((value) => new Date(value)).optional(),
  })
  .refine(
    (value) => !value.start || !value.end || value.end >= value.start,
    { message: "A data final deve ser posterior ou igual à inicial." },
  );

export type ReportPeriod = z.infer<typeof reportPeriodSchema>;
