import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { inactivitySettingsSchema } from "@/modules/client-management/schema";
import {
  getClientModuleSettings,
  updateClientModuleSettings,
} from "@/modules/client-management/service";
import { clientManagementErrorResponse } from "@/modules/client-management/http";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    return NextResponse.json({ settings: await getClientModuleSettings(session) });
  } catch (error) {
    const response = clientManagementErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function PATCH(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = inactivitySettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Configuração de inatividade inválida.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ settings: await updateClientModuleSettings(session, parsed.data) });
  } catch (error) {
    const response = clientManagementErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
