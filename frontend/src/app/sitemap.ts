import type { MetadataRoute } from 'next';
import { publicIndexing, siteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return publicIndexing
    ? ['', '/pricing', '/integrations', '/help', '/contact', '/about', '/privacy', '/terms', '/security', '/data', '/support', '/cookies', '/billing-policy'].map((path) => ({ url: new URL(path || '/', siteUrl).href }))
    : [];
}
