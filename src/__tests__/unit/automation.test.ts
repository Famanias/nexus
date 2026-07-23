import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withRetry } from '@/lib/automation/retry';
import { parseAutomationRequest } from '@/lib/automation/workflow-request';
import { NextRequest } from 'next/server';

describe('Automation Layer — Retry Utility (withRetry)', () => {
  it('returns result immediately on first attempt success', async () => {
    const fn = vi.fn().mockResolvedValue('success-val');
    const res = await withRetry(fn, 'test-label', { maxRetries: 3, baseDelayMs: 5 });
    expect(res.result).toBe('success-val');
    expect(res.retries).toBe(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on retry', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient failure'))
      .mockResolvedValueOnce('retry-success');

    const res = await withRetry(fn, 'test-label', { maxRetries: 3, baseDelayMs: 5 });
    expect(res.result).toBe('retry-success');
    expect(res.retries).toBe(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws last error when maxRetries is exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));

    await expect(
      withRetry(fn, 'test-label', { maxRetries: 2, baseDelayMs: 5 })
    ).rejects.toThrow('persistent failure');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('Automation Layer — Workflow Request Parser (parseAutomationRequest)', () => {
  const originalApiKey = process.env.N8N_API_KEY;

  beforeEach(() => {
    process.env.N8N_API_KEY = 'secret-test-key-123';
  });

  afterEach(() => {
    process.env.N8N_API_KEY = originalApiKey;
  });

  it('returns 401 Unauthorized if X-Automation-Key is missing or wrong', async () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'X-Automation-Key': 'invalid-key' },
      body: JSON.stringify({ id: 'evt-1', event: 'test', payload: {} }),
    });

    const res = await parseAutomationRequest(req);
    expect(res).not.toHaveProperty('id');
    const json = await (res as Response).json();
    expect(json.error).toBe('Unauthorized');
    expect((res as Response).status).toBe(401);
  });

  it('returns 400 if envelope is missing required fields', async () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'X-Automation-Key': 'secret-test-key-123' },
      body: JSON.stringify({ id: 'evt-1' }), // Missing event and payload
    });

    const res = await parseAutomationRequest(req);
    const json = await (res as Response).json();
    expect((res as Response).status).toBe(400);
    expect(json.error).toContain('missing required envelope fields');
  });

  it('returns 400 if required payload fields are missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'X-Automation-Key': 'secret-test-key-123' },
      body: JSON.stringify({
        id: 'evt-1',
        event: 'user.created',
        payload: { userId: 'u-1' }, // missing email
      }),
    });

    type Payload = { userId: string; email: string };
    const res = await parseAutomationRequest<Payload>(req, ['userId', 'email']);
    const json = await (res as Response).json();
    expect((res as Response).status).toBe(400);
    expect(json.error).toBe('Invalid automation event payload');
    expect(json.missing).toContain('email');
  });

  it('returns parsed event object when envelope and payload are valid', async () => {
    const validBody = {
      id: 'evt-100',
      event: 'user.created',
      timestamp: '2026-07-23T12:00:00Z',
      payload: { userId: 'u-1', email: 'user@example.com' },
    };

    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'X-Automation-Key': 'secret-test-key-123' },
      body: JSON.stringify(validBody),
    });

    type Payload = { userId: string; email: string };
    const res = await parseAutomationRequest<Payload>(req, ['userId', 'email']);
    expect(res).toHaveProperty('id', 'evt-100');
    expect(res).toHaveProperty('event', 'user.created');
  });
});
