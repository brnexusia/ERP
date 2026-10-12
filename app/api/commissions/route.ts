import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import { CommissionInputError, getCommissionPreview } from "@/modules/commissions/service";

export async function GET(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  try {
    const report = await getCommissionPreview(session, month);
    return NextResponse.json({ report });
  } catch (error) {
    if (error instanceof PermissionDeniedError)
      return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof CommissionInputError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
