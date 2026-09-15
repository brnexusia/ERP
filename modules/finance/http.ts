import { NextResponse } from "next/server";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import { FinanceNotFoundError, FinanceRuleError } from "@/modules/finance/service";

export function financeErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof FinanceNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof FinanceRuleError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  return null;
}
