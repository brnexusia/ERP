import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { organizationUserCreateSchema } from "@/modules/users/schema";
import {
  createOrganizationUser,
  listOrganizationUsers,
} from "@/modules/users/service";
import { organizationUserErrorResponse } from "@/modules/users/http";

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    return NextResponse.json({ users: await listOrganizationUsers(session) });
  } catch (error) {
    const response = organizationUserErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsed = organizationUserCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados do usuário inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      { user: await createOrganizationUser(session, parsed.data) },
      { status: 201 },
    );
  } catch (error) {
    const response = organizationUserErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
