import { NextResponse } from "next/server";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import { ReportNotFoundError } from "@/modules/reports/service";

export function reportErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ReportNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  return null;
}
