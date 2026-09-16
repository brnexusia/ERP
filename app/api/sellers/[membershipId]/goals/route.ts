import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createSellerGoalSchema } from "@/modules/sellers/goal-schema";
import { sellerGoalErrorResponse } from "@/modules/sellers/goal-http";
import { createSellerGoal, listSellerGoalsWithProgress } from "@/modules/sellers/goal-service";

type RouteContext = { params: Promise<{ membershipId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { membershipId } = await context.params;
  try {
    return NextResponse.json({ goals: await listSellerGoalsWithProgress(session, membershipId) });
  } catch (error) {
    const response = sellerGoalErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = createSellerGoalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados da meta inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { membershipId } = await context.params;
  try {
    const goal = await createSellerGoal(session, membershipId, parsed.data);
    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    const response = sellerGoalErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
