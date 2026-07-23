import { describe, it, expect, beforeEach } from 'vitest';
import { enqueueEvent, dequeueEvent, pushDLQ } from '@/lib/redis/client';

describe('Upstash Redis & In-Memory Fallback Queue', () => {
  beforeEach(async () => {
    // Drain memory queue
    while (await dequeueEvent('test-queue')) {
      // empty loop
    }
    while (await dequeueEvent('automation:dlq')) {
      // empty loop
    }
  });

  it('enqueues and dequeues items in FIFO order', async () => {
    await enqueueEvent('test-queue', { id: 1, name: 'First' });
    await enqueueEvent('test-queue', { id: 2, name: 'Second' });

    const item1 = await dequeueEvent<{ id: number; name: string }>('test-queue');
    expect(item1?.id).toBe(1);
    expect(item1?.name).toBe('First');

    const item2 = await dequeueEvent<{ id: number; name: string }>('test-queue');
    expect(item2?.id).toBe(2);
    expect(item2?.name).toBe('Second');

    const empty = await dequeueEvent('test-queue');
    expect(empty).toBeNull();
  });

  it('pushes failed payloads to the Dead-Letter Queue (DLQ)', async () => {
    await pushDLQ({ eventId: 'evt-999' }, 'Workflow execution timed out');

    const dlqItem = await dequeueEvent<{ failedAt: string; error: string; event: { eventId: string } }>('automation:dlq');
    expect(dlqItem).not.toBeNull();
    expect(dlqItem?.error).toBe('Workflow execution timed out');
    expect(dlqItem?.event?.eventId).toBe('evt-999');
  });
});
