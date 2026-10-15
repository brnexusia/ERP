import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { saleErrorResponse } from "@/modules/sales/http";
import { listChequeReturns } from "@/modules/sales/cheque-returns";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try { return NextResponse.json({ returnedCheques: await listChequeReturns(session) }); }
  catch (error) {
    const response = saleErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
