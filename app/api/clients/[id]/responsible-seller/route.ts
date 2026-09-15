import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { clientSellerAssignmentSchema } from "@/modules/sales/schema";
import { assignResponsibleSeller } from "@/modules/sales/service";
import { saleErrorResponse } from "@/modules/sales/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  const parsed = clientSellerAssignmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Vendedora responsável inválida.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ client: await assignResponsibleSeller(session, id, parsed.data) });
  } catch (error) {
    const response = saleErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
