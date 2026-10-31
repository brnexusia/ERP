import { NextResponse } from "next/server";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import { PromotionDraftNotFoundError } from "@/modules/promotions/service";

export function promotionErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof PromotionDraftNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  return null;
}
