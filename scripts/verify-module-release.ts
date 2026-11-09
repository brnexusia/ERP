import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { blockedModule, isModuleReleased, routeModule } from "../lib/module-release";
import { middleware } from "../middleware";

const save3 = process.env.ERP_ENABLE_MODULE_3;
const save4 = process.env.ERP_ENABLE_MODULE_4;
try {
  delete process.env.ERP_ENABLE_MODULE_3;
  delete process.env.ERP_ENABLE_MODULE_4;
  assert.equal(isModuleReleased(3), false);
  assert.equal(isModuleReleased(4), false);
  const blocked: Array<[string, string, number]> = [
    ["/products", "GET", 3], ["/products/intelligence", "GET", 3],
    ["/catalog/token", "GET", 3], ["/api/catalog/token", "GET", 3],
    ["/api/catalog-share", "POST", 3], ["/api/products", "POST", 3],
    ["/api/products/id", "GET", 3], ["/api/products/id", "PATCH", 3],
    ["/api/products/id/stock", "POST", 3], ["/api/product-categories", "GET", 3],
    ["/api/reports/products/abc-distribution", "GET", 3],
    ["/api/inventory/low-stock", "GET", 3],
    ["/finance", "GET", 4], ["/integrations", "GET", 4],
    ["/promotions", "GET", 4], ["/api/finance/reports", "GET", 4],
    ["/api/finance/payables", "POST", 4], ["/api/finance/bank-entries", "GET", 4],
    ["/api/promotions", "GET", 4], ["/api/promotions/id", "PATCH", 4],
    ["/api/integrations", "POST", 4],
  ];
  for (const [path, verb, moduleNumber] of blocked) {
    assert.equal(blockedModule(path, verb), moduleNumber, path);
    const res = middleware(new NextRequest("http://localhost:3000" + path, { method: verb }));
    assert.equal(res.status, path.startsWith("/api/") ? 403 : 307, path);
  }
  const allowed: Array<[string, string]> = [
    ["/", "GET"], ["/clients", "GET"], ["/clients/settings", "GET"],
    ["/sales", "GET"], ["/reports", "GET"], ["/commissions", "GET"],
    ["/support", "GET"], ["/receivables", "GET"], ["/alerts", "GET"],
    ["/api/clients", "GET"], ["/api/sales", "POST"], ["/api/reports/commercial", "GET"],
    ["/api/products", "GET"], ["/api/integrations", "GET"],
    ["/api/finance/receivables", "GET"], ["/api/finance/manual-receivables", "POST"],
    ["/api/finance/manual-receivables/id/receipts", "POST"],
    ["/api/files", "POST"], ["/api/dashboard", "GET"],
  ];
  for (const [path, verb] of allowed) {
    assert.equal(blockedModule(path, verb), null, path);
    const res = middleware(new NextRequest("http://localhost:3000" + path, { method: verb }));
    assert.equal(res.status, 200, path);
  }
  process.env.ERP_ENABLE_MODULE_3 = "true";
  process.env.ERP_ENABLE_MODULE_4 = "true";
  for (const [path, verb] of blocked) {
    assert.equal(blockedModule(path, verb), null, path + " opt-in");
  }
  assert.equal(routeModule("/api/products", "POST"), 3);
  assert.equal(routeModule("/api/products", "GET"), null);
  console.log("Release gate 1/2 liberados, 3/4 bloqueados por padrão, exceções e liberação via ambiente: OK");
} finally {
  if (save3 === undefined) delete process.env.ERP_ENABLE_MODULE_3;
  else process.env.ERP_ENABLE_MODULE_3 = save3;
  if (save4 === undefined) delete process.env.ERP_ENABLE_MODULE_4;
  else process.env.ERP_ENABLE_MODULE_4 = save4;
}
