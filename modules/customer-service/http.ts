import { NextResponse } from "next/server";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import {
  CustomerServiceNotFoundError,
  CustomerServiceRuleError,
} from "@/modules/customer-service/service";

export function customerServiceErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof CustomerServiceNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof CustomerServiceRuleError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  return null;
}
