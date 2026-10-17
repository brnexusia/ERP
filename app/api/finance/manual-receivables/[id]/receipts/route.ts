import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { financeErrorResponse } from "@/modules/finance/http";
import { manualReceiptCreateSchema } from "@/modules/finance/manual-receivable-schema";
import { receiveManualReceivable } from "@/modules/finance/manual-receivables";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = manualReceiptCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({
    error: "Verifique o valor, forma, data e identificador do recebimento.",
    details: parsed.error.flatten(),
  }, { status: 400 });
  const { id } = await context.params;
  try {
    const receipt = await receiveManualReceivable(session, id, parsed.data);
    return NextResponse.json({ receipt }, { status: 201 });
  } catch (error) {
    const response = financeErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
