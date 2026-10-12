import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/session";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import { updateSellerCommission } from "@/modules/commissions/service";

const percent = z.union([z.string(), z.number()])
  .transform((value) => String(value).trim().replace(",", "."))
  .refine((value) => /^(?:100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)$/.test(value));

const commissionSchema = z.object({ percent: percent.nullable() });

type Context = { params: Promise<{ membershipId: string }> };
export async function PATCH(request: Request, context: Context) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = commissionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Percentual inválido (0 a 100)." }, { status: 400 });
  try {
    const { membershipId } = await context.params;
    const seller = await updateSellerCommission(session, membershipId, parsed.data.percent);
    return seller ? NextResponse.json({ seller }) : NextResponse.json({ error: "Vendedora não encontrada." }, { status: 404 });
  } catch (error) {
    if (error instanceof PermissionDeniedError)
      return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
}
