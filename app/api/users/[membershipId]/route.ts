import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { organizationUserRoleUpdateSchema } from "@/modules/users/schema";
import {
  removeOrganizationUser,
  updateOrganizationUserRole,
} from "@/modules/users/service";
import { organizationUserErrorResponse } from "@/modules/users/http";

type RouteContext = { params: Promise<{ membershipId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { membershipId } = await context.params;
  const parsed = organizationUserRoleUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Papel do usuário inválido.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ user: await updateOrganizationUserRole(session, membershipId, parsed.data) });
  } catch (error) {
    const response = organizationUserErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { membershipId } = await context.params;

  try {
    return NextResponse.json({ result: await removeOrganizationUser(session, membershipId) });
  } catch (error) {
    const response = organizationUserErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
