import { NextRequest, NextResponse } from "next/server";
import { blockedModule } from "./lib/module-release";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function configuredOrigin(request: NextRequest): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // APP_URL inválida não desativa o bloqueio entre origens.
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "");
  return host ? `${protocol}://${host}` : request.nextUrl.origin;
}

export function middleware(request: NextRequest) {
  // Release guard precedes CSRF and handlers. It applies to GET and write
  // methods, including direct URLs, not only navigation in the sidebar.
  const moduleNumber = blockedModule(request.nextUrl.pathname, request.method);
  if (moduleNumber) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: `Módulo ${moduleNumber} bloqueado. Disponíveis: módulos 1 e 2.` },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    const destination = new URL("/locked", request.url);
    destination.searchParams.set("module", String(moduleNumber));
    return NextResponse.redirect(destination, { status: 307, headers: { "Cache-Control": "no-store" } });
  }

  if (SAFE_METHODS.has(request.method)) return NextResponse.next();

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return NextResponse.json({ error: "Requisição cross-site bloqueada." }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== configuredOrigin(request)) {
    return NextResponse.json({ error: "Origem da requisição não autorizada." }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/products/:path*",
    "/catalog/:path*",
    "/finance/:path*",
    "/integrations/:path*",
    "/promotions/:path*",
  ],
};
