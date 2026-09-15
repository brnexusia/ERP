import { NextResponse } from "next/server";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import {
  OrganizationUserNotFoundError,
  OrganizationUserRuleError,
} from "@/modules/users/service";

export function organizationUserErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof OrganizationUserNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof OrganizationUserRuleError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  return null;
}
