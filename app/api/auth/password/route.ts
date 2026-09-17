import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionContext } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10, "A nova senha deve ter pelo menos 10 caracteres."),
});

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados de senha inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, passwordHash: true, status: true },
  });
  if (!user || user.status !== "ACTIVE" || !user.passwordHash) {
    return NextResponse.json({ error: "Não foi possível alterar a senha." }, { status: 403 });
  }

  const currentPasswordValid = await verifyPassword(
    parsed.data.currentPassword,
    user.passwordHash,
  );
  if (!currentPasswordValid) {
    return NextResponse.json({ error: "Senha atual inválida." }, { status: 400 });
  }

  const reusesCurrentPassword = await verifyPassword(
    parsed.data.newPassword,
    user.passwordHash,
  );
  if (reusesCurrentPassword) {
    return NextResponse.json(
      { error: "A nova senha deve ser diferente da senha atual." },
      { status: 422 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  const revokedSessions = await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    const revoked = await tx.session.deleteMany({
      where: {
        userId: user.id,
        id: { not: session.sessionId },
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: user.id,
        action: "AUTH_PASSWORD_CHANGE",
        entityType: "User",
        entityId: user.id,
        metadata: {
          revokedOtherSessions: revoked.count,
        },
      },
    });

    return revoked.count;
  });

  return NextResponse.json({
    ok: true,
    revokedOtherSessions: revokedSessions,
  });
}
