import { describe, expect, it } from 'vitest'
import {
  addCaptainTeamScope,
  buildCaptainTeamScopeKey,
  captainTeamOptionMatchesScopes,
  chooseCaptainTeamOption,
  getCaptainTeamScopeSource,
  getCaptainTeamScopeSourceLabel,
  type CaptainTeamOption,
  type CaptainTeamScope,
} from '../captain-team-scope'

const options: CaptainTeamOption[] = [
  { team: 'High Match Count', league: 'Dallas', flight: '4.0', matches: 20 },
  { team: 'Profile Team', league: 'Dallas', flight: '4.0', matches: 3 },
  { team: 'Roster Team', league: 'Dallas', flight: '4.0', matches: 8 },
]

describe('captain team scope helpers', () => {
  it('keeps a valid current resume or URL selection', () => {
    expect(
      chooseCaptainTeamOption({
        options,
        current: { team: 'High Match Count', league: 'Dallas', flight: '4.0' },
        scopes: [{ team: 'Profile Team', league: 'Dallas', flight: '4.0', source: 'profile' }],
      }),
    ).toEqual(options[0])
  })

  it('prefers the profile team before match-count ordering', () => {
    expect(
      chooseCaptainTeamOption({
        options,
        current: null,
        scopes: [
          { team: 'Roster Team', league: 'Dallas', flight: '4.0', source: 'roster' },
          { team: 'Profile Team', league: 'Dallas', flight: '4.0', source: 'profile' },
        ],
      })?.team,
    ).toBe('Profile Team')
  })

  it('matches a profile scope when league or flight is not stored yet', () => {
    const partialScope: CaptainTeamScope = { team: 'Profile Team', league: '', flight: '', source: 'profile' }

    expect(captainTeamOptionMatchesScopes(options[1], [partialScope])).toBe(true)
  })

  it('labels and keys team scope sources', () => {
    const map = new Map<string, CaptainTeamScope>()
    addCaptainTeamScope(map, { team: ' Profile Team ', league: ' Dallas ', flight: ' 4.0 ', source: 'profile' })

    const team = options[1]
    expect(buildCaptainTeamScopeKey(team)).toBe('Profile Team__Dallas__4.0')
    expect(getCaptainTeamScopeSource(team, [...map.values()])).toBe('profile')
    expect(getCaptainTeamScopeSourceLabel('profile')).toBe('your profile team')
    expect(getCaptainTeamScopeSourceLabel('connection')).toBe('a team you linked')
  })

  it('prefers a consented team connection before roster-only history', () => {
    expect(
      chooseCaptainTeamOption({
        options,
        current: null,
        scopes: [
          { team: 'Roster Team', league: 'Dallas', flight: '4.0', source: 'roster' },
          { team: 'High Match Count', league: 'Dallas', flight: '4.0', source: 'connection' },
        ],
      })?.team,
    ).toBe('High Match Count')
  })

  it('prefers the most recently active team when scope priority is equal', () => {
    const recentOptions: CaptainTeamOption[] = [
      { team: 'Older Team', league: 'Dallas', flight: '4.0', matches: 12, lastMatchDate: '2025-05-01' },
      { team: 'Recent Team', league: 'Dallas', flight: '4.0', matches: 2, lastMatchDate: '2026-05-01' },
    ]

    expect(chooseCaptainTeamOption({ options: recentOptions, scopes: [] })?.team).toBe('Recent Team')
  })
})
