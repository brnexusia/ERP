import { NextResponse } from "next/server";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import { SellerGoalNotFoundError, SellerGoalRuleError } from "@/modules/sellers/goal-service";

export function sellerGoalErrorResponse(error: unknown) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof SellerGoalNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof SellerGoalRuleError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  return null;
}
