import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { integrationConfigSchema } from "@/modules/integrations/schema";
import { integrationErrorResponse } from "@/modules/integrations/http";
import { listIntegrations, upsertIntegration } from "@/modules/integrations/service";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    return NextResponse.json({ integrations: await listIntegrations(session) });
  } catch (error) {
    const response = integrationErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = integrationConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Configuração de integração inválida.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      { integration: await upsertIntegration(session, parsed.data) },
      { status: 200 },
    );
  } catch (error) {
    const response = integrationErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
