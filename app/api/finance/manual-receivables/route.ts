import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { financeErrorResponse } from "@/modules/finance/http";
import { manualReceivableCreateSchema } from "@/modules/finance/manual-receivable-schema";
import { createManualReceivable, listManualReceivables } from "@/modules/finance/manual-receivables";

export async function GET(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const clientId = new URL(request.url).searchParams.get("clientId") ?? undefined;
  try { return NextResponse.json({ receivables: await listManualReceivables(session, clientId) }); }
  catch (error) {
    const response = financeErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = manualReceivableCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({
    error: "Verifique cliente, referência, motivo, valor e vencimento.",
    details: parsed.error.flatten(),
  }, { status: 400 });
  try {
    return NextResponse.json({ receivable: await createManualReceivable(session, parsed.data) },
      { status: 201 });
  } catch (error) {
    const response = financeErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
