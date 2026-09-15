import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { productCreateSchema } from "@/modules/products/schema";
import { createProduct, listProducts } from "@/modules/products/service";
import { productErrorResponse } from "@/modules/products/http";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    return NextResponse.json({ products: await listProducts(session) });
  } catch (error) {
    const response = productErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = productCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados do produto inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ product: await createProduct(session, parsed.data) }, { status: 201 });
  } catch (error) {
    const response = productErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
