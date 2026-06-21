import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildRoundRobinPreview,
  buildRoundRobinStandings,
  buildSingleEliminationPreview,
  buildTournamentScheduleEvents,
  buildTiqTournamentAlertDraft,
  summarizeTournamentResults,
  clearTiqTournamentMatchResult,
  getTournamentLimitSummary,
  normalizeTiqTournamentAlertKind,
  normalizeTiqTournamentAlertStatus,
  normalizeTiqTournamentEntryStatus,
  normalizeTiqTournamentFormat,
  parseTournamentEntrantsInput,
  updateTiqTournamentEntrantPlayerIds,
  updateTiqTournamentMatchSchedule,
  updateTiqTournamentMatchResult,
  updateTiqTournamentParticipantContact,
  writeTiqTournamentRegistry,
} from '../tiq-tournament-registry'
import { getTiqTournamentMessagingProviderState } from '../tiq-tournament-messaging'

describe('TIQ tournament registry helpers', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => {
        store.clear()
      },
    }
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('window', { localStorage: storage })
  })

  it('normalizes tournament setup inputs', () => {
    expect(normalizeTiqTournamentFormat('round_robin')).toBe('round_robin')
    expect(normalizeTiqTournamentFormat('unknown')).toBe('single_elimination')
    expect(parseTournamentEntrantsInput('Avery Stone\nBlake Carter, Casey Nguyen\nAvery Stone')).toEqual([
      'Avery Stone',
      'Blake Carter',
      'Casey Nguyen',
    ])
  })

  it('builds a seeded single-elimination draw with byes', () => {
    expect(buildSingleEliminationPreview(['Seed 1', 'Seed 2', 'Seed 3'])).toMatchObject([
      { round: 1, court: 1, sideA: 'Seed 1', sideB: 'Bye' },
      { round: 1, court: 2, sideA: 'Seed 2', sideB: 'Seed 3' },
      { round: 2, court: 1, label: 'Final' },
    ])
  })

  it('advances recorded winners into later single-elimination rounds', () => {
    const preview = buildSingleEliminationPreview(['Seed 1', 'Seed 2', 'Seed 3', 'Seed 4'], {
      'r1-m1': { winner: 'Seed 1', score: '6-3 6-4', updatedAt: 'now' },
      'r1-m2': { winner: 'Seed 2', score: '7-5 6-2', updatedAt: 'now' },
    })

    expect(preview.find((match) => match.id === 'r2-m1')).toMatchObject({
      sideA: 'Seed 1',
      sideB: 'Seed 2',
    })
  })

  it('builds round-robin pairings without bye matches', () => {
    const preview = buildRoundRobinPreview(['A', 'B', 'C'])

    expect(preview).toHaveLength(3)
    expect(preview.map((match) => `${match.sideA}-${match.sideB}`)).not.toContain('Bye-A')
  })

  it('builds round-robin standings from recorded winners', () => {
    expect(buildRoundRobinStandings({
      format: 'round_robin',
      entrants: ['A', 'B', 'C'],
      results: {
        'r1-m2': { winner: 'B', score: '6-4 6-4', updatedAt: 'now' },
        'r2-m1': { winner: 'A', score: '6-2 6-2', updatedAt: 'now' },
        'r3-m1': { winner: 'A', score: '7-5 7-5', updatedAt: 'now' },
      },
    })).toMatchObject([
      { entrant: 'A', played: 2, wins: 2, losses: 0, gamesWon: 26, gamesLost: 14, gameDiff: 12, winPct: 100 },
      { entrant: 'B', played: 2, wins: 1, losses: 1, gamesWon: 22, gamesLost: 22, gameDiff: 0, winPct: 50 },
      { entrant: 'C', played: 2, wins: 0, losses: 2, gamesWon: 12, gamesLost: 24, gameDiff: -12, winPct: 0 },
    ])
  })

  it('uses round-robin game differential as a standings tiebreak', () => {
    expect(buildRoundRobinStandings({
      format: 'round_robin',
      entrants: ['A', 'B', 'C'],
      results: {
        'r1-m2': { winner: 'B', score: '6-0 6-0', updatedAt: 'now' },
        'r2-m1': { winner: 'C', score: '4-6 4-6', updatedAt: 'now' },
        'r3-m1': { winner: 'A', score: '6-4 6-4', updatedAt: 'now' },
      },
    })).toMatchObject([
      { entrant: 'B', wins: 1, losses: 1, gameDiff: 8 },
      { entrant: 'A', wins: 1, losses: 1, gameDiff: 0 },
      { entrant: 'C', wins: 1, losses: 1, gameDiff: -8 },
    ])
  })

  it('labels League and Full-Court tournament limits', () => {
    expect(getTournamentLimitSummary(false)).toContain('one tournament room')
    expect(getTournamentLimitSummary(false)).not.toContain('tournament workspace')
    expect(getTournamentLimitSummary(true)).toContain('Unlimited')
  })

  it('normalizes public tournament entry status', () => {
    expect(normalizeTiqTournamentEntryStatus('approved')).toBe('approved')
    expect(normalizeTiqTournamentEntryStatus('declined')).toBe('declined')
    expect(normalizeTiqTournamentEntryStatus('unknown')).toBe('pending')
  })

  it('normalizes tournament alert audit fields', () => {
    expect(normalizeTiqTournamentAlertKind('rules')).toBe('rules')
    expect(normalizeTiqTournamentAlertKind('unknown')).toBe('court_ready')
    expect(normalizeTiqTournamentAlertStatus('sent')).toBe('sent')
    expect(normalizeTiqTournamentAlertStatus('unknown')).toBe('draft')
  })

  it('summarizes completed tournament results', () => {
    expect(summarizeTournamentResults({
      format: 'single_elimination',
      entrants: ['A', 'B'],
      results: {
        'r1-m1': { winner: 'A', score: '6-4 6-4', updatedAt: 'now' },
      },
    })).toMatchObject({
      totalMatches: 1,
      completedMatches: 1,
      openMatches: 0,
      champion: 'A',
    })
  })

  it('clears downstream bracket results when an earlier match changes', () => {
    localStorage.clear()
    writeTiqTournamentRegistry([{
      id: 'city-open',
      name: 'City Open',
      format: 'single_elimination',
      entrantType: 'players',
      status: 'scheduled',
      startsOn: '',
      locationLabel: '',
      directorNotes: '',
      entrants: ['A', 'B', 'C', 'D'],
      results: {
        'r1-m1': { winner: 'A', score: '6-4 6-4', updatedAt: 'now' },
        'r1-m2': { winner: 'B', score: '6-4 6-4', updatedAt: 'now' },
        'r2-m1': { winner: 'A', score: '7-5 7-5', updatedAt: 'now' },
      },
      schedule: {},
      contacts: {},
      entrantPlayerIds: {},
      isPublic: true,
      createdAt: 'now',
      updatedAt: 'now',
    }])

    const updated = updateTiqTournamentMatchResult({
      tournamentId: 'city-open',
      matchId: 'r1-m1',
      winner: 'D',
      score: '6-0 6-0',
    })

    expect(updated?.results['r1-m1']).toMatchObject({ winner: 'D' })
    expect(updated?.results['r2-m1']).toBeUndefined()
  })

  it('clears dependent bracket results when an earlier match is cleared', () => {
    localStorage.clear()
    writeTiqTournamentRegistry([{
      id: 'city-open',
      name: 'City Open',
      format: 'single_elimination',
      entrantType: 'players',
      status: 'scheduled',
      startsOn: '',
      locationLabel: '',
      directorNotes: '',
      entrants: ['A', 'B', 'C', 'D'],
      results: {
        'r1-m1': { winner: 'A', score: '6-4 6-4', updatedAt: 'now' },
        'r1-m2': { winner: 'B', score: '6-4 6-4', updatedAt: 'now' },
        'r2-m1': { winner: 'A', score: '7-5 7-5', updatedAt: 'now' },
      },
      schedule: {},
      contacts: {},
      entrantPlayerIds: {},
      isPublic: true,
      createdAt: 'now',
      updatedAt: 'now',
    }])

    const updated = clearTiqTournamentMatchResult('city-open', 'r1-m1')

    expect(updated?.results['r1-m1']).toBeUndefined()
    expect(updated?.results['r2-m1']).toBeUndefined()
    expect(updated?.results['r1-m2']).toMatchObject({ winner: 'B' })
  })

  it('keeps cloud tournament storage shareable and creator-managed', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260524000100_create_tiq_tournaments.sql'),
      'utf8',
    )
    const scheduleMigration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260525000100_add_tiq_tournament_schedule.sql'),
      'utf8',
    )
    const contactsMigration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260525000200_add_tiq_tournament_contacts.sql'),
      'utf8',
    )
    const entrantPlayerIdsMigration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260525000300_add_tiq_tournament_entrant_player_ids.sql'),
      'utf8',
    )
    const entriesMigration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260525000500_create_tiq_tournament_entries.sql'),
      'utf8',
    )
    const alertsMigration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260525000600_create_tiq_tournament_alerts.sql'),
      'utf8',
    )
    const preferenceEventsMigration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260525000800_create_tiq_tournament_preference_events.sql'),
      'utf8',
    )

    expect(migration).toContain('create table if not exists public.tiq_tournaments')
    expect(migration).toContain('results jsonb not null default')
    expect(migration).toContain('is_public boolean not null default false')
    expect(migration).toContain('created_by_user_id uuid references auth.users')
    expect(migration).toContain('Public TIQ tournaments are readable')
    expect(migration).toContain('Creators can update TIQ tournaments')
    expect(scheduleMigration).toContain('schedule jsonb not null default')
    expect(contactsMigration).toContain('contacts jsonb not null default')
    expect(entrantPlayerIdsMigration).toContain('entrant_player_ids jsonb not null default')
    expect(entriesMigration).toContain('create table if not exists public.tiq_tournament_entries')
    expect(entriesMigration).toContain('Public can submit TIQ tournament entries')
    expect(entriesMigration).toContain('Tournament creators can update entries')
    expect(alertsMigration).toContain('create table if not exists public.tiq_tournament_alerts')
    expect(alertsMigration).toContain('Tournament creators can create alert drafts')
    expect(alertsMigration).toContain('opted_in_count integer not null default 0')
    expect(readFileSync(
      join(process.cwd(), 'supabase/migrations/20260525000700_add_tiq_tournament_alert_queue_fields.sql'),
      'utf8',
    )).toContain('queued_at timestamptz')
    expect(preferenceEventsMigration).toContain('create table if not exists public.tiq_tournament_preference_events')
    expect(preferenceEventsMigration).toContain('Tournament creators can read preference events')
  })

  it('keeps the tournament scorebook ready for score entry', () => {
    const workspace = readFileSync(
      join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'),
      'utf8',
    )

    expect(workspace).toContain('const [scoreInputs, setScoreInputs]')
    expect(workspace).toContain('placeholder="6-4 6-4"')
    expect(workspace).toContain('score,')
    expect(workspace).toContain('buildScoreInputState')
  })

  it('keeps public tournament registration connected to director approval', () => {
    const publicPage = readFileSync(
      join(process.cwd(), 'app/tournaments/[id]/page.tsx'),
      'utf8',
    )
    const workspace = readFileSync(
      join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'),
      'utf8',
    )
    const preferencesPage = readFileSync(
      join(process.cwd(), 'app/tournaments/[id]/preferences/page.tsx'),
      'utf8',
    )
    const preferencesApi = readFileSync(
      join(process.cwd(), 'app/api/tournaments/preferences/route.ts'),
      'utf8',
    )
    const alertPreviewApi = readFileSync(
      join(process.cwd(), 'app/api/tournaments/alerts/preview/route.ts'),
      'utf8',
    )
    const messagingHelper = readFileSync(
      join(process.cwd(), 'lib/tiq-tournament-messaging.ts'),
      'utf8',
    )

    expect(publicPage).toContain('Submit entry')
    expect(publicPage).toContain('Text me tournament alerts')
    expect(publicPage).toContain('Tournament hub')
    expect(publicPage).toContain('Player check-in')
    expect(publicPage).toContain('Court board')
    expect(publicPage).toContain('Match-day actions')
    expect(publicPage).toContain('Alert settings')
    expect(publicPage).toContain('Find yours')
    expect(publicPage).toContain('playerRailCardStyle')
    expect(publicPage).toContain('id="podium"')
    expect(publicPage).toContain('#profile-trophy-case')
    expect(publicPage).toContain('Trophy case')
    expect(publicPage).toContain('Trophy case starts when the player profile is linked.')
    expect(publicPage).toContain('getPublicTournamentStatus')
    expect(publicPage).toContain('statusRailStyle')
    expect(publicPage).toContain('scheduledMatches')
    expect(publicPage).toContain('id="draw"')
    expect(publicPage).toContain('id="enter-tournament"')
    expect(workspace).toContain('Entry queue')
    expect(workspace).toContain('Director run sheet')
    expect(workspace).toContain('directorFlowItems')
    expect(workspace).toContain("href: '#tournament-scorebook'")
    expect(workspace).toContain('id="tournament-entries"')
    expect(workspace).toContain('id="tournament-profiles"')
    expect(workspace).toContain('id="tournament-awards"')
    expect(workspace).toContain('awardCertificatePreviewStyle')
    expect(workspace).toContain('Trophy case')
    expect(workspace).toContain('Certificate')
    expect(workspace).toContain('buildAwardCertificateUrl')
    expect(workspace).toContain('Open certificate:')
    expect(workspace).toContain('#profile-trophy-case')
    expect(workspace).toContain('Profile needed')
    expect(workspace).toContain('formatAwardIssuedAt')
    expect(workspace).toContain('const [entryCounts, setEntryCounts]')
    expect(workspace).toContain('Review entries')
    expect(workspace).toContain('Save alert draft')
    expect(workspace).toContain('loadTiqTournamentAlertRecordsForUser')
    expect(workspace).toContain('queueTiqTournamentAlertRecordForUser')
    expect(workspace).toContain('Queue')
    expect(workspace).toContain('Preview delivery')
    expect(workspace).toContain('No opted-in recipients found.')
    expect(workspace).toContain('alertRecipientPreviewListStyle')
    expect(workspace).toContain('alertSkippedPreviewListStyle')
    expect(workspace).toContain('focusParticipantContact')
    expect(workspace).toContain('Confirm opt-in')
    expect(workspace).toContain('highlightedContactCardStyle')
    expect(workspace).toContain('loadTiqTournamentPreferenceEventsForUser')
    expect(workspace).toContain('Consent audit')
    expect(workspace).toContain('Send readiness')
    expect(workspace).toContain('Delivery queue')
    expect(workspace).toContain('formatAlertStatus')
    expect(workspace).toContain('buildAlertMessageSnippet')
    expect(workspace).toContain('alertStatusQueuedStyle')
    expect(workspace).toContain('getTiqTournamentMessagingProviderState')
    expect(workspace).toContain('providerState.blocker')
    expect(workspace).toContain('Preference changes from tournament links will appear here.')
    expect(workspace).toContain('/preferences')
    expect(preferencesPage).toContain('Turn alerts off')
    expect(preferencesPage).toContain('Court alerts')
    expect(preferencesPage).toContain('Reply STOP anytime')
    expect(preferencesPage).toContain('Back to tournament')
    expect(preferencesPage).toContain('consentGridStyle')
    expect(preferencesPage).toContain('secondaryButtonStyle')
    expect(preferencesApi).toContain('Participant opted out from tournament link.')
    expect(preferencesApi).toContain('tiq_tournament_preference_events')
    expect(preferencesApi).toContain("action: smsOptIn ? 'opt_in' : 'opt_out'")
    expect(alertPreviewApi).toContain('providerState.mode')
    expect(alertPreviewApi).toContain('providerState.provider')
    expect(messagingHelper).toContain('No SMS was sent')
    expect(messagingHelper).toContain('NEXT_PUBLIC_TIQ_TOURNAMENT_SMS_ENABLED')
    expect(alertPreviewApi).toContain("alert.status !== 'queued'")
    expect(alertPreviewApi).toContain('skippedRecipients')
    expect(alertPreviewApi).toContain('missing consent')
    expect(alertPreviewApi).toContain('missing phone')
    expect(workspace).toContain('approveTournamentEntry')
    expect(workspace).toContain("updateTiqTournamentEntryStatus(entry.id, 'approved'")
  })

  it('keeps tournament SMS delivery behind an explicit provider gate', () => {
    vi.stubEnv('NEXT_PUBLIC_TIQ_TOURNAMENT_SMS_PROVIDER', '')
    vi.stubEnv('NEXT_PUBLIC_TIQ_TOURNAMENT_SMS_ENABLED', '')

    expect(getTiqTournamentMessagingProviderState()).toMatchObject({
      mode: 'sandbox',
      provider: 'disabled',
      enabled: false,
      label: 'Sandbox',
    })

    vi.stubEnv('NEXT_PUBLIC_TIQ_TOURNAMENT_SMS_PROVIDER', 'twilio')
    vi.stubEnv('NEXT_PUBLIC_TIQ_TOURNAMENT_SMS_ENABLED', 'true')

    expect(getTiqTournamentMessagingProviderState()).toMatchObject({
      mode: 'ready',
      provider: 'twilio',
      enabled: true,
      label: 'Provider ready',
    })
  })

  it('saves tournament match schedule slots', () => {
    localStorage.clear()
    writeTiqTournamentRegistry([{
      id: 'city-open',
      name: 'City Open',
      format: 'single_elimination',
      entrantType: 'players',
      status: 'draft',
      startsOn: '',
      locationLabel: '',
      directorNotes: '',
      entrants: ['A', 'B'],
      results: {},
      schedule: {},
      contacts: {},
      entrantPlayerIds: {},
      isPublic: true,
      createdAt: 'now',
      updatedAt: 'now',
    }])

    const updated = updateTiqTournamentMatchSchedule({
      tournamentId: 'city-open',
      matchId: 'r1-m1',
      date: '2026-06-01',
      time: '18:30',
      court: 'Court 2',
    })

    expect(updated?.schedule['r1-m1']).toMatchObject({
      date: '2026-06-01',
      time: '18:30',
      court: 'Court 2',
    })
    expect(updated?.status).toBe('scheduled')
    expect(buildSingleEliminationPreview(updated!.entrants, updated!.results, updated!.schedule)[0]?.schedule).toMatchObject({ court: 'Court 2' })
  })

  it('builds tournament calendar events from scheduled matches', () => {
    const events = buildTournamentScheduleEvents([{
      id: 'city-open',
      name: 'City Open',
      format: 'single_elimination',
      entrantType: 'players',
      status: 'scheduled',
      startsOn: '',
      locationLabel: '',
      directorNotes: '',
      entrants: ['A', 'B'],
      results: {
        'r1-m1': { winner: 'A', score: '6-4 6-4', updatedAt: 'now' },
      },
      schedule: {
        'r1-m1': { date: '2026-06-01', time: '18:30', court: 'Court 2', updatedAt: 'now' },
      },
      contacts: {},
      entrantPlayerIds: {},
      isPublic: true,
      createdAt: 'now',
      updatedAt: 'now',
    }])

    expect(events).toMatchObject([{
      tournamentId: 'city-open',
      tournamentName: 'City Open',
      matchId: 'r1-m1',
      sideA: 'A',
      sideB: 'B',
      date: '2026-06-01',
      time: '18:30',
      court: 'Court 2',
      winner: 'A',
    }])
  })

  it('saves participant SMS consent details and drafts linked alerts', () => {
    localStorage.clear()
    writeTiqTournamentRegistry([{
      id: 'city-open',
      name: 'City Open',
      format: 'single_elimination',
      entrantType: 'players',
      status: 'scheduled',
      startsOn: '',
      locationLabel: '',
      directorNotes: 'Use no-ad scoring.',
      entrants: ['A', 'B'],
      results: {},
      schedule: {},
      contacts: {},
      entrantPlayerIds: {},
      isPublic: true,
      createdAt: 'now',
      updatedAt: 'now',
    }])

    const updated = updateTiqTournamentParticipantContact({
      tournamentId: 'city-open',
      entrantName: 'A',
      phone: '(555) 555-1212 ext drop',
      smsOptIn: true,
      consentNote: 'Online signup',
    })

    expect(updated?.contacts.A).toMatchObject({
      phone: '(555) 555-1212',
      smsOptIn: true,
      consentNote: 'Online signup',
    })

    expect(buildTiqTournamentAlertDraft({
      record: updated!,
      kind: 'rules',
      siteUrl: 'https://www.tenaceiq.com/tournaments/city-open',
    })).toContain('View details: https://www.tenaceiq.com/tournaments/city-open')
    expect(buildTiqTournamentAlertDraft({
      record: updated!,
      kind: 'rules',
      siteUrl: 'https://www.tenaceiq.com/tournaments/city-open',
    })).toContain('Reply STOP to opt out.')
    expect(buildTiqTournamentAlertDraft({
      record: updated!,
      kind: 'rules',
      siteUrl: 'https://www.tenaceiq.com/tournaments/city-open',
    })).toContain('Manage alerts: https://www.tenaceiq.com/tournaments/city-open/preferences')
  })

  it('links tournament entrants to TIQ player profiles', () => {
    localStorage.clear()
    writeTiqTournamentRegistry([{
      id: 'city-open',
      name: 'City Open',
      format: 'single_elimination',
      entrantType: 'players',
      status: 'scheduled',
      startsOn: '',
      locationLabel: '',
      directorNotes: '',
      entrants: ['A', 'B'],
      results: {},
      schedule: {},
      contacts: {},
      entrantPlayerIds: {},
      isPublic: true,
      createdAt: 'now',
      updatedAt: 'now',
    }])

    const updated = updateTiqTournamentEntrantPlayerIds('city-open', {
      A: 'player-a',
      B: 'player-b',
      C: 'ignored-player',
    })

    expect(updated?.entrantPlayerIds).toEqual({
      A: 'player-a',
      B: 'player-b',
    })
  })
})
