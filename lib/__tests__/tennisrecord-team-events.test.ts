import { describe, expect, it } from 'vitest'
import { parseTennisRecordMatchPage, parseTennisRecordTeamEvent } from '../tennisrecord/parser'
import { teamResultHref } from '../team-match-results'

const url = 'https://www.tennisrecord.com/adult/matchresults.aspx?year=2027&mid=13104'
const team = (name: string, courts: string) => `<tr><td><a href="/adult/teamprofile.aspx?teamname=${name}&amp;year=2027">${name}</a></td><td>${courts}</td><td>4</td></tr>`
const table = `<table><tr><th>Team Name</th><th>Courts Won</th><th>Sets Lost</th></tr>${team('Elias-Hurst (F)', '3')}${team('Harris (F)', '2')}</table>`
const heading = '<h1>Match Results</h1><p>2027 Adult 18+ Missouri Valley Missouri St. Louis M 4.0 Scheduled Date: 09/20/2026 Match Criteria: Team Wins Match Type: Local Match</p>'
const html = heading + table

describe('printed team-event results', () => {
  it('keeps one 3-2 team win even when no player courts are complete', () => {
    const parsed = parseTennisRecordMatchPage(html + '<div>Singles #2</div><table><tr><td>Thomas Tesar</td><td>6-0 6-0</td><td>-------------------------</td></tr></table>', url)
    expect(parsed.matches).toEqual([])
    expect(parsed.players).toEqual([])
    expect(parsed.teamEvent).toEqual({ sourceEventId: 'tennisrecord:2027:13104', sourceUrl: url,
      seasonYear: 2027, playedOn: '2026-09-20', leagueName: '2027 Adult 18+ Missouri Valley Missouri St. Louis M 4.0',
      flight: '4.0', homeTeam: 'Elias-Hurst (F)', awayTeam: 'Harris (F)', homeCourts: 3, awayCourts: 2, winnerSide: 'A' })
  })
  it('deduplicates identical responsive tables without combining separate source event IDs', () => {
    expect(parseTennisRecordTeamEvent(html + table, url)).toEqual(parseTennisRecordTeamEvent(html, url))
    expect(parseTennisRecordTeamEvent(html, url.replace('13104', '13105'))?.sourceEventId).toBe('tennisrecord:2027:13105')
  })
  it('uses the Courts Won column rather than sets lost or individual match scores', () => {
    const swapped = html.replace(team('Elias-Hurst (F)', '3'), team('Elias-Hurst (F)', '1'))
    expect(parseTennisRecordTeamEvent(swapped, url)).toMatchObject({ homeCourts: 1, awayCourts: 2, winnerSide: 'B' })
  })
  it.each([
    ['unplayed', html.replace('<td>3</td>', '<td>0</td>').replace('<td>2</td>', '<td>0</td>')],
    ['tie without a winning rule', html.replace('<td>3</td>', '<td>2</td>')],
    ['different criterion', html.replace('Team Wins', 'Total Games')],
    ['different linked season', html.replaceAll('year=2027', 'year=2026')],
    ['different heading season', html.replace('2027 Adult', '2026 Adult')],
    ['invalid date', html.replace('09/20/2026', '02/30/2026')],
    ['missing team identity', html.replace('teamname=Harris (F)', 'teamname=Other')],
    ['missing score', html.replace('<td>3</td>', '<td></td>')],
    ['conflicting tables', html + table.replace('<td>3</td>', '<td>4</td>')],
    ['script-only totals', heading + `<script>${table}</script>`],
  ])('does not guess a team result from %s', (_, value) => {
    expect(parseTennisRecordTeamEvent(value, url)).toBeUndefined()
  })
  it('rejects a profile, untrusted host, or ambiguous event locator', () => {
    for (const value of [url.replace('matchresults', 'teamprofile'), url.replace('www.tennisrecord.com', 'other.example'), url + '&mid=2']) {
      expect(parseTennisRecordTeamEvent(html, value)).toBeUndefined()
    }
  })
  it('keeps source-only totals linked to their scorecard and canonical results linked locally', () => {
    expect(teamResultHref({ id: 'source', source_url: url })).toBe(url)
    expect(teamResultHref({ id: 'local' })).toBe('/matches/local')
    expect(teamResultHref({ id: 'local', source_url: 'https://other.example/' })).toBe('/matches/local')
  })
})
