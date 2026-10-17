import { describe, expect, it } from 'vitest'
import { getTeamActivityGroup } from '@/lib/team-activity'

describe('team activity groups', () => {
  it.each([
    [null, '2026-09-13', 'unreported'],
    [null, '2026-10-16', 'upcoming'],
    [null, '2026-10-18', 'upcoming'],
    [null, null, 'unreported'],
    [null, 'unknown', 'unreported'],
    [true, '2026-10-11', 'results'],
    [false, '2026-10-04', 'results'],
  ] as const)('classifies outcome %s on %s as %s', (won, match_date, expected) => {
    expect(getTeamActivityGroup({ won, match_date }, '2026-10-16')).toBe(expected)
  })
})
