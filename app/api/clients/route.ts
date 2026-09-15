import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import { clientCreateSchema } from "@/modules/clients/schema";
import {
  ClientConflictError,
  createClient,
  listClients,
} from "@/modules/clients/service";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const clients = await listClients(session);
    return NextResponse.json({ clients });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = clientCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados do cliente inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const client = await createClient(session, parsed.data);
    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ClientConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
