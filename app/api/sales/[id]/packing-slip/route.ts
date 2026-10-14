import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createSalePackingSlip } from "@/modules/sales/packing-slip";
import { saleErrorResponse } from "@/modules/sales/http";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await context.params;
  try {
    const buffer = await createSalePackingSlip(session, id);
    const bytes = new Uint8Array(buffer.length);
    bytes.set(buffer);
    return new NextResponse(bytes.buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="romaneio-${id.slice(0, 12)}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const response = saleErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
