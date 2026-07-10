import { getSiteUrl } from '../src/lib/utils/url';
import { sendInvitationEmail } from '../src/lib/services/email';
import { NextRequest } from 'next/server';

// Mock request headers helper
function createMockRequest(headers: Record<string, string>): NextRequest {
  const url = 'http://localhost:3000/api/invitations';
  return new NextRequest(url, { headers });
}

async function runTests() {
  console.log('--- STARTING TESTS ---\n');

  // Test 1: getSiteUrl with NEXT_PUBLIC_SITE_URL set
  console.log('Test 1: getSiteUrl with NEXT_PUBLIC_SITE_URL');
  process.env.NEXT_PUBLIC_SITE_URL = 'https://nexus.example.com/';
  console.log('Result:', getSiteUrl()); // Should be https://nexus.example.com (no trailing slash)
  delete process.env.NEXT_PUBLIC_SITE_URL;

  // Test 2: getSiteUrl with proxy headers
  console.log('\nTest 2: getSiteUrl with proxy headers');
  const req = createMockRequest({
    'x-forwarded-proto': 'https',
    'x-forwarded-host': 'mycustomdomain.com'
  });
  console.log('Result:', getSiteUrl(req)); // Should be https://mycustomdomain.com

  // Test 3: getSiteUrl dev fallback
  console.log('\nTest 3: getSiteUrl dev fallback');
  console.log('Result:', getSiteUrl()); // Should be http://localhost:3000

  // Test 4: sendInvitationEmail in development (missing key)
  console.log('\nTest 4: sendInvitationEmail in development (missing key)');
  (process.env as any).NODE_ENV = 'development';
  delete process.env.RESEND_API_KEY;
  const devRes = await sendInvitationEmail({
    email: 'test@example.com',
    orgName: 'Test Org',
    role: 'ojt',
    inviterName: 'Admin',
    inviteUrl: 'http://localhost:3000/invite/token123',
    expiresAt: '2026-07-17'
  });
  console.log('Dev Response (Should be success true):', devRes);

  // Test 5: sendInvitationEmail in production (missing key)
  console.log('\nTest 5: sendInvitationEmail in production (missing key)');
  (process.env as any).NODE_ENV = 'production';
  delete process.env.RESEND_API_KEY;
  const prodRes = await sendInvitationEmail({
    email: 'test@example.com',
    orgName: 'Test Org',
    role: 'ojt',
    inviterName: 'Admin',
    inviteUrl: 'http://localhost:3000/invite/token123',
    expiresAt: '2026-07-17'
  });
  console.log('Prod Response (Should be success false):', prodRes);

  console.log('\n--- TESTS COMPLETED ---');
}

runTests().catch(console.error);
