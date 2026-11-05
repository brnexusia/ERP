/**
 * Shared tenant-scoped inactivity calculation for alert feed and client profiles.
 *
 * A client without any paid purchase is measured from their registration date,
 * while returning lastPurchaseAt: null to distinguish them from past buyers.
 * Threshold must be explicitly configured for the tenant or client.
 */
export function getClientInactivityState(input: {
  createdAt: Date;
  lastPurchaseAt: Date | null;
  inactivityThreshold: number | null;
  now: Date;
}) {
  const anchor = input.lastPurchaseAt ?? input.createdAt;
  const daysWithoutPurchase = Math.floor(
    (input.now.getTime() - anchor.getTime()) / 86_400_000,
  );
  const inactivityAlert =
    input.inactivityThreshold !== null &&
    input.inactivityThreshold > 0 &&
    daysWithoutPurchase >= input.inactivityThreshold;
  return { daysWithoutPurchase, inactivityAlert };
}
