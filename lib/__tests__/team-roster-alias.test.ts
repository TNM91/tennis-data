import { describe, expect, it } from 'vitest'
import { resolveTeamRosterAlias } from '../team-roster-alias'

describe('team roster alias resolution', () => {
  it('connects the reported renamed opponent to its uniquely matching roster', () => {
    expect(resolveTeamRosterAlias('Gontarz/Gontarzmanian Devils (F)', [
      { teamName: 'Meinert/The Other Guys (F)' },
      { teamName: 'Schlueter-White (F)' },
      { teamName: 'Tao (F)' },
      { teamName: 'Schlueter-Tchen-Gontarz(F)' },
    ])).toEqual({
      teamName: 'Schlueter-Tchen-Gontarz(F)',
      normalizedTeamName: 'schlueter-tchen-gontarz(f)',
      match: 'unique-name-token',
      sharedTokens: ['gontarz'],
    })
  })

  it('does not guess when a token matches multiple rosters', () => {
    expect(resolveTeamRosterAlias('Schlueter Captains (F)', [
      { teamName: 'Schlueter-White (F)' },
      { teamName: 'Schlueter-Tchen-Gontarz(F)' },
    ])).toBeNull()
  })
})
