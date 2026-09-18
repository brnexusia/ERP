import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { reportErrorResponse } from "@/modules/reports/http";
import { purchaseComparisonSchema } from "@/modules/reports/schema";
import { getClientPurchaseComparison } from "@/modules/reports/purchase-comparison";

export async function GET(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const url = new URL(request.url);
  const parsed = purchaseComparisonSchema.safeParse({
    metric: url.searchParams.get("metric") ?? undefined,
    previousStart: url.searchParams.get("previousStart") ?? undefined,
    previousEnd: url.searchParams.get("previousEnd") ?? undefined,
    currentStart: url.searchParams.get("currentStart") ?? undefined,
    currentEnd: url.searchParams.get("currentEnd") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Comparação inválida.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({
      report: await getClientPurchaseComparison(session, parsed.data),
    });
  } catch (error) {
    const response = reportErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
