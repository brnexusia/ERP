import { NextResponse } from "next/server";
import { getPublicCatalog } from "@/modules/products/service";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const catalog = await getPublicCatalog(token);

  if (!catalog) {
    return NextResponse.json({ error: "Catálogo não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ catalog });
}
