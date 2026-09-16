import { NextResponse } from "next/server";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import {
  FileStorageNotFoundError,
  FileStorageRuleError,
  FileStorageUnsupportedTypeError,
} from "@/modules/storage/service";

export function fileStorageErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof FileStorageNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof FileStorageUnsupportedTypeError) {
    return NextResponse.json({ error: error.message }, { status: 415 });
  }
  if (error instanceof FileStorageRuleError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  return null;
}
