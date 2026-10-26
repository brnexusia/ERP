import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { deletePromotionDraft } from "@/modules/promotions/service";
import { promotionErrorResponse } from "@/modules/promotions/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await context.params;
  try {
    return NextResponse.json({ draft: await deletePromotionDraft(session, id) });
  } catch (error) {
    const response = promotionErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
