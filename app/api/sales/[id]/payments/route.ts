import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { salePaymentCreateSchema } from "@/modules/sales/schema";
import { addSalePayment } from "@/modules/sales/service";
import { saleErrorResponse } from "@/modules/sales/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  const parsed = salePaymentCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados do pagamento inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      { result: await addSalePayment(session, id, parsed.data) },
      { status: 201 },
    );
  } catch (error) {
    const response = saleErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
