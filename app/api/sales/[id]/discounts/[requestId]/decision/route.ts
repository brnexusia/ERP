import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { saleErrorResponse } from "@/modules/sales/http";
import { discountDecisionSchema } from "@/modules/sales/discount-schema";
import { decideSaleDiscount } from "@/modules/sales/discounts";

type Context = { params: Promise<{ id: string; requestId: string }> };
export async function POST(request: Request, context: Context) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = discountDecisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Decisão inválida.", details: parsed.error.flatten() }, { status: 400 });
  }
  const { id, requestId } = await context.params;
  try {
    const discount = await decideSaleDiscount(session, id, requestId, parsed.data);
    return NextResponse.json({ discount });
  } catch (error) {
    const response = saleErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
