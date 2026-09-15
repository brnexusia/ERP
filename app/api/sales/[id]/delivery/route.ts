import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { customerServiceErrorResponse } from "@/modules/customer-service/http";
import { saleDeliverySchema } from "@/modules/customer-service/schema";
import { getSaleDelivery, saveSaleDelivery } from "@/modules/customer-service/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  try {
    return NextResponse.json({ delivery: await getSaleDelivery(session, id) });
  } catch (error) {
    const response = customerServiceErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  const parsed = saleDeliverySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados de entrega inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ delivery: await saveSaleDelivery(session, id, parsed.data) });
  } catch (error) {
    const response = customerServiceErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
