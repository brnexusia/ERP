import { constants } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

function storageRoot(): string {
  return path.resolve(process.env.STORAGE_ROOT ?? path.join(process.cwd(), "storage"));
}

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;

    const root = storageRoot();
    await mkdir(root, { recursive: true });
    await access(root, constants.R_OK | constants.W_OK);

    return NextResponse.json({
      status: "ok",
      database: "ok",
      storage: "ok",
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        database: "unavailable_or_unverified",
        storage: "unavailable_or_unverified",
      },
      { status: 503 },
    );
  }
}
