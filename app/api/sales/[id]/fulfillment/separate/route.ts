import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { saleErrorResponse } from "@/modules/sales/http";
import { fulfillItemsSchema } from "@/modules/sales/fulfillment-schema";
import { separateSaleItems } from "@/modules/sales/fulfillment";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = fulfillItemsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Itens inválidos.", details: parsed.error.flatten() }, { status: 400 });
  }
  const { id } = await context.params;
  try { return NextResponse.json({ fulfillment: await separateSaleItems(session, id, parsed.data.items) }); }
  catch (error) {
    const response = saleErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
