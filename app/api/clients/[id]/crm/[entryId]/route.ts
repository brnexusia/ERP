import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { crmEntryUpdateSchema } from "@/modules/client-management/schema";
import { updateClientCrmEntry } from "@/modules/client-management/service";
import { clientManagementErrorResponse } from "@/modules/client-management/http";

type RouteContext = { params: Promise<{ id: string; entryId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id, entryId } = await context.params;
  const parsed = crmEntryUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Atualização de CRM inválida.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ entry: await updateClientCrmEntry(session, id, entryId, parsed.data) });
  } catch (error) {
    const response = clientManagementErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
