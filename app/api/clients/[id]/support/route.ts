import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { customerServiceErrorResponse } from "@/modules/customer-service/http";
import { supportRecordCreateSchema } from "@/modules/customer-service/schema";
import {
  createClientSupportRecord,
  listClientSupportRecords,
} from "@/modules/customer-service/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  try {
    return NextResponse.json({ records: await listClientSupportRecords(session, id) });
  } catch (error) {
    const response = customerServiceErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  const parsed = supportRecordCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Registro de suporte inválido.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      { record: await createClientSupportRecord(session, id, parsed.data) },
      { status: 201 },
    );
  } catch (error) {
    const response = customerServiceErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
