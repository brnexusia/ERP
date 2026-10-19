import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import { CommissionInputError } from "@/modules/commissions/service";
import {
  CommissionClosingRuleError, closeCommission, listCommissionClosings,
} from "@/modules/commissions/closings";
import { commissionClosingSchema } from "@/modules/commissions/closing-schema";

function errorResponse(error: unknown) {
  if (error instanceof PermissionDeniedError)
    return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof CommissionClosingRuleError)
    return NextResponse.json({ error: error.message }, { status: 422 });
  if (error instanceof CommissionInputError)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return null;
}

export async function GET(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const month = new URL(request.url).searchParams.get("month") ?? "";
  try { return NextResponse.json({ closings: await listCommissionClosings(session, month) }); }
  catch (error) {
    const response = errorResponse(error);
    if (response) return response;
    throw error;
  }
}
export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = commissionClosingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({
    error: "Informe competência, tipo e identificador válidos.",
    details: parsed.error.flatten(),
  }, { status: 400 });
  try {
    return NextResponse.json({ closing: await closeCommission(session, parsed.data) },
      { status: 201 });
  } catch (error) {
    const response = errorResponse(error);
    if (response) return response;
    throw error;
  }
}
