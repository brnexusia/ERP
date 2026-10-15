import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { financeErrorResponse } from "@/modules/finance/http";
import { listAccountsReceivable } from "@/modules/finance/service";
import { listChequeReturns } from "@/modules/sales/cheque-returns";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const [receivables, returnedCheques] = await Promise.all([
      listAccountsReceivable(session),
      listChequeReturns(session),
    ]);
    return NextResponse.json({ receivables, returnedCheques });
  } catch (error) {
    const response = financeErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
