import { MembershipRole } from "@prisma/client";
import { z } from "zod";

export const organizationUserCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  role: z.nativeEnum(MembershipRole),
  password: z.string().min(10).max(200).optional(),
});

export const organizationUserRoleUpdateSchema = z.object({
  role: z.nativeEnum(MembershipRole),
});

export type OrganizationUserCreateInput = z.infer<typeof organizationUserCreateSchema>;
export type OrganizationUserRoleUpdateInput = z.infer<typeof organizationUserRoleUpdateSchema>;
