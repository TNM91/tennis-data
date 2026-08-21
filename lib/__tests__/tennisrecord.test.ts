import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isAllowedTennisRecordDiscovery, parseTennisRecordMatchPage, tennisRecordRecordPageKind } from '../tennisrecord/parser'
import { canonicalTennisRecordFingerprint, isAmbiguousIdentity, isTennisRecordBlock, reconcileMatchObservations } from '../tennisrecord/reconcile'
import { isWeeklyTennisRecordRefreshDue, scheduledTennisRecordBatchLimit, tennisRecordAutomationDecision, tennisRecordFailureDisposition } from '../tennisrecord/service'
import { getTennisRecordCampaignSeedUrls, tennisRecordFrontierStatus } from '../tennisrecord/frontier'

const fixture = readFileSync(join(process.cwd(), 'lib/__tests__/fixtures/tennisrecord-stl-match-84487.html'), 'utf8')
const historyFixture = readFileSync(join(process.cwd(), 'lib/__tests__/fixtures/tennisrecord-stl-history-2025.html'), 'utf8')

describe('TennisRecord ingestion safety', () => {
  it('parses representative singles, doubles, and set scores without treating published ratings as a rating input', () => {
    const parsed = parseTennisRecordMatchPage(fixture, 'https://www.tennisrecord.com/adult/matchresults.aspx?mid=84487&year=2026')
    expect(parsed.matches).toHaveLength(2)
    expect(parsed.matches[0]).toMatchObject({ playedOn: '2026-04-26', discipline: 'singles', courtNumber: 1, scoreText: '6-3 6-7 1-0', winnerSide: 'A' })
    expect(parsed.matches[0].participants[0]).toMatchObject({ name: 'Charles Kern', publishedRating: 3.85 })
    expect(parsed.matches[1].participants).toHaveLength(4)
    expect(parsed.teams).toHaveLength(2)
    expect(parsed.leagues[0]).toMatchObject({ flight: '4.0', seasonYear: 2026 })
  })

  it('parses the current public div-wrapped court labels', () => {
    const liveLayout = fixture
      .replace('<h3>Singles #1</h3>', '<div class="wrapper496"><div style="font-size:12px;">Singles #1</div></div><div class="container496">')
      .replace('<h3>Doubles #1</h3>', '</div><div class="wrapper496"><div style="font-size:12px;">Doubles #1</div></div><div class="container496">')
    const parsed = parseTennisRecordMatchPage(liveLayout, 'https://www.tennisrecord.com/adult/matchresults.aspx?mid=84487&year=2026')
    expect(parsed.matches.map((match) => match.courtNumber)).toEqual([1, 1])
    expect(parsed.matches.map((match) => match.discipline)).toEqual(['singles', 'doubles'])
  })

  it('skips the live table header and selects the participant row', () => {
    const liveTable = fixture.replace(
      '<table><tr><td><a href="/adult/profile.aspx?playername=Charles+Kern">',
      '<table><tr><td>Home Team</td><td>Score</td><td>Visiting Team</td></tr><tr><td><a href="/adult/profile.aspx?playername=Charles+Kern">',
    )
    const parsed = parseTennisRecordMatchPage(liveTable, 'https://www.tennisrecord.com/adult/matchresults.aspx?mid=84487&year=2026')
    expect(parsed.matches[0]).toMatchObject({ discipline: 'singles', scoreText: '6-3 6-7 1-0' })
    expect(parsed.matches[0].participants.map((player) => player.name)).toEqual(['Charles Kern', 'John Uy'])
  })

  it('derives the winner from factual set scores when the source omits a winner marker', () => {
    const scoreOnly = fixture.replace(/\sclass="winner"/gi, '')
    const parsed = parseTennisRecordMatchPage(scoreOnly, 'https://www.tennisrecord.com/adult/matchresults.aspx?mid=84487&year=2026')
    expect(parsed.matches[0]?.winnerSide).toBe('A')
  })

  it('discovers only explicitly supported public record URLs', () => {
    const withNavigation = fixture.replace('</body>', [
      '<a href="/adult/profile.aspx?playername=Charles+Kern">Player</a>',
      '<a href="/adult/teamprofile.aspx?teamname=Example">Team</a>',
      '<a href="/adult/matchresults.aspx?mid=123">Match</a>',
      '<a href="/adult/search.aspx">Search</a>',
      '<a href="/favicon-16x16.png">Icon</a>',
      '</body>',
    ].join(''))
    const parsed = parseTennisRecordMatchPage(withNavigation, 'https://www.tennisrecord.com/adult/matchresults.aspx?mid=84487&year=2026')
    expect(parsed.discoveredUrls).toEqual(expect.arrayContaining([
      'https://www.tennisrecord.com/adult/profile.aspx?playername=Charles+Kern',
      'https://www.tennisrecord.com/adult/teamprofile.aspx?teamname=Example',
    ]))
    expect(parsed.discoveredUrls).not.toEqual(expect.arrayContaining([
      'https://www.tennisrecord.com/adult/matchresults.aspx?mid=123',
      'https://www.tennisrecord.com/adult/search.aspx',
      'https://www.tennisrecord.com/favicon-16x16.png',
    ]))
    expect(tennisRecordRecordPageKind('https://www.tennisrecord.com/adult/profile.aspx?playername=Charles+Kern')).toBe('player')
    expect(tennisRecordRecordPageKind('https://www.tennisrecord.com/adult/search.aspx')).toBeNull()
  })

  it('keeps bootstrap discovery anchored to results and prevents profile fan-out', () => {
    const profileSource = 'https://www.tennisrecord.com/adult/profile.aspx?playername=Charles+Kern'
    const matchUrl = 'https://www.tennisrecord.com/adult/matchresults.aspx?mid=123'
    const playerUrl = 'https://www.tennisrecord.com/adult/profile.aspx?playername=John+Uy'
    const teamUrl = 'https://www.tennisrecord.com/adult/teamprofile.aspx?teamname=Example'
    expect(isAllowedTennisRecordDiscovery('https://www.tennisrecord.com/adult/matchresults.aspx?mid=84487', playerUrl)).toBe(true)
    expect(isAllowedTennisRecordDiscovery('https://www.tennisrecord.com/adult/matchresults.aspx?mid=84487', teamUrl)).toBe(true)
    expect(isAllowedTennisRecordDiscovery(profileSource, matchUrl)).toBe(true)
    expect(isAllowedTennisRecordDiscovery(profileSource, playerUrl)).toBe(false)
    expect(isAllowedTennisRecordDiscovery(profileSource, teamUrl)).toBe(false)
  })

  it('uses an explicit-season history page only to discover direct result pages', () => {
    const sourceUrl = 'https://www.tennisrecord.com/adult/matchhistory.aspx?playername=Example+Player&year=2025'
    const parsed = parseTennisRecordMatchPage(historyFixture, sourceUrl)
    expect(tennisRecordRecordPageKind(sourceUrl)).toBe('history')
    expect(tennisRecordRecordPageKind('https://www.tennisrecord.com/adult/matchhistory.aspx?playername=Example+Player&year=Recent')).toBeNull()
    expect(isAllowedTennisRecordDiscovery(sourceUrl, 'https://www.tennisrecord.com/adult/matchresults.aspx?mid=234349&year=2025')).toBe(true)
    expect(isAllowedTennisRecordDiscovery(sourceUrl, 'https://www.tennisrecord.com/adult/profile.aspx?playername=Another+Player')).toBe(false)
    expect(parsed.matches).toEqual([])
    expect(parsed.players).toEqual([])
    expect(parsed.discoveredUrls).toEqual([
      'https://www.tennisrecord.com/adult/matchresults.aspx?mid=234349&year=2025',
      'https://www.tennisrecord.com/adult/matchresults.aspx?mid=234338&year=2025',
    ])
  })

  it('keeps the same canonical fingerprint when a verified local score corrects TennisRecord', () => {
    const [match] = parseTennisRecordMatchPage(fixture, 'https://www.tennisrecord.com/adult/matchresults.aspx?mid=84487&year=2026').matches
    const corrected = { ...match, scoreText: '6-4 7-5' }
    expect(canonicalTennisRecordFingerprint(match)).toBe(canonicalTennisRecordFingerprint(corrected))
  })

  it('keeps a captain upload above newer TennisRecord data and surfaces the disagreement', () => {
    const result = reconcileMatchObservations([
      { id: 'tennisrecord', source: 'tennisrecord' as const, observedAt: '2026-08-19T12:00:00Z', scoreText: '6-4 6-3' },
      { id: 'captain', source: 'captain_upload' as const, observedAt: '2026-08-10T12:00:00Z', scoreText: '6-4 7-5', verifiedAt: '2026-08-10T12:05:00Z' },
    ])
    expect(result.winner?.id).toBe('captain')
    expect(result.conflicts).toHaveLength(1)
  })

  it('stages name-only player matches as ambiguous and detects blocks fail-closed', () => {
    expect(isAmbiguousIdentity([{ id: 'one' }], false)).toBe(true)
    expect(isAmbiguousIdentity([{ id: 'one' }], true)).toBe(false)
    expect(isTennisRecordBlock(429, '')).toBe('http_429')
    expect(isTennisRecordBlock(200, '<title>Access denied</title>')).toContain('access denied')
  })

  it('is idempotent when weekly processing sees the same source match again', () => {
    const [match] = parseTennisRecordMatchPage(fixture, 'https://www.tennisrecord.com/adult/matchresults.aspx?mid=84487&year=2026').matches
    const reprocessed = { ...match, sourceMatchKey: 'reprocessed' }
    expect(canonicalTennisRecordFingerprint(match)).toBe(canonicalTennisRecordFingerprint(reprocessed))
  })

  it('keeps scheduled collection paused until an admin selects a cadence and completes bootstrap without player-profile work', () => {
    expect(tennisRecordAutomationDecision('manual', 'bootstrap', 10)).toBe('skip')
    expect(tennisRecordAutomationDecision('weekly', 'bootstrap', 10)).toBe('skip')
    expect(tennisRecordAutomationDecision('bootstrap', 'bootstrap', 10)).toBe('run')
    expect(tennisRecordAutomationDecision('bootstrap', 'bootstrap', 0, 0)).toBe('awaiting_seed')
    expect(tennisRecordAutomationDecision('bootstrap', 'bootstrap', 0, 12)).toBe('complete_bootstrap')
    expect(tennisRecordAutomationDecision('weekly', 'weekly', 0)).toBe('run')
    expect(isWeeklyTennisRecordRefreshDue(null)).toBe(true)
    expect(isWeeklyTennisRecordRefreshDue('2026-08-20T00:00:00.000Z', Date.parse('2026-08-26T23:59:59.000Z'))).toBe(false)
    expect(isWeeklyTennisRecordRefreshDue('2026-08-20T00:00:00.000Z', Date.parse('2026-08-27T00:00:00.000Z'))).toBe(true)
  })

  it('seeds the Missouri frontier from explicit-season public history pages and never marks an empty campaign complete', () => {
    const urls = getTennisRecordCampaignSeedUrls({ slug: 'missouri-2025-current', startsOn: '2025-01-01', endsOn: '2026-08-21' })
    expect(urls).toContain('https://www.tennisrecord.com/adult/matchhistory.aspx?playername=Nathan+Meinert&year=2025')
    expect(urls).toContain('https://www.tennisrecord.com/adult/matchhistory.aspx?playername=Nathan+Meinert&year=2026')
    expect(urls.every((url) => tennisRecordRecordPageKind(url) === 'history')).toBe(true)
    expect(tennisRecordFrontierStatus(0, urls.length)).toBe('ready_to_seed')
    expect(tennisRecordFrontierStatus(0, 0)).toBe('needs_admin_seed')
    expect(tennisRecordFrontierStatus(1, urls.length)).toBe('seeded')
  })

  it('uses a bounded eight-page scheduled batch without exceeding the admin limit', () => {
    expect(scheduledTennisRecordBatchLimit(12)).toBe(8)
    expect(scheduledTennisRecordBatchLimit(8)).toBe(8)
    expect(scheduledTennisRecordBatchLimit(5)).toBe(5)
    expect(scheduledTennisRecordBatchLimit(3)).toBe(3)
  })

  it('retries only transient source failures and quarantines them after the bounded limit', () => {
    expect(tennisRecordFailureDisposition('fetch failed', 0)).toBe('retry')
    expect(tennisRecordFailureDisposition('network timeout', 2)).toBe('retry')
    expect(tennisRecordFailureDisposition('fetch failed', 3)).toBe('quarantine')
    expect(tennisRecordFailureDisposition('Unexpected result-page markup', 0)).toBe('quarantine')
  })

})
