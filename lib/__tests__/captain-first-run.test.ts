import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildDataAssistSignInHref } from '../data-assist-navigation'
import { buildAuthEntryHref } from '../auth-entry-hrefs'
import { CAPTAIN_QUICK_START_HREF } from '../captain-quick-start'
import { isSafeLocalNextHref } from '../plan-intent'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Captain first-run handoffs', () => {
  it('keeps the offer attached across sign-in, signup, and password recovery', () => {
    for (const page of ['/login', '/join', '/forget-password']) {
      const url = new URL(buildAuthEntryHref(page, 'captain', '/captain-pilot', true), 'https://tenaceiq.test')
      expect(url.searchParams.get('plan')).toBe('captain')
      expect(url.searchParams.get('next')).toBe('/captain-pilot')
    }
  })

  it('shows an offer action before the benefit list and sends activation to guided setup', () => {
    const page = source('app/captain-pilot/captain-pilot-client.tsx')
    expect(page.indexOf('styles.heroActions')).toBeLessThan(page.indexOf('styles.benefitGrid'))
    expect(page).toContain("session?.user ? '#pilot-claim' : joinHref")
    expect(page).toContain('nextHref: CAPTAIN_QUICK_START_HREF')
    expect(page).toContain('Continue team setup')
    expect(isSafeLocalNextHref(CAPTAIN_QUICK_START_HREF, '/captain')).toBe(CAPTAIN_QUICK_START_HREF)
  })

  it('keeps signup and sign-in copy specific to the offer without replacing normal tier entry', () => {
    expect(source('app/join/page.tsx')).toContain("mobileTitle: 'Start your 3 months free.'")
    expect(source('app/join/page.tsx')).toContain('} : JOIN_INTENT_COPY[selectedPlanId]')
    expect(source('app/login/page.tsx')).toContain('Continue your Captain offer.')
    expect(source('app/login/page.tsx')).toContain('} : LOGIN_INTENT_COPY[selectedPlanId]')
    expect(source('app/welcome/page.tsx')).toContain('Follow the guided team setup')
  })

  it('preserves import type, team context, and nested return fragment through auth', () => {
    const query = new URLSearchParams({ intent: 'upload-source', type: 'team_summary', context: 'Add my team', returnTo: CAPTAIN_QUICK_START_HREF }).toString()
    const login = new URL(buildDataAssistSignInHref(query), 'https://tenaceiq.test')
    const next = login.searchParams.get('next')!
    const upload = new URL(next, login.origin)
    expect(upload.pathname).toBe('/data-assist')
    expect(upload.hash).toBe('#upload')
    expect(upload.searchParams.get('type')).toBe('team_summary')
    expect(upload.searchParams.get('context')).toBe('Add my team')
    expect(upload.searchParams.get('returnTo')).toBe(CAPTAIN_QUICK_START_HREF)
    for (const authPath of ['/join', '/forget-password']) {
      expect(new URL(buildAuthEntryHref(authPath, 'free', next, true), login.origin).searchParams.get('next')).toBe(next)
    }
    expect(isSafeLocalNextHref(next, '/explore')).toBe(next)
  })

  it('returns history sign-ins to history and handles an ordinary upload entry', () => {
    expect(new URL(buildDataAssistSignInHref('', 'history'), 'https://tenaceiq.test').searchParams.get('next')).toBe('/data-assist#history')
    expect(new URL(buildDataAssistSignInHref(''), 'https://tenaceiq.test').searchParams.get('next')).toBe('/data-assist#upload')
    expect(source('app/data-assist/page.tsx')).not.toContain('/login?redirect=/data-assist')
    expect(source('app/data-assist/page.tsx').match(/<DataAssistSignInLink/g)).toHaveLength(3)
  })
})
