import { describe, expect, it } from 'vitest'
import { getCaptainShareDescription, getCaptainShareLabel, getCaptainShareTitle } from '@/lib/captain-share-links'

describe('captain share link copy', () => {
  it('identifies a projected lineup instead of using the generic site title', () => {
    const share = { kind: 'lineup' as const, detail: 'Projected lineup · 5 courts', teamName: 'Aces', opponent: 'Volleys', matchDate: '2026-10-03' }
    expect(getCaptainShareLabel(share)).toBe('Projected lineup')
    expect(getCaptainShareTitle(share)).toBe('Projected lineup: Aces vs Volleys')
    expect(getCaptainShareDescription(share)).toContain('5 courts')
  })

  it('keeps confirmed lineups and each other export type distinct', () => {
    expect(getCaptainShareLabel({ kind: 'lineup', detail: 'Confirmed lineup · 4 courts' })).toBe('Confirmed lineup')
    expect(getCaptainShareLabel({ kind: 'final-result', detail: 'Aces won 3–2' })).toBe('Final result')
    expect(getCaptainShareLabel({ kind: 'availability', detail: 'Reply by Thursday' })).toBe('Availability check')
    expect(getCaptainShareLabel({ kind: 'practice', detail: 'Tuesday at 6:00 PM' })).toBe('Practice plan')
    expect(getCaptainShareLabel({ kind: 'live-scorecard', detail: '2 courts complete' })).toBe('Live scorecard')
    expect(getCaptainShareLabel({ kind: 'team-room', detail: 'Team conversation' })).toBe('Team Room')
    expect(getCaptainShareLabel({ kind: 'team-invite', detail: 'Secure invitation' })).toBe('Team invitation')
  })
})
