import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { getClientCommercialProfile } from "@/modules/reports/service";
import { reportErrorResponse } from "@/modules/reports/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  try {
    return NextResponse.json({ profile: await getClientCommercialProfile(session, id) });
  } catch (error) {
    const response = reportErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
