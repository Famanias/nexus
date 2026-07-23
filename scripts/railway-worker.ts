// ============================================================
// Railway Background Automation Queue Worker
// ============================================================

import { dequeueEvent, pushDLQ } from '../src/lib/redis/client.js';
import { withRetry } from '../src/lib/automation/retry.js';

const QUEUE_NAME = 'automation:queue';
const POLL_INTERVAL_MS = 2000;

let isRunning = true;

/**
 * Handle OS signals for graceful worker shutdown.
 */
function handleShutdown(signal: string) {
  console.log(`[Railway Worker] Received ${signal}. Shutting down worker gracefully...`);
  isRunning = false;
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

/**
 * Dispatches a dequeued event to the n8n automation webhook gateway.
 */
async function dispatchToAutomationGateway(event: unknown): Promise<void> {
  const gatewayUrl = process.env.N8N_WEBHOOK_URL || process.env.AUTOMATION_WEBHOOK_URL;
  const apiKey = process.env.N8N_API_KEY;

  if (!gatewayUrl) {
    throw new Error('[Railway Worker] Automation gateway URL is unconfigured (N8N_WEBHOOK_URL).');
  }

  const response = await fetch(gatewayUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Automation-Key': apiKey || '',
    },
    body: typeof event === 'string' ? event : JSON.stringify(event),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown gateway error');
    throw new Error(`Automation gateway HTTP ${response.status}: ${errorText}`);
  }
}

/**
 * Main event processing loop.
 */
async function workerLoop() {
  console.log(`[Railway Worker] Worker process started. Listening on queue '${QUEUE_NAME}'...`);

  while (isRunning) {
    try {
      const event = await dequeueEvent(QUEUE_NAME);

      if (event) {
        console.log(`[Railway Worker] Dequeued event from '${QUEUE_NAME}'. Processing...`);
        try {
          await withRetry(
            () => dispatchToAutomationGateway(event),
            'railway-worker-dispatch',
            { maxRetries: 3, baseDelayMs: 1000 }
          );
          console.log('[Railway Worker] Event dispatched successfully.');
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error('[Railway Worker] Dispatch failed after retries. Moving payload to DLQ...', errorMsg);
          await pushDLQ(event, errorMsg);
        }
      }
    } catch (err: unknown) {
      console.error('[Railway Worker] Unexpected error in worker loop:', err);
    }

    if (isRunning) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  console.log('[Railway Worker] Worker loop terminated cleanly.');
  process.exit(0);
}

// Execute worker loop if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  workerLoop();
}

export { workerLoop, dispatchToAutomationGateway };
