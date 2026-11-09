/**
 * Controlled product release. The first two approved phases remain available.
 * Later modules are opt-in, default DENIED in all environments.
 * Do not read a client-supplied flag to authorize these routes.
 */
export type LaterModule = 3 | 4;

export function isModuleReleased(moduleNumber: LaterModule): boolean {
  return moduleNumber === 3
    ? process.env.ERP_ENABLE_MODULE_3 === "true"
    : process.env.ERP_ENABLE_MODULE_4 === "true";
}

/**
 * Route-level guard, separate from tenant RBAC. A request must pass BOTH.
 * Shared read-only dependencies remain available to stages 1/2:
 * - GET /api/products => minimal product lookup for quote creation
 * - GET /api/integrations => VaxChat/VaxLab status for clients/settings
 * - stage-2 collection flows under finance/receivables and manual-receivables.
 */
export function routeModule(pathname: string, method: string): LaterModule | null {
  const verb = method.toUpperCase();
  if (/^\/(products|catalog)(?:\/|$)/.test(pathname)) return 3;
  if (/^\/(finance|integrations|promotions)(?:\/|$)/.test(pathname)) return 4;

  if (pathname === "/api/products" && (verb === "GET" || verb === "HEAD")) return null;
  if (/^\/api\/(products|product-categories|inventory|catalog|catalog-share)(?:\/|$)/.test(pathname)) return 3;
  if (/^\/api\/reports\/products(?:\/|$)/.test(pathname)) return 3;

  if (/^\/api\/finance(?:\/|$)/.test(pathname)) {
    if (/^\/api\/finance\/(receivables|manual-receivables|cheque-returns)(?:\/|$)/.test(pathname)) return null;
    return 4;
  }
  if (pathname === "/api/integrations" && (verb === "GET" || verb === "HEAD")) return null;
  if (/^\/api\/(integrations|promotions)(?:\/|$)/.test(pathname)) return 4;
  return null;
}

export function blockedModule(pathname: string, method: string): LaterModule | null {
  const moduleNumber = routeModule(pathname, method);
  return moduleNumber && !isModuleReleased(moduleNumber) ? moduleNumber : null;
}
