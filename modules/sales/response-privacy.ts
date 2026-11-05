import type { MembershipRole } from "@prisma/client";

const financeRateRoles = new Set<MembershipRole>(["OWNER", "ADMIN", "MANAGER", "FINANCE"]);
const privateRateKeys = new Set(["commissionPercent", "sellerCommissionRate", "representativeRate"]);

/**
 * HTTP-only redaction for authenticated non-financial roles. Services keep
 * complete records for order/payment accounting, but public JSON responses
 * cannot expose the commission percentage through nested sale relations.
 */
export function redactCommercialRates<T>(role: MembershipRole, payload: T): T {
  if (financeRateRoles.has(role)) return payload;

  function walk(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(walk);
    if (value === null || typeof value !== "object") return value;
    // Prisma.Decimal, Date and other non-plain scalar objects preserve their
    // JSON serialization. Only traverse response records and regular arrays.
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !privateRateKeys.has(key))
        .map(([key, nested]) => [key, walk(nested)]),
    );
  }
  return walk(payload) as T;
}
