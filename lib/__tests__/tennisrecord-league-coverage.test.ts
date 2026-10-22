import { describe, expect, it } from 'vitest'
import { isLeagueWatchSlot, leagueWatchCaptureFacts } from '../tennisrecord/league-coverage'
import type { ParsedTennisRecordPage } from '../tennisrecord/types'

const team = 'https://www.tennisrecord.com/adult/teamprofile.aspx?teamname=Team&year=2027'
const card = 'https://www.tennisrecord.com/adult/matchresults.aspx?year=2027&mid=1'
const page = (): ParsedTennisRecordPage => ({ players: [], teams: [], teamMembers: [], leagues: [], matches: [], discoveredUrls: [] })
describe('monitored league coverage', () => {
  it('reserves only one existing current-season slot, never historical slots', () => {
    expect(Array.from({ length: 18 }, (_, i) => isLeagueWatchSlot(i, true)).filter(Boolean)).toHaveLength(1)
    expect(isLeagueWatchSlot(3, false)).toBe(false)
    expect(isLeagueWatchSlot(3, true)).toBe(true)
  })
  it('preserves review holds', () => {
    expect(leagueWatchCaptureFacts({ ...page(), reviewReason: 'Identity conflict' }, team)).toBeNull()
  })
  it('discovers only exact public same-season team and scorecard links', () => {
    const p = page()
    p.discoveredUrls = [card, card, team, card.replace('2027', '2026'), card.replace('www.tennisrecord.com', 'evil.example'), 'bad', 'https://www.tennisrecord.com/adult/profile.aspx?playername=Somebody']
    expect(leagueWatchCaptureFacts(p, team)?.links).toEqual([{ url: card, kind: 'match' }, { url: team, kind: 'team' }])
  })
  it('does not certify an empty roster or empty league directory', () => {
    expect(leagueWatchCaptureFacts(page(), team)?.count).toBeNull()
    expect(leagueWatchCaptureFacts(page(), 'https://www.tennisrecord.com/adult/league.aspx?year=2027&flightname=Men')?.count).toBeNull()
  })
  it('counts source identities on this exact roster without merging names', () => {
    const p = page()
    p.teamMembers = ['one', 'two', 'one'].map(sourcePlayerKey => ({ teamName: 'Team', sourcePlayerKey, sourceUrl: team, name: 'Same Name' }))
    p.teamMembers.push({ ...p.teamMembers[0], sourcePlayerKey: 'other', sourceUrl: team.replace('2027', '2026') })
    expect(leagueWatchCaptureFacts(p, team)?.count).toBe(2)
  })
  it('flags a past empty scorecard but does not call future play missing results', () => {
    const now = new Date('2026-10-22T12:00:00Z')
    const p = page()
    p.teams = ['A', 'B'].map(name => ({ sourceTeamKey: name, name, leagueName: 'League', flight: '4.5', seasonYear: 2027, sourceUrl: team }))
    p.leagues = [{ sourceLeagueKey: 'league', name: 'League', flight: '4.5', seasonYear: 2027, sourceUrl: 'https://www.tennisrecord.com/adult/league.aspx?year=2027&flightname=Men' }]
    expect(leagueWatchCaptureFacts(p, card, now, 'Scheduled Date: 10/18/2026')?.pending).toBe(true)
    expect(leagueWatchCaptureFacts(page(), card, now, 'Scheduled Date: 10/18/2026')?.pending).toBe(false)
    expect(leagueWatchCaptureFacts(p, card, now, 'Scheduled Date: 02/31/2026')?.pending).toBe(false)
    expect(leagueWatchCaptureFacts({ ...p, teams: p.teams.slice(0, 1) }, card, now, 'Scheduled Date: 10/18/2026')?.pending).toBe(false)
    expect(leagueWatchCaptureFacts(page(), card, now, 'Scheduled Date: 10/25/2026')?.pending).toBe(false)
    expect(leagueWatchCaptureFacts(page(), card, now)?.pending).toBe(false)
  })
})
