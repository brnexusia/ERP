import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { clientSegmentAssignSchema } from "@/modules/client-management/schema";
import { assignClientSegment } from "@/modules/client-management/service";
import { clientManagementErrorResponse } from "@/modules/client-management/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  const parsed = clientSegmentAssignSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados da segmentação inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ client: await assignClientSegment(session, id, parsed.data) });
  } catch (error) {
    const response = clientManagementErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
