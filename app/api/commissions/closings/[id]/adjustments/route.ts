import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { correctionError } from "@/modules/commissions/adjustment-http";
import { adjustmentRequestSchema } from "@/modules/commissions/adjustment-schema";
import {
  listCommissionAdjustments, requestCommissionAdjustment,
} from "@/modules/commissions/adjustments";

type Context = { params: Promise<{ id: string }> };
export async function GET(_req: Request, context: Context) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await context.params;
  try { return NextResponse.json(await listCommissionAdjustments(session, id)); }
  catch (error) {
    const response = correctionError(error);
    if (response) return response;
    throw error;
  }
}
export async function POST(request: Request, context: Context) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = adjustmentRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Verifique sentido, valor e motivo da correção.",
    details: parsed.error.flatten() }, { status: 400 });
  const { id } = await context.params;
  try {
    return NextResponse.json({ adjustment: await requestCommissionAdjustment(session, id, parsed.data) },
      { status: 201 });
  } catch (error) {
    const response = correctionError(error);
    if (response) return response;
    throw error;
  }
}
