import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { listInactivityAlerts } from "@/modules/reports/service";
import { reportErrorResponse } from "@/modules/reports/http";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    return NextResponse.json({ inactivity: await listInactivityAlerts(session) });
  } catch (error) {
    const response = reportErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
