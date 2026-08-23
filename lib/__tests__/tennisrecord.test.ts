import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isAllowedTennisRecordDiscovery, parseTennisRecordMatchPage, tennisRecordRecordPageKind } from '../tennisrecord/parser'
import { canonicalTennisRecordFingerprint, isAmbiguousIdentity, isTennisRecordBlock, reconcileMatchObservations } from '../tennisrecord/reconcile'
import { buildTennisRecordQueueDiscoveryPlan, isTennisRecordRunStale } from '../tennisrecord/service'
import { isTennisRecordWeeklyWindowOpen, isWeeklyTennisRecordRefreshDue, scheduledTennisRecordBatchLimit, shouldSelfStartTennisRecordBootstrap, tennisRecordAutomationDecision, tennisRecordCadenceSafetyStatus, tennisRecordCampaignCompletionAction, tennisRecordCheckpointForecast, tennisRecordDeferredRetryAt, tennisRecordFailureDisposition, tennisRecordScheduledPageKindPlan, TENNISRECORD_AUTOMATION_INTERVAL_MINUTES, TENNISRECORD_BOOTSTRAP_PAGE_KINDS, TENNISRECORD_WEEKLY_PAGE_KINDS } from '../tennisrecord/service'
import { getTennisRecordCampaignPlayerHistoryUrls, getTennisRecordCampaignSeedUrls, isTennisRecordCampaignDiscoveryAllowed, tennisRecordFrontierStatus } from '../tennisrecord/frontier'

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

  it('parses the current table-cell match heading and league value', () => {
    const currentPublicLayout = fixture.replace(
      '<h2>Match Results</h2><div>2026 Adult 18+ Missouri Valley Missouri St. Louis M 4.0</div>',
      '<table><tr><td>Match Results</td></tr></table><table><tr><td colspan="2">2026 Adult 18+ Missouri Valley Missouri St. Louis M 4.0</td></tr></table>',
    )
    const parsed = parseTennisRecordMatchPage(currentPublicLayout, 'https://www.tennisrecord.com/adult/matchresults.aspx?mid=84487&year=2026')
    expect(parsed.leagues[0]).toMatchObject({ name: '2026 Adult 18+ Missouri Valley Missouri St. Louis M 4.0', flight: '4.0' })
    expect(parsed.matches).toHaveLength(2)
    expect(parsed.teams.map((team) => team.name)).toEqual(['Masengill/Suddarth (S)', 'Dickerson/Nash (S)'])
  })

  it('quarantines a match page that has no trustworthy team context', () => {
    const missingTeamTable = fixture.replace(/<table><tr><th>Team Name<\/th>[\s\S]*?<\/table>/, '')
    const parsed = parseTennisRecordMatchPage(missingTeamTable, 'https://www.tennisrecord.com/adult/matchresults.aspx?mid=84487&year=2026')
    expect(parsed.matches).toEqual([])
    expect(parsed.teams).toEqual([])
    expect(parsed.players).toEqual([])
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

  it('follows only reviewed public league-directory routes into team evidence', () => {
    const directory = 'https://www.tennisrecord.com/adult/league/leaguetype.aspx?year=2025'
    const section = 'https://www.tennisrecord.com/adult/league/leaguesection.aspx?year=2025&lt=1'
    const team = 'https://www.tennisrecord.com/adult/teamprofile.aspx?teamname=Example&year=2025'
    const navigation = 'https://www.tennisrecord.com/adult/league/index.aspx'
    expect(tennisRecordRecordPageKind(directory)).toBe('league')
    expect(tennisRecordRecordPageKind(section)).toBe('league')
    expect(tennisRecordRecordPageKind(navigation)).toBeNull()
    expect(isAllowedTennisRecordDiscovery(directory, section)).toBe(true)
    expect(isAllowedTennisRecordDiscovery(directory, team)).toBe(true)
    expect(isAllowedTennisRecordDiscovery(directory, navigation)).toBe(false)
    const parsed = parseTennisRecordMatchPage(`<a href="${section}">Adult 18+</a><a href="${navigation}">Index</a><a href="${team}">Team</a>`, directory)
    expect(parsed.discoveredUrls).toEqual([section, team])
  })

  it('only treats explicitly labelled team-roster tables as source membership context', () => {
    const teamUrl = 'https://www.tennisrecord.com/adult/teamprofile.aspx?teamname=Example+Team'
    const explicitRoster = `
      <h2>Example Team</h2>
      <h3>Team Roster</h3>
      <table><tr><th>Player Name</th></tr>
      <tr><td><a href="/adult/profile.aspx?playername=Taylor+Smith">Taylor Smith</a></td></tr></table>`
    const parsed = parseTennisRecordMatchPage(explicitRoster, teamUrl)
    expect(parsed.teamMembers).toEqual([expect.objectContaining({ teamName: 'Example Team', name: 'Taylor Smith' })])
    expect(parsed.players.map((player) => player.name)).toEqual(['Taylor Smith'])

    const participantTable = explicitRoster.replace('Team Roster', 'Recent results')
    expect(parseTennisRecordMatchPage(participantTable, teamUrl).teamMembers).toEqual([])
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

  it('keeps checkpoints bounded, completes bootstrap only after its queue clears, and opens weekly refresh on Wednesday', () => {
    expect(tennisRecordAutomationDecision('manual', 'bootstrap', 10)).toBe('skip')
    expect(tennisRecordAutomationDecision('weekly', 'bootstrap', 10)).toBe('skip')
    expect(tennisRecordAutomationDecision('bootstrap', 'bootstrap', 10)).toBe('run')
    expect(tennisRecordAutomationDecision('bootstrap', 'bootstrap', 0, 0)).toBe('awaiting_seed')
    expect(tennisRecordAutomationDecision('bootstrap', 'bootstrap', 0, 12)).toBe('complete_bootstrap')
    expect(tennisRecordAutomationDecision('weekly', 'weekly', 0)).toBe('run')
    expect(isWeeklyTennisRecordRefreshDue(null)).toBe(true)
    expect(isWeeklyTennisRecordRefreshDue('2026-08-20T00:00:00.000Z', Date.parse('2026-08-26T23:59:59.000Z'))).toBe(false)
    expect(isWeeklyTennisRecordRefreshDue('2026-08-20T00:00:00.000Z', Date.parse('2026-08-27T00:00:00.000Z'))).toBe(true)
    expect(isTennisRecordWeeklyWindowOpen(new Date('2026-08-26T14:00:00.000Z'))).toBe(true)
    expect(isTennisRecordWeeklyWindowOpen(new Date('2026-08-27T14:00:00.000Z'))).toBe(false)
    expect(shouldSelfStartTennisRecordBootstrap({ automation_state: 'manual', bootstrap_started_at: null, bootstrap_completed_at: null })).toBe(true)
    expect(shouldSelfStartTennisRecordBootstrap({ automation_state: 'bootstrap', bootstrap_started_at: '2026-08-21T00:00:00.000Z', bootstrap_completed_at: null })).toBe(false)
    expect(shouldSelfStartTennisRecordBootstrap({ automation_state: 'manual', bootstrap_started_at: '2026-08-21T00:00:00.000Z', bootstrap_completed_at: null })).toBe(false)
  })

  it('seeds the Missouri frontier from explicit-season public history and bounded league directory pages', () => {
    const urls = getTennisRecordCampaignSeedUrls({ slug: 'missouri-2025-current', startsOn: '2025-01-01', endsOn: '2026-08-21' })
    expect(urls).toContain('https://www.tennisrecord.com/adult/matchhistory.aspx?playername=Nathan+Meinert&year=2025')
    expect(urls).toContain('https://www.tennisrecord.com/adult/matchhistory.aspx?playername=Nathan+Meinert&year=2026')
    expect(urls).toContain('https://www.tennisrecord.com/adult/league/leaguetype.aspx?year=2025')
    expect(urls.every((url) => ['history', 'league'].includes(tennisRecordRecordPageKind(url) || ''))).toBe(true)
    expect(tennisRecordFrontierStatus(0, urls.length)).toBe('ready_to_seed')
    expect(tennisRecordFrontierStatus(0, 0)).toBe('needs_admin_seed')
    expect(tennisRecordFrontierStatus(1, urls.length)).toBe('seeded')
  })

  it('keeps the Missouri league-directory path inside the Missouri Valley branch', () => {
    const root = 'https://www.tennisrecord.com/adult/league/leaguetype.aspx?year=2026'
    const section = 'https://www.tennisrecord.com/adult/league/leaguesection.aspx?lt=adult&year=2026'
    const missouri = 'https://www.tennisrecord.com/adult/league/leaguedistrict.aspx?lt=adult&sectionname=Missouri+Valley&year=2026'
    const otherSection = 'https://www.tennisrecord.com/adult/league/leaguedistrict.aspx?lt=adult&sectionname=Southern&year=2026'
    expect(isTennisRecordCampaignDiscoveryAllowed('missouri-2025-current', root, section)).toBe(true)
    expect(isTennisRecordCampaignDiscoveryAllowed('missouri-2025-current', section, missouri)).toBe(true)
    expect(isTennisRecordCampaignDiscoveryAllowed('missouri-2025-current', section, otherSection)).toBe(false)
    expect(isTennisRecordCampaignDiscoveryAllowed('missouri-2025-current', missouri, 'https://www.tennisrecord.com/adult/teamprofile.aspx?teamname=Sample')).toBe(true)
  })

  it('queues the nationwide public league directory only after its planned campaign activates', () => {
    const urls = getTennisRecordCampaignSeedUrls({ slug: 'us-2025-current', startsOn: '2025-01-01', endsOn: '2026-08-21' })
    expect(urls).toEqual([
      'https://www.tennisrecord.com/adult/league/leaguetype.aspx?year=2025',
      'https://www.tennisrecord.com/adult/league/leaguetype.aspx?year=2026',
    ])
    expect(urls.every((url) => tennisRecordRecordPageKind(url) === 'league')).toBe(true)
    expect(tennisRecordCampaignCompletionAction(true)).toBe('advance_campaign')
    expect(tennisRecordCampaignCompletionAction(false)).toBe('start_weekly')
  })

  it('expands Missouri only from source profiles that explicitly resolve to Missouri', () => {
    const campaign = { slug: 'missouri-2025-current', startsOn: '2025-01-01', endsOn: '2026-08-21' }
    expect(getTennisRecordCampaignPlayerHistoryUrls({ ...campaign, playerName: 'Example Player', state: 'MO' })).toEqual([
      'https://www.tennisrecord.com/adult/matchhistory.aspx?playername=Example+Player&year=2025',
      'https://www.tennisrecord.com/adult/matchhistory.aspx?playername=Example+Player&year=2026',
    ])
    expect(getTennisRecordCampaignPlayerHistoryUrls({ ...campaign, playerName: 'Kansas Example', state: 'KS' })).toEqual([])
    expect(getTennisRecordCampaignPlayerHistoryUrls({ ...campaign, playerName: 'Unknown Example', state: '' })).toEqual([])
    expect(getTennisRecordCampaignPlayerHistoryUrls({ slug: 'us-2025-current', startsOn: campaign.startsOn, endsOn: campaign.endsOn, playerName: 'National Example', state: 'CA' })).toHaveLength(2)
  })

  it('uses the bounded configured throughput for historical and weekly refreshes', () => {
    expect(scheduledTennisRecordBatchLimit(12)).toBe(8)
    expect(scheduledTennisRecordBatchLimit(8)).toBe(8)
    expect(scheduledTennisRecordBatchLimit(5)).toBe(5)
    expect(scheduledTennisRecordBatchLimit(2)).toBe(2)
    expect(scheduledTennisRecordBatchLimit(1)).toBe(1)
    expect(scheduledTennisRecordBatchLimit(12, 'weekly')).toBe(8)
    expect(scheduledTennisRecordBatchLimit(8, 'weekly')).toBe(8)
    expect(scheduledTennisRecordBatchLimit(5, 'weekly')).toBe(5)
    expect(TENNISRECORD_BOOTSTRAP_PAGE_KINDS).toEqual(['history', 'league', 'match', 'player', 'team'])
    expect(TENNISRECORD_WEEKLY_PAGE_KINDS).toEqual(['history', 'match', 'player', 'team'])
    expect(tennisRecordScheduledPageKindPlan('bootstrap', 3)).toEqual([['league'], ['player'], ['history', 'match', 'team']])
    expect(tennisRecordScheduledPageKindPlan('weekly', 8)).toEqual([
      ['match', 'history'], ['match', 'history'], ['player', 'team'], ['match', 'history'],
      ['match', 'history'], ['match', 'history'], ['player', 'team'], ['match', 'history'],
    ])
  })

  it('bases campaign timing on the currently known queue and bounded checkpoints', () => {
    expect(TENNISRECORD_AUTOMATION_INTERVAL_MINUTES).toBe(5)
    expect(tennisRecordCheckpointForecast(17, 1, 8)).toEqual({ pagesPerCheckpoint: 8, checkpointsRemaining: 3, estimatedMinutesRemaining: 15 })
    expect(tennisRecordCheckpointForecast(0, 0, 8)).toEqual({ pagesPerCheckpoint: 8, checkpointsRemaining: 0, estimatedMinutesRemaining: 0 })
  })

  it('backs off the faster cadence when the most recent checkpoint shows source pressure', () => {
    const now = Date.parse('2026-08-23T12:00:00.000Z')
    expect(tennisRecordCadenceSafetyStatus({
      started_at: '2026-08-23T11:58:00.000Z',
      completed_at: '2026-08-23T11:59:00.000Z',
      blocked_requests: 1,
    }, now)).toEqual({
      active: true,
      reason: 'A source access block was observed.',
      resumesAt: '2026-08-23T12:29:00.000Z',
    })
    expect(tennisRecordCadenceSafetyStatus({
      started_at: '2026-08-23T11:56:00.000Z',
      completed_at: '2026-08-23T11:59:30.000Z',
    }, now)).toMatchObject({ active: true, reason: 'The latest checkpoint ran longer than expected.' })
    expect(tennisRecordCadenceSafetyStatus({
      completed_at: '2026-08-23T11:59:00.000Z',
      transient_retries: 4,
    }, now)).toEqual({
      active: true,
      reason: 'The latest checkpoint needed repeated temporary source retries.',
      resumesAt: '2026-08-23T12:14:00.000Z',
    })
    expect(tennisRecordCadenceSafetyStatus({
      completed_at: '2026-08-23T11:59:00.000Z',
      transient_retries: 4,
    }, Date.parse('2026-08-23T12:14:00.000Z'))).toEqual({ active: false, reason: null, resumesAt: null })
    expect(tennisRecordCadenceSafetyStatus({ completed_at: '2026-08-23T11:59:00.000Z' }, now)).toEqual({ active: false, reason: null, resumesAt: null })
  })

  it('retries only transient source failures and quarantines them after the bounded limit', () => {
    expect(tennisRecordFailureDisposition('fetch failed', 0)).toBe('retry')
    expect(tennisRecordFailureDisposition('network timeout', 2)).toBe('retry')
    expect(tennisRecordFailureDisposition('fetch failed', 3)).toBe('quarantine')
    expect(tennisRecordFailureDisposition('Unexpected result-page markup', 0)).toBe('quarantine')
  })

  it('schedules only bounded deferred retries for exhausted transport failures', () => {
    const now = Date.parse('2026-08-22T12:00:00.000Z')
    expect(tennisRecordDeferredRetryAt('fetch failed', 0, now)).toBe('2026-08-22T18:00:00.000Z')
    expect(tennisRecordDeferredRetryAt('network timeout', 1, now)).toBe('2026-08-23T12:00:00.000Z')
    expect(tennisRecordDeferredRetryAt('fetch failed', 2, now)).toBeNull()
    expect(tennisRecordDeferredRetryAt('Access block detected', 0, now)).toBeNull()
  })

  it('reclaims only runs that have exceeded the serverless recovery window', () => {
    const now = Date.parse('2026-08-22T12:10:00.000Z')
    expect(isTennisRecordRunStale('2026-08-22T12:00:01.000Z', now)).toBe(false)
    expect(isTennisRecordRunStale('2026-08-22T12:00:00.000Z', now)).toBe(true)
    expect(isTennisRecordRunStale('not-a-date', now)).toBe(true)
  })

  it('keeps terminal queue rows terminal when source evidence is rediscovered', () => {
    const knownPlayer = 'https://www.tennisrecord.com/adult/profile.aspx?playername=Known+Player'
    const newMatch = 'https://www.tennisrecord.com/adult/matchresults.aspx?mid=987&year=2026'
    const plan = buildTennisRecordQueueDiscoveryPlan(
      [knownPlayer, newMatch, knownPlayer, 'https://www.tennisrecord.com/adult/search.aspx'],
      [knownPlayer],
      'campaign-1',
      '2026-08-22T12:00:00.000Z',
    )
    expect(plan.rediscoveredUrls).toEqual([knownPlayer])
    expect(plan.newRows).toEqual([expect.objectContaining({
      source_url: newMatch,
      page_kind: 'match',
      status: 'pending',
      campaign_id: 'campaign-1',
      last_seen_at: '2026-08-22T12:00:00.000Z',
    })])
  })

})
