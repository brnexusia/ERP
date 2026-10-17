import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { financeErrorResponse } from "@/modules/finance/http";
import { listAccountsReceivable } from "@/modules/finance/service";
import { listManualReceivables } from "@/modules/finance/manual-receivables";
import { listChequeReturns } from "@/modules/sales/cheque-returns";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const [receivables, returnedCheques, manualReceivables] = await Promise.all([
      listAccountsReceivable(session),
      listChequeReturns(session),
      listManualReceivables(session),
    ]);
    return NextResponse.json({ receivables, returnedCheques, manualReceivables });
  } catch (error) {
    const response = financeErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
