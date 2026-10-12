import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { assertPermission, PermissionDeniedError } from "@/lib/auth/permissions";

type Provider = "cep" | "cnpj";
const digits = (text: string) => text.replace(/\D/g, "");

export async function GET(request: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try { assertPermission(session.role, "clients:read"); }
  catch (error) {
    if (error instanceof PermissionDeniedError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }

  const url = new URL(request.url);
  const provider = url.searchParams.get("type") as Provider | null;
  const value = digits(url.searchParams.get("value") ?? "");
  if (!((provider === "cep" && value.length === 8) || (provider === "cnpj" && value.length === 14))) {
    return NextResponse.json({ error: "CEP ou CNPJ inválido." }, { status: 400 });
  }

  // Fixed provider hosts, numeric-only paths, no caller-supplied URL or token.
  const upstream = provider === "cep"
    ? `https://viacep.com.br/ws/${value}/json/`
    : `https://brasilapi.com.br/api/cnpj/v1/${value}`;
  try {
    const response = await fetch(upstream, {
      signal: AbortSignal.timeout(4500),
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return NextResponse.json({ error: "Consulta indisponível. Preencha manualmente." }, { status: 502 });
    const body = await response.json();
    if (!body || typeof body !== "object" || body.erro) {
      return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
    }
    if (provider === "cep") {
      return NextResponse.json({
        address: {
          postalCode: value,
          street: String(body.logradouro ?? "").slice(0, 200),
          district: String(body.bairro ?? "").slice(0, 120),
          city: String(body.localidade ?? "").slice(0, 120),
          state: String(body.uf ?? "").slice(0, 2),
        },
      });
    }
    return NextResponse.json({
      business: {
        name: String(body.razao_social ?? "").slice(0, 200),
        email: String(body.email ?? "").slice(0, 254),
        address: {
          postalCode: digits(String(body.cep ?? "")).slice(0, 8),
          street: String(body.logradouro ?? "").slice(0, 200),
          number: String(body.numero ?? "").slice(0, 30),
          district: String(body.bairro ?? "").slice(0, 120),
          city: String(body.municipio ?? "").slice(0, 120),
          state: String(body.uf ?? "").slice(0, 2),
        },
      },
    });
  } catch {
    return NextResponse.json({ error: "Serviço de consulta indisponível. Preencha manualmente." }, { status: 502 });
  }
}
