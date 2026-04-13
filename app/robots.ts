import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: 'https://tenaceiq.com/sitemap.xml',
    host: 'https://tenaceiq.com',
  }
}
