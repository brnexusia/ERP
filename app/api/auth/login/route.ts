import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { organization: { status: "ACTIVE" } },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  if (!user || user.status !== "ACTIVE" || !user.passwordHash || user.memberships.length === 0) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  const validPassword = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!validPassword) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  const organizationId = user.memberships[0].organizationId;
  await createSession(user.id, organizationId);

  await db.auditLog.create({
    data: {
      organizationId,
      userId: user.id,
      action: "AUTH_LOGIN",
      entityType: "User",
      entityId: user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
