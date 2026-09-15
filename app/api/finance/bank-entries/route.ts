import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { bankStatementEntryCreateSchema } from "@/modules/finance/schema";
import { financeErrorResponse } from "@/modules/finance/http";
import {
  createBankStatementEntry,
  listBankStatementEntries,
} from "@/modules/finance/service";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    return NextResponse.json({ entries: await listBankStatementEntries(session) });
  } catch (error) {
    const response = financeErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = bankStatementEntryCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados do lançamento bancário inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      { entry: await createBankStatementEntry(session, parsed.data) },
      { status: 201 },
    );
  } catch (error) {
    const response = financeErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
