import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { creditLimitSchema } from "@/modules/client-management/schema";
import { getClientCredit, setClientCreditLimit } from "@/modules/client-management/service";
import { clientManagementErrorResponse } from "@/modules/client-management/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  try {
    return NextResponse.json({ credit: await getClientCredit(session, id) });
  } catch (error) {
    const response = clientManagementErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  const parsed = creditLimitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Limite de crédito inválido.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ credit: await setClientCreditLimit(session, id, parsed.data) });
  } catch (error) {
    const response = clientManagementErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
