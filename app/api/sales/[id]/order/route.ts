import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { confirmOrder } from "@/modules/sales/service";
import { saleErrorResponse } from "@/modules/sales/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  try {
    return NextResponse.json({ sale: await confirmOrder(session, id) });
  } catch (error) {
    const response = saleErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
