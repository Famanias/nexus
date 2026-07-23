import { NextRequest, NextResponse } from 'next/server';
import { AutomationEvent } from './types';

type ParsedAutomationRequest<T> = AutomationEvent<T>;

/**
 * Validates the N8N_API_KEY header.
 */
function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-Automation-Key');
  const expectedKey = process.env.N8N_API_KEY;
  if (!expectedKey) return false;
  return apiKey === expectedKey;
}

/**
 * Parses, validates, and types an incoming automation workflow request from n8n.
 * Replaces duplicated logic across all endpoints.
 * @param request The incoming NextRequest
 * @param expectedFields Array of required payload keys for validation
 */
export async function parseAutomationRequest<T = Record<string, unknown>>(
  request: NextRequest,
  expectedFields: (keyof T)[] = []
): Promise<ParsedAutomationRequest<T> | NextResponse> {
  // 1. Validate API Key
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Parse Body
    const body = await request.json();

    // 3. Validate Envelope Structure
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid automation envelope: body is missing or not an object' }, { status: 400 });
    }

    if (!body.id || !body.event || !body.payload) {
      return NextResponse.json({ 
        error: 'Invalid automation envelope: missing required envelope fields (id, event, payload)' 
      }, { status: 400 });
    }

    // 4. Validate Payload Fields
    const missingFields = expectedFields.filter(field => body.payload[field] === undefined || body.payload[field] === null);
    
    if (missingFields.length > 0) {
      return NextResponse.json({
        error: 'Invalid automation event payload',
        event: body.event,
        missing: missingFields
      }, { status: 400 });
    }

    return body as ParsedAutomationRequest<T>;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Malformed JSON request: ${msg}` }, { status: 400 });
  }
}
