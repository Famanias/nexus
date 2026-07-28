import { CSP_ORIGINS, type SecurityProfile } from './origins';

export interface CspOptions {
  nonce: string;
  profile?: SecurityProfile;
  mode?: 'report-only' | 'enforce';
  reportUri?: string;
  reportToGroup?: string;
}

export interface CspDirectives {
  'default-src': string[];
  'script-src': string[];
  'style-src': string[];
  'img-src': string[];
  'font-src': string[];
  'connect-src': string[];
  'frame-src': string[];
  'object-src': string[];
  'base-uri': string[];
  'form-action': string[];
  'frame-ancestors': string[];
  'upgrade-insecure-requests'?: boolean;
  'report-uri'?: string[];
  'report-to'?: string[];
}

export function buildCspDirectives(options: CspOptions): CspDirectives {
  const profile: SecurityProfile = options.profile ?? (process.env.NODE_ENV === 'development' ? 'development' : 'production');
  const origins = CSP_ORIGINS[profile] ?? CSP_ORIGINS.production;

  const scriptSrc = [
    "'self'",
    `'nonce-${options.nonce}'`,
    "'strict-dynamic'",
    ...origins.scriptSrc,
  ];

  if (profile === 'development') {
    scriptSrc.push("'unsafe-eval'");
  }

  const directives: CspDirectives = {
    'default-src': ["'self'"],
    'script-src': scriptSrc,
    'style-src': ["'self'", "'unsafe-inline'", ...origins.styleSrc],
    'img-src': ["'self'", 'blob:', 'data:', ...origins.imgSrc],
    'font-src': ["'self'", 'data:', ...origins.fontSrc],
    'connect-src': ["'self'", ...origins.connectSrc],
    'frame-src': ["'self'", ...origins.frameSrc],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };

  if (profile === 'production') {
    directives['upgrade-insecure-requests'] = true;
  }

  if (options.reportUri) {
    directives['report-uri'] = [options.reportUri];
  }

  if (options.reportToGroup) {
    directives['report-to'] = [options.reportToGroup];
  }

  return directives;
}

export function serializeCsp(directives: CspDirectives): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(directives)) {
    if (key === 'upgrade-insecure-requests') {
      if (value === true) {
        parts.push('upgrade-insecure-requests');
      }
      continue;
    }

    if (Array.isArray(value) && value.length > 0) {
      parts.push(`${key} ${value.join(' ')}`);
    }
  }

  return parts.join('; ');
}
