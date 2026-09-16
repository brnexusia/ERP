import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { fileUploadMetadataSchema } from "@/modules/storage/schema";
import { storeFile } from "@/modules/storage/service";
import { fileStorageErrorResponse } from "@/modules/storage/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulário de arquivo inválido." }, { status: 400 });
  }

  const fileValue = formData.get("file");
  if (!(fileValue instanceof File)) {
    return NextResponse.json({ error: "Arquivo não informado." }, { status: 400 });
  }

  const parsed = fileUploadMetadataSchema.safeParse({
    purpose: formData.get("purpose"),
    visibility: formData.get("visibility") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Metadados do arquivo inválidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const file = await storeFile(session, fileValue, parsed.data);
    return NextResponse.json({ file }, { status: 201 });
  } catch (error) {
    const response = fileStorageErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
