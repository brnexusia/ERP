import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { saleErrorResponse } from "@/modules/sales/http";
import { chequeRecoverySchema } from "@/modules/sales/cheque-return-schema";
import { recordChequeRecovery } from "@/modules/sales/cheque-returns";

type Context = { params: Promise<{ id: string; paymentId: string }> };
export async function POST(request: Request, context: Context) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = chequeRecoverySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Valor, forma ou data de recuperação inválidos.", details: parsed.error.flatten() }, { status: 400 });
  }
  const { id, paymentId } = await context.params;
  try {
    return NextResponse.json({ recovery: await recordChequeRecovery(session, id, paymentId, parsed.data) },
      { status: 201 });
  } catch (error) {
    const response = saleErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
