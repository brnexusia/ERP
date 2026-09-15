import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { salePaymentUpdateSchema } from "@/modules/sales/schema";
import { updateSalePayment } from "@/modules/sales/service";
import { saleErrorResponse } from "@/modules/sales/http";

type RouteContext = { params: Promise<{ id: string; paymentId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id, paymentId } = await context.params;
  const parsed = salePaymentUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Atualização do pagamento inválida.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ result: await updateSalePayment(session, id, paymentId, parsed.data) });
  } catch (error) {
    const response = saleErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
