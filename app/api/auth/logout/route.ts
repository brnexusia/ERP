import { NextResponse } from "next/server";
import { destroyCurrentSession, getSessionContext } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function POST() {
  const session = await getSessionContext();

  if (session) {
    await db.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "AUTH_LOGOUT",
        entityType: "User",
        entityId: session.userId,
      },
    });
  }

  await destroyCurrentSession();
  return NextResponse.json({ ok: true });
}
