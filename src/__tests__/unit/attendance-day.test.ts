import { describe, it, expect } from 'vitest';
import {
  isValidTimezone,
  resolveDay,
  getClientTimezone,
  formatTimeInZone,
} from '@/lib/attendance/day';

describe('attendance day module', () => {
  it('isValidTimezone accepts IANA names and rejects garbage', () => {
    expect(isValidTimezone('Asia/Manila')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('Mars/Olympus')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
  });

  it('resolveDay buckets a UTC instant into the client-local day', () => {
    const utcMidnight = new Date('2026-08-18T00:00:00Z');
    expect(resolveDay(utcMidnight, 'UTC').date).toBe('2026-08-18');
    expect(resolveDay(utcMidnight, 'Asia/Manila').date).toBe('2026-08-18');
    expect(resolveDay(utcMidnight, 'America/New_York').date).toBe('2026-08-17');
  });

  it('resolveDay throws on invalid or missing timezone', () => {
    expect(() => resolveDay(new Date(), 'Not/AZone')).toThrow();
    expect(() => resolveDay(new Date(), '')).toThrow();
  });

  it('getClientTimezone returns a usable timezone', () => {
    const tz = getClientTimezone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
    expect(isValidTimezone(tz)).toBe(true);
  });

  it('formatTimeInZone renders the instant in the target zone', () => {
    expect(formatTimeInZone('2026-08-18T14:30:00Z', 'Asia/Manila')).toMatch(/10:30 PM/i);
    expect(formatTimeInZone('2026-08-18T14:30:00Z', 'America/New_York')).toMatch(/10:30 AM/i);
  });

  it('formatTimeInZone throws on invalid timezone', () => {
    expect(() => formatTimeInZone('2026-08-18T14:30:00Z', 'Not/AZone')).toThrow();
  });
});