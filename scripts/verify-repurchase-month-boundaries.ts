import assert from "node:assert/strict";
import { addUtcCalendarMonthsClamped } from "../modules/reports/calendar-months";

const test = (iso: string, expected: string) =>
  assert.equal(addUtcCalendarMonthsClamped(new Date(iso), 3).toISOString(), expected);

test("2025-08-31T12:34:56.789Z", "2025-11-30T12:34:56.789Z");
test("2024-11-30T07:00:00.000Z", "2025-02-28T07:00:00.000Z");
test("2023-11-30T07:00:00.000Z", "2024-02-29T07:00:00.000Z");
test("2024-01-31T23:59:59.999Z", "2024-04-30T23:59:59.999Z");
test("2024-02-29T09:13:14.125Z", "2024-05-29T09:13:14.125Z");
test("2026-06-15T00:00:00.000Z", "2026-09-15T00:00:00.000Z");

// Boundary of a real three-calendar-month interval: equality qualifies,
// the following millisecond does not. Raw setUTCMonth would overflow
// 31 Aug + 3 months into 1 Dec, generating a false positive.
const start = new Date("2025-08-31T12:00:00.000Z");
const cutoff = addUtcCalendarMonthsClamped(start, 3);
assert.equal(cutoff.toISOString(), "2025-11-30T12:00:00.000Z");
assert.ok(new Date("2025-11-30T12:00:00.000Z") <= cutoff);
assert.ok(new Date("2025-11-30T12:00:00.001Z") > cutoff);

console.log("✓ repurchase calendar-month cutoff handles 28/29/30/31 days and UTC time");
