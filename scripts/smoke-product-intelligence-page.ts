import assert from "node:assert/strict";
import { db } from "../lib/db";

const origin = process.env.APP_URL ?? "http://127.0.0.1:3000";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Credenciais da CI ausentes.");

  const unauthorized = await fetch(origin + "/products/intelligence", { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(unauthorized.status));

  const login = await fetch(origin + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie);
  const authed = (path: string) => fetch(origin + path, { headers: { Cookie: cookie } });
  try {
    const page = await authed("/products/intelligence");
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.ok(html.includes("Inteligência de produtos"), "Tela de análise deve existir.");
    assert.ok(html.includes("Início do período"), "Critérios explícitos devem estar presentes na tela.");

    const params = new URLSearchParams({
      start: "2026-01-01T00:00:00.000Z", end: "2026-12-31T23:59:59.000Z",
    });
    const metrics = await authed("/api/reports/products?" + params);
    assert.equal(metrics.status, 200);
    assert.ok(Array.isArray((await metrics.json()).report.products));
    params.set("metric", "REVENUE");
    const abc = await authed("/api/reports/products/abc-distribution?" + params);
    assert.equal(abc.status, 200);
    const distribution = (await abc.json()).report;
    assert.equal(distribution.classificationStatus, "PENDING_THRESHOLDS");
    assert.ok(distribution.products.every((row: { abcClass: string }) => row.abcClass === "PENDING_THRESHOLDS"));
    params.set("threshold", "0");
    const low = await authed("/api/reports/products/low-output?" + params);
    assert.equal(low.status, 200);
    assert.equal((await low.json()).report.criteria.source, "EXPLICIT_REQUEST");
    console.log("✓ Painel privado e relatório factual do estoque");
    console.log("✓ Distribuição ABC sem faixas inventadas e baixa saída por limiar explícito");
  } finally {
    const admin = await db.user.findUnique({ where: { email } });
    if (admin) await db.session.deleteMany({ where: { userId: admin.id } });
    await db.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
