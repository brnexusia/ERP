import { NextResponse } from "next/server";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import {
  ClientManagementConflictError,
  ClientManagementNotFoundError,
  ClientManagementRuleError,
} from "@/modules/client-management/service";

export function clientManagementErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ClientManagementNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ClientManagementConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof ClientManagementRuleError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  return null;
}
