import { expect, it, vi } from 'vitest'
vi.mock('@/lib/public-player-sitemaps', () => ({ getPlayerSitemapCount: vi.fn(async () => 2) }))
import robots from '@/app/robots'
it('restricts training and correction crawls while retaining public player sitemaps', async () => {
  const policy = await robots()
  expect(policy.rules).toEqual(expect.arrayContaining([
    expect.objectContaining({ userAgent: '*', allow: '/', disallow: expect.arrayContaining(['/data-assist', '/login', '/join', '/api/']) }),
    { userAgent: 'GPTBot', disallow: '/' },
  ]))
  const search = Array.isArray(policy.rules) ? policy.rules.find(rule => rule.userAgent === '*') : policy.rules
  expect(search?.disallow).not.toContain('/players/')
  expect(policy.sitemap).toEqual(['https://www.tenaceiq.com/sitemap.xml', 'https://www.tenaceiq.com/players/sitemap/0.xml', 'https://www.tenaceiq.com/players/sitemap/1.xml'])
})
