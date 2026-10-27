import assert from "node:assert/strict";
import { getClientInactivityState } from "../modules/reports/inactivity";

const now = new Date("2026-10-27T12:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

const neverPurchasedOverdue = getClientInactivityState({
  createdAt: daysAgo(8), lastPurchaseAt: null, inactivityThreshold: 7, now,
});
assert.deepEqual(neverPurchasedOverdue, {
  daysWithoutPurchase: 8, inactivityAlert: true,
});

const neverPurchasedNew = getClientInactivityState({
  createdAt: daysAgo(6), lastPurchaseAt: null, inactivityThreshold: 7, now,
});
assert.deepEqual(neverPurchasedNew, {
  daysWithoutPurchase: 6, inactivityAlert: false,
});

const thresholdBoundary = getClientInactivityState({
  createdAt: daysAgo(7), lastPurchaseAt: null, inactivityThreshold: 7, now,
});
assert.equal(thresholdBoundary.inactivityAlert, true,
  "A data exata da fronteira do prazo deve alertar.");

const recentBuyer = getClientInactivityState({
  createdAt: daysAgo(100), lastPurchaseAt: daysAgo(2), inactivityThreshold: 7, now,
});
assert.deepEqual(recentBuyer, {
  daysWithoutPurchase: 2, inactivityAlert: false,
});

const unpaidOrUnconfigured = getClientInactivityState({
  createdAt: daysAgo(100), lastPurchaseAt: null, inactivityThreshold: null, now,
});
assert.equal(unpaidOrUnconfigured.inactivityAlert, false,
  "Sem configuração explícita não deve ocorrer alerta presumido.");
assert.equal(unpaidOrUnconfigured.daysWithoutPurchase, 100,
  "A idade do cadastro permanece factual mesmo sem limite configurado.");

console.log("✓ inatividade usa compra paga ou cadastro, respeita fronteira e ausência de regra.");
