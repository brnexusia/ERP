import { NextResponse } from "next/server";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import { IntegrationNotFoundError } from "@/modules/integrations/service";

export function integrationErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof IntegrationNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  return null;
}
