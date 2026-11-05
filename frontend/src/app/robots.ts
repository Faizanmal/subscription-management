import type { MetadataRoute } from 'next';
import { publicIndexing, siteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: publicIndexing
      ? { userAgent: '*', allow: '/', disallow: ['/dashboard', '/settings', '/subscriptions', '/analytics', '/recommendations', '/workflows', '/alerts', '/onboarding', '/invite', '/auth', '/integrations/*/callback', '/agreements', '/verify-email', '/login', '/register', '/reset-password', '/forgot-password'] }
      : { userAgent: '*', disallow: '/' },
    sitemap: publicIndexing ? new URL('/sitemap.xml', siteUrl).href : undefined,
  };
}
