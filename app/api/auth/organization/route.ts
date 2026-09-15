import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, switchActiveOrganization } from "@/lib/auth/session";
import { db } from "@/lib/db";

const schema = z.object({
  organizationId: z.string().min(1),
});

export async function POST(request: Request) {
  const current = await getSessionContext();

  if (!current) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Empresa inválida." }, { status: 400 });
  }

  try {
    await switchActiveOrganization(parsed.data.organizationId);

    await db.auditLog.create({
      data: {
        organizationId: parsed.data.organizationId,
        userId: current.userId,
        action: "ORGANIZATION_SWITCH",
        entityType: "Organization",
        entityId: parsed.data.organizationId,
        metadata: {
          fromOrganizationId: current.organizationId,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Acesso não autorizado para esta empresa." }, { status: 403 });
  }
}
