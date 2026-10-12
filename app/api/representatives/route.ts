import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import { createRepresentative, listRepresentatives, representativeCreateSchema } from "@/modules/clients/commercial-settings";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try { return NextResponse.json({ representatives: await listRepresentatives(session) }); }
  catch (error) {
    if (error instanceof PermissionDeniedError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = representativeCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Representante inválido.", details: parsed.error.flatten() }, { status: 400 });
  try { return NextResponse.json({ representative: await createRepresentative(session, parsed.data) }, { status: 201 }); }
  catch (error) {
    if (error instanceof PermissionDeniedError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
}