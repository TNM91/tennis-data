import { expect, it } from 'vitest'
import robots from '@/app/robots'

it('restricts training crawls while keeping public search discovery available', () => {
  const policy = robots()
  expect(policy.rules).toEqual(expect.arrayContaining([
    expect.objectContaining({ userAgent: '*', allow: '/', disallow: expect.arrayContaining(['/data-assist', '/login', '/join', '/api/']) }),
    { userAgent: 'GPTBot', disallow: '/' },
  ]))
  const searchRule = Array.isArray(policy.rules) ? policy.rules.find(rule => rule.userAgent === '*') : policy.rules
  expect(searchRule?.disallow).not.toContain('/players/')
  expect(policy.sitemap).toBe('https://www.tenaceiq.com/sitemap.xml')
})
