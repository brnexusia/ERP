import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { reportErrorResponse } from "@/modules/reports/http";
import { lowOutputSchema } from "@/modules/reports/schema";
import { getLowOutputProducts } from "@/modules/reports/low-output";

export async function GET(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const url = new URL(request.url);
  const parsed = lowOutputSchema.safeParse({
    metric: url.searchParams.get("metric") ?? undefined,
    threshold: url.searchParams.get("threshold") ?? undefined,
    start: url.searchParams.get("start") ?? undefined,
    end: url.searchParams.get("end") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Critério de baixa saída inválido.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({
      report: await getLowOutputProducts(session, parsed.data),
    });
  } catch (error) {
    const response = reportErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
