import { NextRequest } from 'next/server';

/**
 * Gets the site base URL for the current environment.
 * Prioritizes configured environment variables, then falls back to request headers,
 * Vercel project URLs, and finally localhost:3000 for development.
 * 
 * @param request Optional NextRequest to extract host/proto headers from.
 * @returns The base URL string (e.g. "https://nexus-ojt.vercel.app" or "http://localhost:3000") without a trailing slash.
 */
export function getSiteUrl(request?: NextRequest): string {
  // 1. Prioritize explicitly defined site URL environment variables
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (siteUrl) {
    const trimmed = siteUrl.trim();
    if (trimmed) {
      return trimmed.replace(/\/$/, '');
    }
  }

  // 2. Try to dynamically extract host from incoming request headers
  if (request) {
    try {
      const proto = request.headers.get('x-forwarded-proto') || 'http';
      const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
      if (host) {
        return `${proto}://${host}`.replace(/\/$/, '');
      }
      const origin = request.nextUrl.origin;
      if (origin && !origin.includes('localhost:3000')) {
        return origin.replace(/\/$/, '');
      }
    } catch (e) {
      console.warn('[getSiteUrl] Failed to extract origin from request headers:', e);
    }
  }

  // 3. Fallback to Vercel production URLs
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 4. Fallback to standard localhost for development
  return 'http://localhost:3000';
}
