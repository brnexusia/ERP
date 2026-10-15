import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { saleErrorResponse } from "@/modules/sales/http";
import { listChequeReturns } from "@/modules/sales/cheque-returns";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await context.params;
  try { return NextResponse.json({ returnedCheques: await listChequeReturns(session, id) }); }
  catch (error) {
    const response = saleErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
