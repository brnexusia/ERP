import { NextResponse } from "next/server";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import {
  ProductConflictError,
  ProductNotFoundError,
  ProductRuleError,
} from "@/modules/products/service";

export function productErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ProductNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ProductConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof ProductRuleError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  return null;
}
