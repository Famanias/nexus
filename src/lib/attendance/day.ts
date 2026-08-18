/**
 * Attendance-day module.
 *
 * Owns "which calendar day a clock event belongs to" and how an OJT's
 * local clock time is rendered. The day is always derived from the
 * server's own clock plus the OJT's computer timezone so clients cannot
 * choose their bucket date.
 */

export function isValidTimezone(timezone: string): boolean {
  if (typeof timezone !== 'string' || timezone.trim() === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the attendance day (yyyy-MM-dd) for a clock moment in the given
 * timezone. The moment is `now` from the server clock; the timezone comes
 * from the clocking OJT's computer. Throws a TypeError when the timezone
 * is invalid.
 */
export function resolveDay(now: Date, timezone: string): { date: string } {
  if (!isValidTimezone(timezone)) {
    throw new TypeError(`Invalid timezone: ${timezone}`);
  }
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return { date };
}

/**
 * The clocking computer's timezone: the IANA name when available (always
 * in modern browsers), else a whole-hour Etc/GMT offset, else UTC.
 */
export function getClientTimezone(): string {
  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (resolved && isValidTimezone(resolved)) return resolved;

  const eastMinutes = -new Date().getTimezoneOffset();
  const hours = Math.abs(eastMinutes) / 60;
  if (Number.isInteger(hours)) {
    const sign = eastMinutes < 0 ? '+' : '-';
    return `Etc/GMT${sign}${hours}`;
  }
  return 'UTC';
}

/**
 * Render an instant as a local clock time in the given timezone, e.g.
 * "08:30 AM". Callers pass the timezone stored on the attendance row.
 */
export function formatTimeInZone(iso: string, timezone: string): string {
  if (!isValidTimezone(timezone)) {
    throw new TypeError(`Invalid timezone: ${timezone}`);
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}