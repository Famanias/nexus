// ============================================================
// Automation — Client-side Event Helper
// ============================================================
// Provides a simple API for client components to emit
// domain events via the authenticated server endpoint.
// This is fire-and-forget: errors are logged, never thrown.
// ============================================================

import type { AutomationEventName } from '@/lib/automation/types';

/**
 * Emit an automation event from a client component.
 *
 * Usage:
 * ```ts
 * import { emitClientEvent } from '@/lib/automation/client-emitter';
 *
 * // After a successful clock-in:
 * emitClientEvent('attendance.clocked_in', { userId, clockIn, date });
 * ```
 *
 * This function is fire-and-forget:
 * - It never throws
 * - It never blocks the UI
 * - Failures are silently logged to the console
 */
export async function emitClientEvent(
  event: AutomationEventName,
  payload: Record<string, unknown> = {}
): Promise<void> {
  try {
    await fetch('/api/automation/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, payload }),
    });
  } catch (err) {
    console.warn(`[Automation] Failed to emit ${event}:`, err);
  }
}
