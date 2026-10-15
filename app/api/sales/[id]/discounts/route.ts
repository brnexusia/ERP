import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { saleErrorResponse } from "@/modules/sales/http";
import { discountRequestSchema } from "@/modules/sales/discount-schema";
import { listSaleDiscounts, requestSaleDiscount } from "@/modules/sales/discounts";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await context.params;
  try { return NextResponse.json(await listSaleDiscounts(session, id)); }
  catch (error) {
    const response = saleErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request, context: Context) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = discountRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({
    error: "Informe percentual válido e justificativa do desconto.",
    details: parsed.error.flatten(),
  }, { status: 400 });
  const { id } = await context.params;
  try {
    const discount = await requestSaleDiscount(session, id, parsed.data);
    return NextResponse.json({ discount }, { status: 201 });
  } catch (error) {
    const response = saleErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
