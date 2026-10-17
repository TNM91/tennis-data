import { describe, expect, it } from 'vitest'
import { reconcileTeamProfileFixtures } from '@/lib/team-profile-fixtures'

const scheduled = { id: 'schedule', home_team: 'Meinert', away_team: 'Levin', league_name: 'Fall', flight: '4.5', match_date: '2026-10-11', winner_side: null }
const result = { ...scheduled, id: 'result', winner_side: 'A' }

describe('team profile fixture reconciliation', () => {
  it('replaces an unreported schedule row with its recorded result regardless of input order', () => {
    expect(reconcileTeamProfileFixtures([scheduled, result])).toEqual([result])
    expect(reconcileTeamProfileFixtures([result, scheduled])).toEqual([result])
  })
  it.each(['league_name', 'flight', 'match_date', 'away_team', 'home_team'] as const)('does not cross %s boundaries', key => {
    const other = { ...scheduled, [key]: 'different' }
    expect(reconcileTeamProfileFixtures([other, result])).toEqual([other, result])
  })
  it('normalizes whitespace and case while retaining the result row identity', () => {
    expect(reconcileTeamProfileFixtures([{ ...scheduled, home_team: ' MEINERT ' }, result])).toEqual([result])
  })
  it('keeps incomplete fixture identities and genuinely unreported matches', () => {
    const undated = { ...scheduled, match_date: null }
    expect(reconcileTeamProfileFixtures([undated, scheduled])).toEqual([undated, scheduled])
  })
})
