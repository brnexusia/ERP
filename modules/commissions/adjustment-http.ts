import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import { CommissionClosingRuleError } from "@/modules/commissions/closings";
export function correctionError(error: unknown) {
  if (error instanceof PermissionDeniedError)
    return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof CommissionClosingRuleError)
    return NextResponse.json({ error: error.message }, { status: 422 });
  return null;
}
