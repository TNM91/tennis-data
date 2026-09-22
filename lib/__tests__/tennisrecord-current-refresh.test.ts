import { describe, expect, it } from 'vitest'
import { currentSeasonDiscoveryUrls, hasMissouriPageEvidence, isMissouriCompetition, nextCurrentRefreshAt, preferCurrentSeason } from '../tennisrecord/current-refresh'
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

  it('rolls discovery to the new year without recurring undated or prior-year history', () => {
    const urls = [base + 'matchhistory.aspx?year=2026', base + 'matchhistory.aspx?year=2027', base + 'profile.aspx?playername=A', 'https://evil.example/?year=2027', 'bad']
    expect(currentSeasonDiscoveryUrls(urls, new Date('2027-01-01T00:00:00Z'))).toEqual([urls[1]])
    expect(nextCurrentRefreshAt(new Date('2026-12-28T09:00:00Z'))).toBe('2027-01-04T09:00:00.000Z')
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
