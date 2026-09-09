import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compactAvailabilityToken, expandAvailabilityToken, matchAvailabilityPath, seasonAvailabilityPath, readSeasonAvailabilityToken } from '../availability-short-links'
import { buildMatchWeekPhoneCalendarHref } from '../captain-match-week-links'
import { GET as matchRedirect } from '@/app/a/[code]/route'
import { GET as seasonRedirect } from '@/app/s/route'
import nextConfig from '../../next.config'

const token = '00112233-4455-4677-8899-aabbccddeeff'
const code = 'ABEiM0RVRneImaq7zN3u_w'
describe('short personal availability links', () => {
  it('overrides the global referrer policy for every bearer short route in production', async () => {
    const rules = await nextConfig.headers!()
    for (const path of ['/a/:path*', '/pr/:path*', '/s']) {
      expect(rules.find(rule => rule.source === path)?.headers).toContainEqual({ key: 'Referrer-Policy', value: 'no-referrer' })
    }
  })
  it('keeps all 128 bits, including leading zero bytes, without a mapping or new token', () => {
    expect(compactAvailabilityToken(token)).toBe(code)
    expect(expandAvailabilityToken(code)).toBe(token)
    expect(compactAvailabilityToken(token.toUpperCase())).toBe(code)
    for (let i = 0; i < 1000; i++) {
      const original = randomUUID()
      const compact = compactAvailabilityToken(original)!
      expect(compact).toMatch(/^[A-Za-z0-9_-]{22}$/)
      expect(expandAvailabilityToken(compact)).toBe(original)
    }
  })
  it('rejects malformed and noncanonical encodings', () => {
    for (const value of ['', code.slice(1), `${code}=`, `${code}x`, code.slice(0, -1) + 'x', 'https://evil.test', 'é'.repeat(22), '%2f'.repeat(7)]) {
      expect(expandAvailabilityToken(value)).toBeNull()
    }
    expect(compactAvailabilityToken('not-a-uuid')).toBeNull()
  })
  it('shortens match and season links, keeping season secrets out of page requests', () => {
    expect(matchAvailabilityPath(token)).toBe(`/a/${code}`)
    const season = new URL(seasonAvailabilityPath(token), 'https://www.tenaceiq.com')
    expect(season.pathname).toBe('/s')
    expect(season.search).toBe('')
    expect(season.hash).toBe(`#${code}`)
    expect(readSeasonAvailabilityToken(season.hash)).toBe(token)
    expect(readSeasonAvailabilityToken(`#${token}`)).toBe(token)
    expect(readSeasonAvailabilityToken('#broken')).toBe('')
  })
  it('leaves non-UUID legacy paths unshortened', () => {
    expect(matchAvailabilityPath('legacy')).toBe('/availability/legacy')
    expect(seasonAvailabilityPath('legacy')).toBe('/season-availability#legacy')
  })
  it('uses the original match calendar token for short and legacy links', () => {
    const origin = 'https://www.tenaceiq.com'
    const expected = `${origin}/api/captain/availability-requests/${token}/calendar.ics`
    expect(buildMatchWeekPhoneCalendarHref(`${origin}${matchAvailabilityPath(token)}`)).toBe(expected)
    expect(buildMatchWeekPhoneCalendarHref(`${origin}/availability/${token}`)).toBe(expected)
    expect(buildMatchWeekPhoneCalendarHref(`${origin}/a/broken`)).toBe('')
    expect(buildMatchWeekPhoneCalendarHref(`${origin}${seasonAvailabilityPath(token)}`)).toBe('')
  })
  it('redirects only to the existing player page, ignoring attacker-supplied redirect arguments', async () => {
    const response = await matchRedirect(new Request(`https://www.tenaceiq.com/a/${code}?next=https://evil.test`), { params: Promise.resolve({ code }) })
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(`/availability/${token}`)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('x-robots-tag')).toContain('noindex')
  })
  it('gives a clear error for an incomplete match link without redirecting', async () => {
    const response = await matchRedirect(new Request('https://www.tenaceiq.com/a/broken'), { params: Promise.resolve({ code: 'broken' }) })
    expect(response.status).toBe(404)
    expect(response.headers.get('location')).toBeNull()
    expect(await response.text()).toContain('Ask your captain to resend')
  })
  it('preserves the season fragment through a private fixed-destination redirect', async () => {
    const response = await seasonRedirect()
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('/season-availability')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  })
  it('wires both invitation API paths and both season sharing actions to the helpers', () => {
    const api = readFileSync('app/api/captain/availability-requests/route.ts', 'utf8')
    expect(api.match(/requestUrl:.*matchAvailabilityPath/g)).toHaveLength(4)
    const season = readFileSync('app/components/season-kickoff.tsx', 'utf8')
    expect(season.match(/seasonAvailabilityPath\(invite.response_token\)/g)).toHaveLength(2)
    const client = readFileSync('app/season-availability/season-availability-client.tsx', 'utf8')
    expect(client).toContain('readSeasonAvailabilityToken(window.location.hash)')
    expect(client).toContain('data?.calendarToken')
  })
})
