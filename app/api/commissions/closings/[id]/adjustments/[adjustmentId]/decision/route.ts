import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { correctionError } from "@/modules/commissions/adjustment-http";
import { adjustmentDecisionSchema } from "@/modules/commissions/adjustment-schema";
import { decideCommissionAdjustment } from "@/modules/commissions/adjustments";

type Context = { params: Promise<{ id: string; adjustmentId: string }> };
export async function POST(request: Request, context: Context) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = adjustmentDecisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Decisão inválida.", details: parsed.error.flatten() }, { status: 400 });
  const { id, adjustmentId } = await context.params;
  try {
    return NextResponse.json({ adjustment:
      await decideCommissionAdjustment(session, id, adjustmentId, parsed.data) });
  } catch (error) {
    const response = correctionError(error);
    if (response) return response;
    throw error;
  }
}
