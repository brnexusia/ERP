import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { ensureCatalogShare } from "@/modules/products/service";
import { productErrorResponse } from "@/modules/products/http";

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const share = await ensureCatalogShare(session);
    const origin = new URL(request.url).origin;
    return NextResponse.json({
      catalog: {
        token: share.token,
        url: `${origin}/catalog/${share.token}`,
        apiUrl: `${origin}/api/catalog/${share.token}`,
      },
    });
  } catch (error) {
    const response = productErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
