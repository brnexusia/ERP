import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { financeErrorResponse } from "@/modules/finance/http";
import { settleAccountPayable } from "@/modules/finance/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  try {
    return NextResponse.json({ payable: await settleAccountPayable(session, id) });
  } catch (error) {
    const response = financeErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
