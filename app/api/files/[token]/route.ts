import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import {
  assertStoredFileReadPermission,
  FileStorageNotFoundError,
  readStoredFile,
  removeStoredFile,
} from "@/modules/storage/service";
import { fileStorageErrorResponse } from "@/modules/storage/http";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { token } = await context.params;

  try {
    const file = await readStoredFile(token);
    if (file.organizationId !== session.organizationId) throw new FileStorageNotFoundError();
    assertStoredFileReadPermission(session.role, file.purpose);

    return new Response(file.data, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.data.byteLength),
        "Content-Disposition": `${file.disposition}; filename="${file.storedName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const response = fileStorageErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { token } = await context.params;

  try {
    return NextResponse.json({ result: await removeStoredFile(session, token) });
  } catch (error) {
    const response = fileStorageErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
