import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const SESSION_COOKIE = "erp_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, organizationId: string) {
  const membership = await db.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    include: {
      user: true,
      organization: true,
    },
  });

  if (
    !membership ||
    membership.user.status !== "ACTIVE" ||
    membership.organization.status !== "ACTIVE"
  ) {
    throw new Error("Acesso não autorizado para esta empresa.");
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({
    data: {
      tokenHash,
      userId,
      activeOrganizationId: organizationId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function getSessionContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: {
      user: true,
      activeOrganization: true,
    },
  });

  if (
    !session ||
    session.expiresAt <= new Date() ||
    session.user.status !== "ACTIVE" ||
    session.activeOrganization.status !== "ACTIVE"
  ) {
    return null;
  }

  const membership = await db.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: session.activeOrganizationId,
        userId: session.userId,
      },
    },
  });

  if (!membership) {
    return null;
  }

  return {
    sessionId: session.id,
    userId: session.userId,
    userName: session.user.name,
    userEmail: session.user.email,
    organizationId: session.activeOrganizationId,
    organizationName: session.activeOrganization.name,
    organizationSlug: session.activeOrganization.slug,
    role: membership.role,
  };
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function switchActiveOrganization(organizationId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    throw new Error("Sessão não encontrada.");
  }

  const tokenHash = hashSessionToken(token);
  const session = await db.session.findUnique({ where: { tokenHash } });

  if (!session || session.expiresAt <= new Date()) {
    throw new Error("Sessão inválida.");
  }

  const membership = await db.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: session.userId,
      },
    },
    include: { organization: true },
  });

  if (!membership || membership.organization.status !== "ACTIVE") {
    throw new Error("Acesso não autorizado para esta empresa.");
  }

  const rotatedToken = randomBytes(32).toString("base64url");
  const rotatedTokenHash = hashSessionToken(rotatedToken);

  await db.session.update({
    where: { id: session.id },
    data: {
      tokenHash: rotatedTokenHash,
      activeOrganizationId: organizationId,
      lastSeenAt: new Date(),
    },
  });

  cookieStore.set(SESSION_COOKIE, rotatedToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: session.expiresAt,
  });
}
