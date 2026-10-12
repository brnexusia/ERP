import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import { creditPolicySchema, updateClientCreditPolicy } from "@/modules/clients/commercial-settings";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = creditPolicySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Política de crédito inválida.", details: parsed.error.flatten() }, { status: 400 });
  try {
    const { id } = await context.params;
    const client = await updateClientCreditPolicy(session, id, parsed.data);
    return client ? NextResponse.json({ client }) : NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  } catch (error) {
    if (error instanceof PermissionDeniedError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
}