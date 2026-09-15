import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { reportErrorResponse } from "@/modules/reports/http";
import { getClientLifecycleClassification } from "@/modules/reports/client-classification";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    return NextResponse.json({ report: await getClientLifecycleClassification(session) });
  } catch (error) {
    const response = reportErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
