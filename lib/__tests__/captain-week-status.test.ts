import { describe, expect, it } from 'vitest'
import { buildCaptainWeekStatusKey, getCaptainWeekStatusMeta } from '../captain-week-status'

describe('captain week status helpers', () => {
  it('uses a stable ASCII fallback for empty week scope keys', () => {
    expect(buildCaptainWeekStatusKey({})).toBe('empty|empty|empty|empty|empty')
    expect(
      buildCaptainWeekStatusKey({
        team: '  Aces  ',
        league: null,
        flight: '4.0',
        eventDate: '',
        opponentTeam: undefined,
      }),
    ).toBe('aces|empty|4.0|empty|empty')
  })

  it('keeps week status labels practical for captains', () => {
    expect(getCaptainWeekStatusMeta('draft-lineup').label).toBe('Draft lineup')
    expect(getCaptainWeekStatusMeta('ready-to-send').detail).toContain('team-facing update')
    expect(getCaptainWeekStatusMeta('finalized').detail).toContain('match-day execution')
  })
})
