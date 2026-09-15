import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { reportPeriodSchema } from "@/modules/reports/schema";
import { getCommercialDashboard } from "@/modules/reports/service";
import { reportErrorResponse } from "@/modules/reports/http";

export async function GET(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const url = new URL(request.url);
  const parsed = reportPeriodSchema.safeParse({
    start: url.searchParams.get("start") ?? undefined,
    end: url.searchParams.get("end") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Período inválido.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ report: await getCommercialDashboard(session, parsed.data) });
  } catch (error) {
    const response = reportErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
