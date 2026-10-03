import { isKnownMissouriPlayerHistory } from '../tennisrecord/current-refresh'
import { describe, expect, it } from 'vitest'
import { activeChampionshipYears, currentPlayerRefreshUrls, currentRefreshPageKindPlan, currentSeasonDiscoveryUrls, currentSeasonPreferredScope, nationalCurrentSeasonUrl, futureScorecardRefreshAt, hasMissouriPageEvidence, isMissouriCompetition, nextCurrentRefreshAt, preferCurrentSeason } from '../tennisrecord/current-refresh'
import { parseTennisRecordMatchPage } from '../tennisrecord/parser'
import { isTennisRecordCampaignDiscoveryAllowed } from '../tennisrecord/frontier'
import type { ParsedTennisRecordPage } from '../tennisrecord/types'

const empty: ParsedTennisRecordPage = { players: [], teams: [], leagues: [], matches: [], teamMembers: [], discoveredUrls: [] }
const base = 'https://www.tennisrecord.com/adult/'
const mo = { ...empty, players: [{ sourcePlayerKey: 'p1', name: 'Example Player', city: 'St. Louis', state: 'MO', ntrpLabel: '', sourceUrl: base + 'profile.aspx?playername=Example' }] }

describe('independent current-season refresh', () => {
  it('does not wait for bootstrap completion and preserves historical opportunities', () => {
    expect(preferCurrentSeason('bootstrap', null)).toBe(true)
    expect(preferCurrentSeason('bootstrap', 'bootstrap')).toBe(true)
    expect(preferCurrentSeason('bootstrap', 'weekly')).toBe(false)
    expect(preferCurrentSeason('weekly', 'weekly')).toBe(true)
    expect(preferCurrentSeason('manual', 'bootstrap')).toBe(false)
  })

  it('rolls discovery to the new year and refreshes dated history and owner profiles', () => {
    const urls = [base + 'matchhistory.aspx?year=2026', base + 'matchhistory.aspx?year=2027', base + 'profile.aspx?playername=A', 'https://evil.example/?year=2027', 'bad']
    expect(currentSeasonDiscoveryUrls(urls, new Date('2027-01-01T00:00:00Z'))).toEqual([urls[1], urls[2]])
    expect(nextCurrentRefreshAt(new Date('2026-12-28T09:00:00Z'))).toBe('2027-01-04T09:00:00.000Z')
  })

  it('limits nationwide weekly work to current competition and result pages', () => {
    const now = new Date('2026-09-24T00:00:00Z')
    expect(nationalCurrentSeasonUrl(base + 'league/leaguetype.aspx?year=2026', 'league', now)).toBe(true)
    expect(nationalCurrentSeasonUrl(base + 'teamprofile.aspx?teamname=A&year=2026', 'team', now)).toBe(true)
    expect(nationalCurrentSeasonUrl(base + 'matchresults.aspx?mid=1&year=2026', 'match', now)).toBe(true)
    expect(nationalCurrentSeasonUrl(base + 'matchhistory.aspx?year=2026', 'history', now)).toBe(false)
    expect(nationalCurrentSeasonUrl(base + 'matchresults.aspx?mid=1&year=2025', 'match', now)).toBe(false)
    expect(nationalCurrentSeasonUrl('https://example.com/matchresults.aspx?year=2026', 'match', now)).toBe(false)
    expect([0, 1, 2, 3, 4, 5].map(currentSeasonPreferredScope)).toEqual(['missouri', 'missouri', 'national', 'missouri', 'missouri', 'national'])
  })

  it('discovers next championship year during fall and retains profile identity parameters', () => {
    const now = new Date('2026-10-02T12:00:00Z')
    expect(activeChampionshipYears(now)).toEqual([2026, 2027])
    expect(activeChampionshipYears(new Date('2026-07-01'))).toEqual([2026])
    const urls = currentPlayerRefreshUrls(base + 'profile.aspx?playername=Nathan%20Meinert&s=7', now)
    expect(urls).toHaveLength(3)
    expect(new URL(urls[2]).searchParams.get('s')).toBe('7')
    expect(new URL(urls[2]).searchParams.get('year')).toBe('2027')
    expect(currentPlayerRefreshUrls('https://evil.example/adult/profile.aspx?playername=A', now)).toEqual([])
    expect(currentRefreshPageKindPlan(4)).toEqual([['history'], ['player'], ['team', 'league'], ['match']])
  })

  it('revisits a complete scheduled event captured before play instead of quarantining it forever', () => {
    const html = '<h1>Match Results</h1><p>2026 Tri-Level 18+ Missouri Valley Missouri St. Louis M 4.5 Scheduled Date: 09/14/2026</p><table><tr><th>Team Name</th></tr><tr><td>Gontarz</td></tr><tr><td>SuperSmash Bros/Pottebaum-Meinart</td></tr></table>'
    const page = parseTennisRecordMatchPage(html, base + 'matchresults.aspx?year=2026&mid=295320')
    expect(page.matches).toEqual([])
    expect(futureScorecardRefreshAt(html, page, new Date('2026-08-29T03:25:19Z'))).toBe('2026-09-05T03:25:19.000Z')
    expect(futureScorecardRefreshAt(html, page, new Date('2026-09-20T03:25:19Z'))).toBeNull()
    expect(futureScorecardRefreshAt(html, { ...page, reviewReason: 'conflicting event' }, new Date('2026-08-29'))).toBeNull()
    expect(futureScorecardRefreshAt(html, empty, new Date('2026-08-29'))).toBeNull()
  })

  it('distinguishes Missouri district from the multi-state section', () => {
    expect(isMissouriCompetition('2026 Adult Missouri Valley Missouri St. Louis')).toBe(true)
    expect(isMissouriCompetition('2026 Adult Missouri Valley Kansas')).toBe(false)
    expect(isMissouriCompetition('Missouri Valley')).toBe(false)
    expect(isMissouriCompetition('2026 Texas Dallas')).toBe(false)
  })

  it('requires profile location before expanding a player history', () => {
    expect(hasMissouriPageEvidence(mo)).toBe(true)
    expect(isTennisRecordCampaignDiscoveryAllowed('missouri-2025-current', mo.players[0].sourceUrl, base + 'matchhistory.aspx?year=2026', mo)).toBe(true)
    const tx = { ...mo, players: [{ ...mo.players[0], state: 'TX' }] }
    expect(isTennisRecordCampaignDiscoveryAllowed('missouri-2025-current', tx.players[0].sourceUrl, base + 'matchhistory.aspx?year=2026', tx)).toBe(false)
    expect(isTennisRecordCampaignDiscoveryAllowed('missouri-2025-current', mo.players[0].sourceUrl, base + 'matchhistory.aspx?year=2024', mo)).toBe(false)
  })

  it('retains an opponent profile reference without expanding an unproven team', () => {
    expect(isTennisRecordCampaignDiscoveryAllowed('missouri-2025-current', base + 'matchresults.aspx?mid=1', mo.players[0].sourceUrl, mo)).toBe(true)
    expect(isTennisRecordCampaignDiscoveryAllowed('missouri-2025-current', base + 'teamprofile.aspx?teamname=Unknown', base + 'matchhistory.aspx?year=2026', empty)).toBe(false)
  })

  it('does not follow another district even from a Missouri directory', () => {
    const source = base + 'league/leagueflight.aspx?sectionname=Missouri+Valley&districtname=Missouri&year=2026'
    expect(isTennisRecordCampaignDiscoveryAllowed('missouri-2025-current', source, source.replace('districtname=Missouri', 'districtname=Kansas'))).toBe(false)
    expect(isTennisRecordCampaignDiscoveryAllowed('missouri-2025-current', source, 'https://evil.example/?year=2026')).toBe(false)
    expect(isTennisRecordCampaignDiscoveryAllowed('us-2025-current', source, 'https://evil.example/?year=2026')).toBe(false)
  })
})

