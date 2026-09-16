import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import { reportPeriodSchema } from "@/modules/reports/schema";
import { getSellerProfile, SellerNotFoundError } from "@/modules/sellers/service";

type RouteContext = { params: Promise<{ membershipId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const url = new URL(request.url);
  const parsed = reportPeriodSchema.safeParse({
    start: url.searchParams.get("start") ?? undefined,
    end: url.searchParams.get("end") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Período inválido.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { membershipId } = await context.params;

  try {
    return NextResponse.json({ profile: await getSellerProfile(session, membershipId, parsed.data) });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof SellerNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
