import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/session";
import { productErrorResponse } from "@/modules/products/http";
import { attachProductImage } from "@/modules/products/media";
import { fileStorageErrorResponse } from "@/modules/storage/http";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const variationSchema = z.string().trim().min(1).max(120).nullable().optional();

export async function POST(request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulário de imagem inválido." }, { status: 400 });
  }

  const fileValue = formData.get("file");
  if (!(fileValue instanceof File)) {
    return NextResponse.json({ error: "Imagem não informada." }, { status: 400 });
  }

  const rawVariation = formData.get("variation");
  const parsedVariation = variationSchema.safeParse(
    typeof rawVariation === "string" && rawVariation.trim() ? rawVariation : null,
  );
  if (!parsedVariation.success) {
    return NextResponse.json(
      { error: "Variação da imagem inválida.", details: parsedVariation.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await attachProductImage(session, id, fileValue, parsedVariation.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const productResponse = productErrorResponse(error);
    if (productResponse) return productResponse;
    const storageResponse = fileStorageErrorResponse(error);
    if (storageResponse) return storageResponse;
    throw error;
  }
}