it('discovers direct courts from a known MO history without geography in the history page', () => {
  const history = base + 'matchhistory.aspx?playername=Nathan+Meinert&year=2026&s=7'
  const owner = { sourceUrl: base + 'profile.aspx?s=7&playername=Nathan%20Meinert', state: 'MO' }
  const court = base + 'matchresults.aspx?year=2027&mid=13347'
  expect(isKnownMissouriPlayerHistory(history, owner)).toBe(true)
  expect(isTennisRecordCampaignDiscoveryAllowed('missouri-2025-current', history, court, empty)).toBe(false)
  expect(isTennisRecordCampaignDiscoveryAllowed('missouri-2025-current', history, court, empty, owner)).toBe(true)
  expect(isTennisRecordCampaignDiscoveryAllowed('missouri-2025-current', history, history, empty, owner)).toBe(true)
  expect(isKnownMissouriPlayerHistory(history, { ...owner, state: 'KS' })).toBe(false)
  expect(isKnownMissouriPlayerHistory(history, { ...owner, sourceUrl: base + 'profile.aspx?playername=Nathan+Meinert&s=8' })).toBe(false)
  expect(isKnownMissouriPlayerHistory(history, { ...owner, sourceUrl: 'https://evil.example/adult/profile.aspx?playername=Nathan+Meinert&s=7' })).toBe(false)
  expect(isTennisRecordCampaignDiscoveryAllowed('missouri-2025-current', history, base + 'matchhistory.aspx?playername=Other&year=2026', empty, owner)).toBe(false)
})
