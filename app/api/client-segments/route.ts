import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { segmentCreateSchema } from "@/modules/client-management/schema";
import { createSegment, listSegments } from "@/modules/client-management/service";
import { clientManagementErrorResponse } from "@/modules/client-management/http";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    return NextResponse.json({ segments: await listSegments(session) });
  } catch (error) {
    const response = clientManagementErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = segmentCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados do segmento inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ segment: await createSegment(session, parsed.data) }, { status: 201 });
  } catch (error) {
    const response = clientManagementErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
