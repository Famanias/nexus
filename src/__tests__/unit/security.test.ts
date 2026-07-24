import { describe, it, expect } from 'vitest';
import { generateNonce } from '@/lib/security/nonce';
import { buildCspDirectives, serializeCsp } from '@/lib/security/csp';
import { isHtmlRequest, applySecurityHeaders } from '@/lib/security/headers';
import { parseCspReportPayload } from '@/lib/security/report';
import { NextRequest, NextResponse } from 'next/server';

describe('Application Security Framework', () => {
  describe('Nonce Generator', () => {
    it('generates unique nonces on every invocation', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      expect(nonce1).toBeTypeOf('string');
      expect(nonce2).toBeTypeOf('string');
      expect(nonce1.length).toBeGreaterThan(10);
      expect(nonce1).not.toEqual(nonce2);
    });
  });

  describe('CSP Directives Builder & Serializer', () => {
    it('builds development profile with unsafe-eval and localhost connections', () => {
      const directives = buildCspDirectives({
        nonce: 'test-nonce-123',
        profile: 'development',
        reportUri: '/api/csp-report',
      });

      expect(directives['script-src']).toContain("'unsafe-eval'");
      expect(directives['script-src']).toContain("'nonce-test-nonce-123'");
      expect(directives['script-src']).toContain("'strict-dynamic'");
      expect(directives['connect-src']).toContain('http://localhost:*');
      expect(directives['upgrade-insecure-requests']).toBeUndefined();
    });

    it('builds production profile with upgrade-insecure-requests and no unsafe-eval', () => {
      const directives = buildCspDirectives({
        nonce: 'test-nonce-456',
        profile: 'production',
        reportUri: '/api/csp-report',
      });

      expect(directives['script-src']).not.toContain("'unsafe-eval'");
      expect(directives['upgrade-insecure-requests']).toBe(true);
    });

    it('serializes CSP directives into clean string', () => {
      const directives = buildCspDirectives({
        nonce: 'my-nonce',
        profile: 'test',
        reportUri: '/api/csp-report',
      });
      const serialized = serializeCsp(directives);
      expect(serialized).toContain("default-src 'self'");
      expect(serialized).toContain("script-src 'self' 'nonce-my-nonce' 'strict-dynamic'");
      expect(serialized).toContain("report-uri /api/csp-report");
    });
  });

  describe('Targeted Response Scoping & Headers Applicator', () => {
    it('correctly identifies HTML document requests vs static assets & API routes', () => {
      const htmlReq = new NextRequest('http://localhost:3000/dashboard', {
        headers: { accept: 'text/html' },
      });
      const apiReq = new NextRequest('http://localhost:3000/api/users');
      const staticReq = new NextRequest('http://localhost:3000/_next/static/chunks/main.js');

      expect(isHtmlRequest(htmlReq)).toBe(true);
      expect(isHtmlRequest(apiReq)).toBe(false);
      expect(isHtmlRequest(staticReq)).toBe(false);
    });

    it('applies security headers and x-nonce header to HTML responses', () => {
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { accept: 'text/html' },
      });
      const resp = NextResponse.next();

      const { response, nonce } = applySecurityHeaders(req, resp);

      expect(nonce).toBeTypeOf('string');
      expect(req.headers.get('x-nonce')).toBe(nonce);
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.has('Content-Security-Policy-Report-Only') || response.headers.has('Content-Security-Policy')).toBe(true);
      expect(response.headers.get('Report-To')).toContain('csp-endpoint');
    });
  });

  describe('CSP Telemetry Report Parsing', () => {
    it('parses legacy application/csp-report payloads', () => {
      const legacyPayload = {
        'csp-report': {
          'document-uri': 'http://localhost:3000/dashboard',
          'referrer': '',
          'violated-directive': 'script-src-elem',
          'effective-directive': 'script-src-elem',
          'original-policy': "default-src 'self'",
          'blocked-uri': 'https://evil.com/script.js',
          'status-code': 200,
        },
      };

      const result = parseCspReportPayload(legacyPayload, 'TestUserAgent/1.0');
      expect(result.rawReportType).toBe('legacy-csp-report');
      expect(result.blockedUri).toBe('https://evil.com/script.js');
      expect(result.violatedDirective).toBe('script-src-elem');
      expect(result.userAgent).toBe('TestUserAgent/1.0');
    });

    it('parses modern Reporting API payloads', () => {
      const modernPayload = [
        {
          type: 'csp-violation',
          url: 'http://localhost:3000/login',
          body: {
            blockedURL: 'https://attacker.com/xss.js',
            violatedDirective: 'script-src',
            effectiveDirective: 'script-src',
          },
        },
      ];

      const result = parseCspReportPayload(modernPayload);
      expect(result.rawReportType).toBe('reporting-api');
      expect(result.blockedUri).toBe('https://attacker.com/xss.js');
      expect(result.violatedDirective).toBe('script-src');
    });

    it('handles malformed payloads gracefully without throwing exceptions', () => {
      const resultNull = parseCspReportPayload(null);
      expect(resultNull.blockedUri).toBe('unknown');
      expect(resultNull.violatedDirective).toBe('unknown');

      const resultString = parseCspReportPayload('invalid payload string');
      expect(resultString.blockedUri).toBe('unknown');
    });
  });
});
