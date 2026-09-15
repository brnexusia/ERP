import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { productUpdateSchema } from "@/modules/products/schema";
import { getProduct, updateProduct } from "@/modules/products/service";
import { productErrorResponse } from "@/modules/products/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  try {
    const product = await getProduct(session, id);
    if (!product) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    return NextResponse.json({ product });
  } catch (error) {
    const response = productErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  const parsed = productUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Atualização de produto inválida.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ product: await updateProduct(session, id, parsed.data) });
  } catch (error) {
    const response = productErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
