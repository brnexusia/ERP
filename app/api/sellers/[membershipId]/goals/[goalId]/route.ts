import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { updateSellerGoalSchema } from "@/modules/sellers/goal-schema";
import { sellerGoalErrorResponse } from "@/modules/sellers/goal-http";
import { deleteSellerGoal, updateSellerGoal } from "@/modules/sellers/goal-service";

type RouteContext = { params: Promise<{ membershipId: string; goalId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = updateSellerGoalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados da meta inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { membershipId, goalId } = await context.params;
  try {
    return NextResponse.json({ goal: await updateSellerGoal(session, membershipId, goalId, parsed.data) });
  } catch (error) {
    const response = sellerGoalErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { membershipId, goalId } = await context.params;
  try {
    return NextResponse.json({ deleted: await deleteSellerGoal(session, membershipId, goalId) });
  } catch (error) {
    const response = sellerGoalErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
