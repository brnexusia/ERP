import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { listLowStockProducts } from "@/modules/products/service";
import { productErrorResponse } from "@/modules/products/http";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    return NextResponse.json({ products: await listLowStockProducts(session) });
  } catch (error) {
    const response = productErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
