import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { promotionDraftCreateSchema } from "@/modules/promotions/schema";
import { createPromotionDraft, listPromotionDrafts } from "@/modules/promotions/service";
import { promotionErrorResponse } from "@/modules/promotions/http";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    return NextResponse.json({ drafts: await listPromotionDrafts(session), pricingEngine: "NOT_DEFINED" });
  } catch (error) {
    const response = promotionErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = promotionDraftCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({
      error: "Registro de promoção inválido.", details: parsed.error.flatten(),
    }, { status: 400 });
  }
  try {
    return NextResponse.json({ draft: await createPromotionDraft(session, parsed.data) }, { status: 201 });
  } catch (error) {
    const response = promotionErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
