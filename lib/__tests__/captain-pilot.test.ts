import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildCaptainPilotTrialEnd,
  getCaptainPilotAvailability,
  normalizeCaptainPilotTeamKey,
} from '@/lib/captain-pilot'
import {
  buildCaptainPilotHref,
  getCaptainPilotSourceFromHref,
  normalizeCaptainPilotSource,
} from '@/lib/captain-pilot-source'

describe('Fall Captain Pilot campaign rules', () => {
  it('directs existing Captain members to their teams instead of another activation form', () => {
    const source = readFileSync(join(process.cwd(), 'app/captain-pilot/captain-pilot-client.tsx'), 'utf8')
    expect(source).toContain('buildProductAccessState(role, entitlements).canUseCaptainWorkflow')
    expect(source).toContain('!isOpen || hasCaptainAccess) return')
    expect(source).toContain('Your Captain tools are ready.')
    expect(source).toContain('Continue my first match week')
    expect(source).toContain('Open all teams')
    expect(source).not.toContain('Your account currently has Free access.')
    expect(source).toContain('} finally {')
  })
  it('is open immediately and closes at the end of the published enrollment window', () => {
    expect(getCaptainPilotAvailability(new Date('2026-08-28T12:00:00-05:00'))).toBe('active')
    expect(getCaptainPilotAvailability(new Date('2027-01-01T00:00:00-06:00'))).toBe('expired')
  })

  it('ends the trial three calendar months after activation', () => {
    const trialEnd = buildCaptainPilotTrialEnd(new Date('2026-08-31T14:30:00Z'))
    expect(new Date(trialEnd * 1000).toISOString()).toBe('2026-11-30T14:30:00.000Z')
  })

  it('normalizes team names for the one-team redemption guard', () => {
    expect(normalizeCaptainPilotTeamKey('  River Club — 3.5 Women!  ')).toBe('river-club-3-5-women')
  })

  it('normalizes campaign aliases and preserves a clean source link', () => {
    expect(normalizeCaptainPilotSource('SMS')).toBe('text')
    expect(normalizeCaptainPilotSource('club-flyer')).toBe('flyer')
    expect(getCaptainPilotSourceFromHref('/captain-pilot?utm_source=club-flyer')).toBe('flyer')
    expect(getCaptainPilotSourceFromHref('/captain-pilot?src=referral')).toBe('referral')
    expect(buildCaptainPilotHref('email')).toBe('/captain-pilot?src=email')
    expect(buildCaptainPilotHref('direct')).toBe('/captain-pilot')
  })
})
