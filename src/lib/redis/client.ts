import { Redis } from '@upstash/redis';

let redisInstance: Redis | null = null;

/**
 * Initializes and returns the singleton Upstash Redis client.
 * Returns null if Redis credentials are missing in development.
 */
export function getRedisClient(): Redis | null {
  if (redisInstance) return redisInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Redis] ERROR: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured in production.');
    }
    return null;
  }

  redisInstance = new Redis({ url, token });
  return redisInstance;
}

// In-memory fallback queue for local development when Redis is unconfigured
const inMemoryQueues = new Map<string, string[]>();

/**
 * Pushes an event payload to a specified Redis queue (RPUSH).
 */
export async function enqueueEvent(queueName: string, payload: unknown): Promise<boolean> {
  const redis = getRedisClient();
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);

  if (!redis) {
    const list = inMemoryQueues.get(queueName) ?? [];
    list.push(serialized);
    inMemoryQueues.set(queueName, list);
    return true;
  }

  try {
    await redis.rpush(queueName, serialized);
    return true;
  } catch (err) {
    console.error(`[Redis] Failed to enqueue event to ${queueName}:`, err);
    return false;
  }
}

/**
 * Pops an event payload from a specified Redis queue (LPOP).
 */
export async function dequeueEvent<T = unknown>(queueName: string): Promise<T | null> {
  const redis = getRedisClient();

  if (!redis) {
    const list = inMemoryQueues.get(queueName) ?? [];
    const item = list.shift();
    if (!item) return null;
    try {
      return JSON.parse(item) as T;
    } catch {
      return item as unknown as T;
    }
  }

  try {
    const item = await redis.lpop<string>(queueName);
    if (!item) return null;
    return typeof item === 'string' ? (JSON.parse(item) as T) : (item as T);
  } catch (err) {
    console.error(`[Redis] Failed to dequeue event from ${queueName}:`, err);
    return null;
  }
}

/**
 * Pushes a failed event execution payload to the Dead-Letter Queue (DLQ).
 */
export async function pushDLQ(payload: unknown, errorMessage: string): Promise<boolean> {
  const dlqPayload = {
    failedAt: new Date().toISOString(),
    error: errorMessage,
    event: payload,
  };
  return enqueueEvent('automation:dlq', dlqPayload);
}
