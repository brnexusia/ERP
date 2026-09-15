import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { bankReconciliationCreateSchema } from "@/modules/finance/schema";
import { financeErrorResponse } from "@/modules/finance/http";
import { reconcileBankStatementEntry } from "@/modules/finance/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = bankReconciliationCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados da conciliação inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  try {
    return NextResponse.json(
      { reconciliation: await reconcileBankStatementEntry(session, id, parsed.data) },
      { status: 201 },
    );
  } catch (error) {
    const response = financeErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
