import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { financePeriodSchema } from "@/modules/finance/schema";
import { financeErrorResponse } from "@/modules/finance/http";
import { getFinancialReport } from "@/modules/finance/service";

export async function GET(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const url = new URL(request.url);
  const parsed = financePeriodSchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Período financeiro inválido.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ report: await getFinancialReport(session, parsed.data) });
  } catch (error) {
    const response = financeErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
