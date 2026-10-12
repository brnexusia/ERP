import { NextResponse } from "next/server";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import { SaleNotFoundError, SaleRuleError } from "@/modules/sales/service";
import { PaymentBalanceError } from "@/modules/sales/payment-ledger";

export function saleErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof SaleNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof SaleRuleError || error instanceof PaymentBalanceError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  return null;
}
