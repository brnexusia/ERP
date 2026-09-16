import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/session";
import { attachCarrierDeliveryProof } from "@/modules/customer-service/media";
import { customerServiceErrorResponse } from "@/modules/customer-service/http";
import { fileStorageErrorResponse } from "@/modules/storage/http";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const proofKindSchema = z.enum(["shipment", "delivery"]);

export async function POST(request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulário de comprovante inválido." }, { status: 400 });
  }

  const fileValue = formData.get("file");
  if (!(fileValue instanceof File)) {
    return NextResponse.json({ error: "Comprovante não informado." }, { status: 400 });
  }

  const kind = proofKindSchema.safeParse(formData.get("kind"));
  if (!kind.success) {
    return NextResponse.json(
      { error: "Tipo de comprovante inválido. Use shipment ou delivery." },
      { status: 400 },
    );
  }

  try {
    const result = await attachCarrierDeliveryProof(session, id, kind.data, fileValue);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const customerResponse = customerServiceErrorResponse(error);
    if (customerResponse) return customerResponse;
    const storageResponse = fileStorageErrorResponse(error);
    if (storageResponse) return storageResponse;
    throw error;
  }
}
