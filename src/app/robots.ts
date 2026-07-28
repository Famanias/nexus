import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nexus-ojt.vercel.app';

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/docs', '/login', '/register', '/contact', '/privacy', '/terms'],
      disallow: ['/dashboard/', '/api/', '/auth/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
