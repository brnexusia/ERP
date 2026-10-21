import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/session";
import { customerServiceErrorResponse } from "@/modules/customer-service/http";
import { listOrganizationSupportRecords } from "@/modules/customer-service/service";

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  kind: z.enum(["ATTENDANCE", "AFTER_SALES", "COMPLAINT", "SAC"]).optional(),
  search: z.string().trim().max(120).optional(),
  clientId: z.string().cuid().optional(),
});

export async function GET(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const parsed = searchSchema.safeParse({
    page: params.get("page") ?? undefined,
    kind: params.get("kind") || undefined,
    search: params.get("search") || undefined,
    clientId: params.get("clientId") || undefined,
  });
  if (!parsed.success) return NextResponse.json({
    error: "Filtros de atendimento inválidos.", details: parsed.error.flatten(),
  }, { status: 400 });
  try {
    return NextResponse.json(await listOrganizationSupportRecords(session, parsed.data));
  } catch (error) {
    const response = customerServiceErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
