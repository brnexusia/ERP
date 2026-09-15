import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { stockUpdateSchema } from "@/modules/products/schema";
import { updateProductStock } from "@/modules/products/service";
import { productErrorResponse } from "@/modules/products/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  const parsed = stockUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Atualização de estoque inválida.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ inventory: await updateProductStock(session, id, parsed.data) });
  } catch (error) {
    const response = productErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
