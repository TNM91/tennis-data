import { describe, expect, it } from 'vitest'
import {
  buildCaptainPilotTrialEnd,
  getCaptainPilotAvailability,
  normalizeCaptainPilotTeamKey,
} from '@/lib/captain-pilot'

describe('Fall Captain Pilot campaign rules', () => {
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
})
