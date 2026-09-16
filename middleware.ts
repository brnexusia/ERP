import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function configuredOrigin(request: NextRequest): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // APP_URL inválida não deve desativar a proteção; usa a origem observada da requisição.
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "");

  return host ? `${protocol}://${host}` : request.nextUrl.origin;
}

export function middleware(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) {
    return NextResponse.next();
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return NextResponse.json(
      { error: "Requisição cross-site bloqueada." },
      { status: 403 },
    );
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== configuredOrigin(request)) {
    return NextResponse.json(
      { error: "Origem da requisição não autorizada." },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
