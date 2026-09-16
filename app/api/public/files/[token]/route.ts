import { NextResponse } from "next/server";
import { FileStorageNotFoundError, readStoredFile } from "@/modules/storage/service";
import { fileStorageErrorResponse } from "@/modules/storage/http";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;

  try {
    const file = await readStoredFile(token);
    if (file.visibility !== "public") throw new FileStorageNotFoundError();

    return new Response(file.data, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.data.byteLength),
        "Content-Disposition": `${file.disposition}; filename="${file.storedName}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const response = fileStorageErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
