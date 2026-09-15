import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { productCategoryCreateSchema } from "@/modules/products/schema";
import { createProductCategory, listProductCategories } from "@/modules/products/service";
import { productErrorResponse } from "@/modules/products/http";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    return NextResponse.json({ categories: await listProductCategories(session) });
  } catch (error) {
    const response = productErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = productCategoryCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados da categoria inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      { category: await createProductCategory(session, parsed.data) },
      { status: 201 },
    );
  } catch (error) {
    const response = productErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
