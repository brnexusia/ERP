import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback);

async function hashPassword(password) {
  if (password.length < 10) {
    throw new Error("SEED_ADMIN_PASSWORD deve ter pelo menos 10 caracteres.");
  }

  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${Buffer.from(derivedKey).toString("hex")}`;
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const organizationName = process.env.SEED_ORG_NAME?.trim();
  const organizationSlug = process.env.SEED_ORG_SLUG?.trim().toLowerCase();

  if (!email || !password || !organizationName || !organizationSlug) {
    throw new Error(
      "Defina SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ORG_NAME e SEED_ORG_SLUG antes de executar o seed.",
    );
  }

  const passwordHash = await hashPassword(password);

  const organization = await prisma.organization.upsert({
    where: { slug: organizationSlug },
    update: { name: organizationName, status: "ACTIVE" },
    create: {
      name: organizationName,
      slug: organizationSlug,
      status: "ACTIVE",
    },
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: "Administrador",
      passwordHash,
      status: "ACTIVE",
    },
    create: {
      email,
      name: "Administrador",
      passwordHash,
      status: "ACTIVE",
    },
  });

  await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id,
      },
    },
    update: { role: "OWNER" },
    create: {
      organizationId: organization.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  console.log(`Seed concluído para ${organization.slug} / ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
