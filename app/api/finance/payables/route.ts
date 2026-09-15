import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { accountPayableCreateSchema } from "@/modules/finance/schema";
import { financeErrorResponse } from "@/modules/finance/http";
import { createAccountPayable, listAccountsPayable } from "@/modules/finance/service";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    return NextResponse.json({ payables: await listAccountsPayable(session) });
  } catch (error) {
    const response = financeErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = accountPayableCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados da conta a pagar inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      { payable: await createAccountPayable(session, parsed.data) },
      { status: 201 },
    );
  } catch (error) {
    const response = financeErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
