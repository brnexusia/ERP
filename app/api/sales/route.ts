import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { saleCreateSchema } from "@/modules/sales/schema";
import { createQuote, listSales } from "@/modules/sales/service";
import { saleErrorResponse } from "@/modules/sales/http";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    return NextResponse.json({ sales: await listSales(session) });
  } catch (error) {
    const response = saleErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = saleCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados do orçamento inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ sale: await createQuote(session, parsed.data) }, { status: 201 });
  } catch (error) {
    const response = saleErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
