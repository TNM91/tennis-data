import { expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
vi.mock('@/lib/public-player-sitemaps', () => ({ getPlayerSitemapCount: vi.fn(async () => 2) }))
import robots from '@/app/robots'
it('restricts training and correction crawls while retaining public player sitemaps', async () => {
  const policy = await robots()
  expect(policy.rules).toEqual(expect.arrayContaining([
    expect.objectContaining({ userAgent: '*', allow: '/', disallow: expect.arrayContaining(['/data-assist', '/login', '/join', '/api/']) }),
    { userAgent: 'GPTBot', disallow: '/' },
    { userAgent: ['meta-externalagent', 'Amazonbot', 'SemrushBot', 'AhrefsBot'], disallow: '/' },
  ]))
  const search = Array.isArray(policy.rules) ? policy.rules.find(rule => rule.userAgent === '*') : policy.rules
  expect(search?.disallow).not.toContain('/players/')
  expect(policy.sitemap).toEqual(['https://www.tenaceiq.com/sitemap.xml', 'https://www.tenaceiq.com/players/sitemap/0.xml', 'https://www.tenaceiq.com/players/sitemap/1.xml'])
})

it('limits automatic paid builds to production and intentional staging', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
  expect(config.git.deploymentEnabled).toEqual({ '*': false, master: true, staging: true })
})
