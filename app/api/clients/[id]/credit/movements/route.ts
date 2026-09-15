import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { creditMovementSchema } from "@/modules/client-management/schema";
import { addClientCreditMovement } from "@/modules/client-management/service";
import { clientManagementErrorResponse } from "@/modules/client-management/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  const parsed = creditMovementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Movimentação de crédito inválida.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      { credit: await addClientCreditMovement(session, id, parsed.data) },
      { status: 201 },
    );
  } catch (error) {
    const response = clientManagementErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
