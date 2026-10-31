/**
 * Adds calendar months in UTC without JavaScript Date month overflow.
 *
 * Examples:
 * 31 Aug + 3 calendar months = 30 Nov;
 * 30 Nov 2024 + 3 calendar months = 28 Feb 2025.
 * The original UTC time-of-day is preserved.
 *
 * This is used for the factual repurchase indicator only and does not
 * grant wholesale pricing or any other commercial benefit.
 */
export function addUtcCalendarMonthsClamped(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const originalDay = result.getUTCDate();

  // Set day 1 before adding months to avoid Date.setUTCMonth rollover.
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  const lastDayOfDestinationMonth = new Date(Date.UTC(
    result.getUTCFullYear(), result.getUTCMonth() + 1, 0,
  )).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDayOfDestinationMonth));
  return result;
}
