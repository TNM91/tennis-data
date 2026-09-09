import { expect, test, type Page, type Route } from '@playwright/test'
import { buildCaptainScorecardImportRow, type CaptainScorecardInput } from '../../lib/captain-scorecard'

const SUPABASE_PROJECT = 'pwxppfazbyourjrsutgx'
const TEAM = 'Regression Aces'
const LEAGUE = '2026 STL Tri-Level 18 & Over'
const FLIGHT = 'Men 3.5/4.0/4.5'
const MATCH_DATE = '2026-09-14'
const OPPONENT = 'Baseline Club'
const MATCH_ID = 'match-1'
const NEXT_MATCH_DATE = '2026-09-21'
const NEXT_OPPONENT = 'Second Serve Club'

const opponentPlayers = [
  'Jordan Rally',
  'Morgan Matchpoint',
  'Parker Passing Shot',
  'Quinn Quick Volley',
  'Riley Return',
  'Skyler Smash',
] as const

const players = [
  ['p1', 'Alex Ace', 3.5],
  ['p2', 'Blake Baseline', 3.5],
  ['p3', 'Casey Court', 4.0],
  ['p4', 'Drew Deuce', 4.0],
  ['p5', 'Emery Volley', 4.5],
  ['p6', 'Finley First Serve', 4.5],
] as const

const teamSlots = [
  slot('tl-d-3-5', '3.5 Doubles', 3.5, players[0], players[1]),
  slot('tl-d-4-0', '4.0 Doubles', 4.0, players[2], players[3]),
  slot('tl-d-4-5', '4.5 Doubles', 4.5, players[4], players[5]),
]

const cloudDraft = {
  competitionLayer: 'usta',
  teamName: TEAM,
  leagueName: LEAGUE,
  flight: FLIGHT,
  matchDate: MATCH_DATE,
  opponentTeam: OPPONENT,
  selectedMatchId: MATCH_ID,
  matchFormat: 'auto',
  scenarioId: 'scenario-1',
  scenarioName: 'Captain weekly regression',
  notes: '',
  teamSlots,
  opponentSlots: [],
  manualRosterEntries: [],
  matchDetails: {
    location: 'Forest Park Tennis Center',
    directions: '',
    arrivalTime: '5:30 PM',
    notes: '',
  },
  updatedAt: '2026-09-09T16:00:00.000Z',
}

type JourneyState = {
  delivered: boolean
  deliveredAt: string
  roomActions: Array<Record<string, unknown>>
  draftUpdates: Array<Record<string, unknown>>
}

type PostMatchState = {
  saved: boolean
  submissions: Array<Record<string, unknown>>
}

test.describe('captain weekly continuity', () => {
  test('keeps a confirmed lineup intact through send, refresh, and My Teams', async ({ page }) => {
    const state: JourneyState = {
      delivered: false,
      deliveredAt: '',
      roomActions: [],
      draftUpdates: [],
    }

    await seedCaptainSession(page)
    await mockCaptainJourney(page, state)
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

    await page.goto(builderHref())

    await expect(page.getByRole('heading', { name: /Build (a potential lineup|your team courts)/i }).first()).toBeVisible()
    if ((page.viewportSize()?.width || 0) <= 700) {
      for (const court of teamSlots) {
        await expect(page.getByRole('button').filter({
          hasText: court.players.map((player) => player.playerName).join(' · '),
        })).toBeVisible()
      }
    } else {
      for (const court of teamSlots) {
        await expect(page.getByRole('combobox', { name: `${court.label} player 1` })).toHaveValue(court.players[0].playerId)
        await expect(page.getByRole('combobox', { name: `${court.label} player 2` })).toHaveValue(court.players[1].playerId)
      }
    }
    const sendStep = page.getByRole('button', { name: 'Post the final lineup to Team Chat' })
    await expect(sendStep).toBeEnabled()

    await page.getByRole('button', { name: 'Post to Team Chat' }).click()

    await expect(page.getByText('Your confirmed lineup is in Team Chat.')).toBeVisible()
    await expect(page.getByText('Sent to team', { exact: true }).first()).toBeVisible()
    await expect(sendStep).toBeDisabled()

    expect(state.roomActions.map((action) => action.action)).toEqual(['post_match_card', 'send_final_lineup'])
    expect(state.draftUpdates.filter((update) => update.status === 'final').length).toBeGreaterThanOrEqual(1)
    const deliveryUpdates = state.draftUpdates.filter((update) => update.deliveryStatus === 'sent')
    expect(deliveryUpdates).toHaveLength(1)
    expect(deliveryUpdates[0]).toMatchObject({
      status: 'final',
      deliveryStatus: 'sent',
      teamRoomMessageId: 'message-1',
    })

    await page.getByRole('button', { name: 'Copy lineup text' }).click()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toContain(TEAM)
    expect(copied).toContain(OPPONENT)
    expect(copied).toContain('Alex Ace')
    expect(copied).toContain('Finley First Serve')
    expect(copied).toContain('/team-room')

    const imageHref = await page.getByRole('link', { name: 'Create image + text team' }).getAttribute('href')
    const printHref = await page.getByRole('link', { name: 'Print lineup / scorecard' }).getAttribute('href')
    expect(imageHref).toContain('/captain/matchup-sheet')
    expect(imageHref).toContain('confirmed=1')
    expect(printHref).toContain('confirmed=1')
    expect(printHref).toContain('print=1')

    const teamChatHref = await page.getByRole('link', { name: 'Open Team Chat' }).first().getAttribute('href')
    expect(teamChatHref).toContain('room-1')
    expect(teamChatHref).toContain('message-1')
    expect(teamChatHref).toContain('#match-card-message-1')

    await page.reload()
    await expect(page.getByText('Your confirmed lineup is in Team Chat.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Post the final lineup to Team Chat' })).toBeDisabled()
    expect(state.roomActions).toHaveLength(2)

    await page.goto('/compete/teams')
    await expect(page.getByRole('heading', { name: TEAM })).toBeVisible()
    await expect(page.getByText('Sent to team', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /View sent lineup/ }).first()).toBeVisible()
    await expect(page.getByText(`vs ${OPPONENT} · Sep 14`, { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  })

  test('lets a guest answer and add the match to a calendar without an account', async ({ page }) => {
    const submissions: Array<Record<string, unknown>> = []

    await page.route('**/api/captain/availability-requests/guest-alex', async (route) => {
      if (route.request().method() === 'POST') {
        expect(route.request().headers().authorization).toBeUndefined()
        submissions.push(route.request().postDataJSON() as Record<string, unknown>)
        await json(route, { ok: true })
        return
      }

      await json(route, {
        lockedPlayer: { playerId: 'p1', playerName: 'Alex Ace' },
        request: {
          teamName: TEAM,
          leagueName: LEAGUE,
          flight: FLIGHT,
          matchDate: MATCH_DATE,
          opponentTeam: OPPONENT,
          matchTime: '6:00 PM',
          facility: 'Forest Park Tennis Center, St. Louis, MO',
          invitedPlayers: players.map(([playerId, playerName]) => ({ playerId, playerName })),
        },
        matches: [{
          id: MATCH_ID,
          matchDate: MATCH_DATE,
          matchTime: '6:00 PM',
          facility: 'Forest Park Tennis Center, St. Louis, MO',
          opponent: OPPONENT,
        }],
        responses: [],
      })
    })

    await page.goto('/availability/guest-alex')
    await expect(page.getByText('Responding as Alex Ace')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Yes, I’m in' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add to Google Calendar' })).toHaveAttribute('href', /calendar\.google\.com/)
    await expect(page.getByRole('link', { name: 'Add calendar reminder' })).toHaveAttribute('href', /calendar\.ics/)
    await expect(page.getByRole('link', { name: 'Open directions' })).toHaveAttribute('href', /maps/)

    await page.getByRole('button', { name: 'Yes, I’m in' }).click()
    await expect(page.getByRole('status')).toContainText('your response was saved')
    expect(submissions).toEqual([{
      playerId: 'p1',
      playerName: 'Alex Ace',
      notes: '',
      responses: [{ matchDate: MATCH_DATE, status: 'available' }],
    }])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  })

  test('records a deciding match tiebreak and advances Team Chat to the next match', async ({ page }) => {
    const state: PostMatchState = { saved: false, submissions: [] }

    await seedCaptainSession(page)
    await mockPostMatchJourney(page, state)

    await page.goto(scorecardHref())

    await expect(page.getByRole('heading', { name: 'Record the result.' })).toBeVisible()
    await expect(page.getByText('Loaded 3 saved courts from Team Chat.', { exact: true })).toBeVisible()

    const scores = ['6-4 6-7 10-8', '3-6 4-6', '7-6 6-4']
    for (const [index, court] of teamSlots.entries()) {
      const courtCard = page.locator('article').filter({ hasText: court.label }).first()
      if (index > 0) await courtCard.getByRole('button', { name: 'Enter result' }).click()

      const opponentSelects = courtCard.getByLabel(`Choose an opponent for ${court.label}`)
      await opponentSelects.nth(0).selectOption(opponentPlayers[index * 2])
      await opponentSelects.nth(1).selectOption(opponentPlayers[index * 2 + 1])
      await courtCard.getByPlaceholder('6-4 3-6 10-8').fill(scores[index])
      await courtCard.getByRole('button', { name: index === 1 ? 'They won' : 'We won' }).click()
      await courtCard.getByRole('button', { name: 'Done for now' }).click()
    }

    await expect(page.getByText('3/3 ready to submit')).toBeVisible()
    await page.getByRole('button', { name: 'Submit final result' }).click()

    await expect(page.getByRole('heading', { name: 'Match won.' })).toBeVisible()
    await expect(page.getByText('Won · 6-4 6-7 10-8')).toBeVisible()
    await expect(page.getByText('Match record protected')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Team update posted' })).toBeVisible()

    expect(state.submissions).toHaveLength(1)
    expect(state.submissions[0]).toMatchObject({
      teamName: TEAM,
      opponentTeam: OPPONENT,
      matchDate: MATCH_DATE,
      lines: [
        {
          courtNumber: 1,
          label: '3.5 Doubles',
          teamPlayers: ['Alex Ace', 'Blake Baseline'],
          opponentPlayers: ['Jordan Rally', 'Morgan Matchpoint'],
          outcome: 'team',
          score: '6-4 6-7 10-8',
        },
        {
          courtNumber: 2,
          label: '4.0 Doubles',
          outcome: 'opponent',
          score: '3-6 4-6',
        },
        {
          courtNumber: 3,
          label: '4.5 Doubles',
          outcome: 'team',
          score: '7-6 6-4',
        },
      ],
    })
    const importRow = buildCaptainScorecardImportRow(
      state.submissions[0] as CaptainScorecardInput,
      'captain-scorecard:regression-match',
    )
    expect(importRow.lines[0]).toMatchObject({
      winnerSide: 'A',
      score: '6-4 6-7 10-8',
      scoreEventType: 'third_set_match_tiebreak',
      evidenceClass: 'locked',
    })
    expect(importRow.lines[1]).toMatchObject({ winnerSide: 'B', scoreEventType: 'standard' })
    expect(await page.evaluate(() => Object.keys(window.localStorage).filter((key) => key.startsWith('tiq:captain-scorecard-draft:')))).toEqual([])

    await page.getByRole('link', { name: 'View team update' }).click()

    await expect(page.getByText('Final result', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Won 2–1 · Scorecard linked')).toBeVisible()
    await page.getByText('Court results', { exact: true }).click()
    await expect(page.getByText('6-4 6-7 10-8')).toBeVisible()
    await expect(page.getByText(NEXT_OPPONENT, { exact: false }).first()).toBeVisible()
    await expect(page.getByText('Sep 21', { exact: false }).first()).toBeVisible()
    await expect(page.getByText(OPPONENT, { exact: false }).first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  })
})

function slot(
  id: string,
  label: string,
  ratingLevel: number,
  first: readonly [string, string, number],
  second: readonly [string, string, number],
) {
  return {
    id,
    label,
    slotType: 'doubles' as const,
    ratingLevel,
    players: [
      { playerId: first[0], playerName: first[1] },
      { playerId: second[0], playerName: second[1] },
    ],
  }
}

function builderHref() {
  const params = new URLSearchParams({
    layer: 'usta',
    team: TEAM,
    league: LEAGUE,
    flight: FLIGHT,
    date: MATCH_DATE,
    opponent: OPPONENT,
    match: MATCH_ID,
  })
  return `/captain/lineup-builder?${params.toString()}`
}

function scorecardHref() {
  const params = new URLSearchParams({
    layer: 'usta',
    team: TEAM,
    league: LEAGUE,
    flight: FLIGHT,
    date: MATCH_DATE,
    opponent: OPPONENT,
    time: '6:00 PM',
    facility: 'Forest Park Tennis Center',
  })
  return `/captain/record-result?${params.toString()}`
}

async function seedCaptainSession(page: Page) {
  const now = Math.floor(Date.now() / 1000)
  const accessToken = jwt({
    aud: 'authenticated',
    exp: now + 24 * 60 * 60,
    iat: now,
    role: 'authenticated',
    sub: 'captain-user',
    email: 'captain@regression.test',
  })
  const entitlements = {
    playerPlusSubscriptionActive: true,
    playerPlusSubscriptionStatus: 'active',
    playerPlusAccessExpiresAt: null,
    coachSubscriptionActive: false,
    coachSubscriptionStatus: 'inactive',
    coachAccessExpiresAt: null,
    captainSubscriptionActive: true,
    captainSubscriptionStatus: 'active',
    captainAccessExpiresAt: null,
    tiqTeamLeagueEntryEnabled: true,
    tiqIndividualLeagueCreatorEnabled: false,
    leagueAccessExpiresAt: null,
  }
  const session = {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 24 * 60 * 60,
    expires_at: now + 24 * 60 * 60,
    refresh_token: 'captain-regression-refresh-token',
    user: {
      id: 'captain-user',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'captain@regression.test',
      email_confirmed_at: '2026-01-01T00:00:00.000Z',
      phone: '',
      confirmed_at: '2026-01-01T00:00:00.000Z',
      last_sign_in_at: '2026-09-09T15:00:00.000Z',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      identities: [],
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-09-09T15:00:00.000Z',
      is_anonymous: false,
    },
  }

  await page.addInitScript(({ project, seededSession, seededEntitlements }) => {
    window.localStorage.setItem(`sb-${project}-auth-token`, JSON.stringify(seededSession))
    window.localStorage.setItem('tenaceiq-auth-access:v2:captain-user', JSON.stringify({
      cachedAt: Date.now(),
      role: 'captain',
      entitlements: seededEntitlements,
    }))
  }, { project: SUPABASE_PROJECT, seededSession: session, seededEntitlements: entitlements })
}

async function mockCaptainJourney(page: Page, state: JourneyState) {
  const connection = {
    id: 'connection-1',
    sourceType: 'data_assist_import',
    sourceRecordId: 'source-1',
    teamName: TEAM,
    leagueName: LEAGUE,
    flight: FLIGHT,
    role: 'captain',
    roles: ['player', 'captain'],
    status: 'accepted',
    isRoleUpdate: false,
    declinedRoles: [],
    roleAcceptedAt: { captain: '2026-09-01T12:00:00.000Z' },
    matchedPlayerId: 'p1',
    isDefault: true,
    archivedAt: '',
    updatedAt: '2026-09-09T16:00:00.000Z',
  }
  const lineupPayload = {
    ok: true,
    players: players.map(([id, name, rating]) => ({
      id,
      name,
      location: 'St. Louis, MO',
      flight: FLIGHT,
      preferred_role: 'Doubles',
      lineup_notes: null,
      singles_rating: rating,
      singles_dynamic_rating: rating,
      singles_usta_dynamic_rating: rating,
      doubles_rating: rating,
      doubles_dynamic_rating: rating,
      doubles_usta_dynamic_rating: rating,
      overall_rating: rating,
      overall_dynamic_rating: rating,
      overall_usta_dynamic_rating: rating,
      rating_source: 'usta',
      mixed_pair_role: null,
      roster_age_division: '18 & Over',
    })),
    matches: [{
      id: MATCH_ID,
      league_name: LEAGUE,
      flight: FLIGHT,
      match_date: MATCH_DATE,
      match_time: '6:00 PM',
      facility: 'Forest Park Tennis Center',
      home_team: TEAM,
      away_team: OPPONENT,
      line_number: null,
    }],
    matchPlayers: players.map(([id], seat) => ({ match_id: MATCH_ID, player_id: id, side: 'A', seat: seat + 1 })),
    historicalLineMatches: [],
    historicalLineMatchPlayers: [],
    rosterMembers: players.map(([id, name]) => ({
      team_name: TEAM,
      player_id: id,
      player_name: name,
      league_name: LEAGUE,
      flight: FLIGHT,
      rating_source: 'usta',
      mixed_pair_role: null,
      age_division: '18 & Over',
    })),
    availability: players.map(([id]) => ({
      id: `availability-${id}`,
      match_id: MATCH_ID,
      match_date: MATCH_DATE,
      team_name: TEAM,
      league_name: LEAGUE,
      flight: FLIGHT,
      player_id: id,
      status: 'available',
      notes: 'Confirmed by player.',
      responded_at: '2026-09-09T15:30:00.000Z',
    })),
    captainRosterContacts: [],
    captainMessageContacts: [],
    savedScenarios: [],
    tiqTeamLeagueFormats: [],
  }

  await page.route(`https://${SUPABASE_PROJECT}.supabase.co/rest/v1/**`, (route) => json(route, []))
  await page.route(`https://${SUPABASE_PROJECT}.supabase.co/auth/v1/**`, async (route) => {
    if (route.request().url().endsWith('/user')) {
      await json(route, { id: 'captain-user', email: 'captain@regression.test' })
      return
    }
    await json(route, {})
  })
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()

    if (url.pathname === '/api/auth/access') {
      await json(route, {
        ok: true,
        access: {
          role: 'captain',
          entitlements: {
            playerPlusSubscriptionActive: true,
            playerPlusSubscriptionStatus: 'active',
            playerPlusAccessExpiresAt: null,
            coachSubscriptionActive: false,
            coachSubscriptionStatus: 'inactive',
            coachAccessExpiresAt: null,
            captainSubscriptionActive: true,
            captainSubscriptionStatus: 'active',
            captainAccessExpiresAt: null,
            tiqTeamLeagueEntryEnabled: true,
            tiqIndividualLeagueCreatorEnabled: false,
            leagueAccessExpiresAt: null,
          },
        },
      })
      return
    }

    if (url.pathname === '/api/team-connections') {
      await json(route, { ok: true, pending: [], connections: [connection] })
      return
    }

    if (url.pathname === '/api/captain/lineup-builder') {
      await json(route, lineupPayload)
      return
    }

    if (url.pathname === '/api/captain/lineup-drafts' && url.searchParams.get('view') === 'summary') {
      await json(route, {
        ok: true,
        summaries: [{
          competitionLayer: 'usta',
          teamName: TEAM,
          leagueName: LEAGUE,
          flight: FLIGHT,
          matchDate: MATCH_DATE,
          opponentTeam: OPPONENT,
          assignedPlayers: 6,
          requiredPlayers: 6,
          completedCourts: 3,
          totalCourts: 3,
          status: state.delivered ? 'final' : 'working',
          deliveryStatus: state.delivered ? 'sent' : 'not_sent',
          deliveredAt: state.deliveredAt,
          updatedAt: cloudDraft.updatedAt,
        }],
      })
      return
    }

    if (url.pathname === '/api/captain/lineup-drafts') {
      if (method === 'GET') {
        await json(route, {
          ok: true,
          draft: cloudDraft,
          delivery: {
            status: state.delivered ? 'sent' : 'not_sent',
            deliveredAt: state.deliveredAt,
            teamRoomMessageId: state.delivered ? 'message-1' : '',
          },
        })
        return
      }
      if (method === 'PATCH') {
        state.draftUpdates.push(request.postDataJSON() as Record<string, unknown>)
        state.delivered = true
        state.deliveredAt = '2026-09-09T16:05:00.000Z'
        await json(route, {
          ok: true,
          delivery: { status: 'sent', deliveredAt: state.deliveredAt, teamRoomMessageId: 'message-1' },
        })
        return
      }
      await json(route, { ok: true })
      return
    }

    if (url.pathname === '/api/team-rooms' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>
      state.roomActions.push(body)
      if (body.action === 'post_match_card') {
        await json(route, {
          ok: true,
          messageId: 'message-1',
          roomId: 'room-1',
          href: `/team-room?room=room-1&team=${encodeURIComponent(TEAM)}`,
        })
        return
      }
      await json(route, { ok: true })
      return
    }

    await json(route, { ok: true })
  })
}

async function mockPostMatchJourney(page: Page, state: PostMatchState) {
  const finalLineup = {
    lineupId: 'lineup-1',
    sourceMessageId: 'message-1',
    announcementMessageId: 'announcement-1',
    sentAt: '2026-09-09T16:05:00.000Z',
    sentByUserId: 'captain-user',
    sentByName: 'Regression Captain',
  }
  const currentCard = matchCard({
    id: MATCH_ID,
    date: MATCH_DATE,
    opponent: OPPONENT,
    state: () => state.saved ? 'archived' : 'active',
    lineup: teamSlots.map((court) => ({ label: court.label, players: court.players.map((player) => player.playerName) })),
    finalLineup,
  })
  const nextCard = matchCard({
    id: 'match-2',
    date: NEXT_MATCH_DATE,
    opponent: NEXT_OPPONENT,
    state: () => 'active',
    lineup: [],
    finalLineup: null,
  })
  const recap = {
    outcome: 'won' as const,
    teamCourts: 2,
    opponentCourts: 1,
    lines: teamSlots.map((court, index) => ({
      courtNumber: index + 1,
      label: court.label,
      matchType: 'doubles' as const,
      teamPlayers: court.players.map((player) => player.playerName),
      opponentPlayers: [opponentPlayers[index * 2], opponentPlayers[index * 2 + 1]],
      outcome: index === 1 ? 'opponent' as const : 'team' as const,
      score: ['6-4 6-7 10-8', '3-6 4-6', '7-6 6-4'][index],
    })),
    ratingChanges: [],
    sourceConflictCount: 0,
  }

  await page.route(`https://${SUPABASE_PROJECT}.supabase.co/rest/v1/**`, (route) => json(route, []))
  await page.route(`https://${SUPABASE_PROJECT}.supabase.co/auth/v1/**`, async (route) => {
    if (route.request().url().endsWith('/user')) {
      await json(route, { id: 'captain-user', email: 'captain@regression.test' })
      return
    }
    await json(route, {})
  })
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (url.pathname === '/api/auth/access') {
      await json(route, {
        ok: true,
        access: {
          role: 'captain',
          entitlements: {
            playerPlusSubscriptionActive: true,
            playerPlusSubscriptionStatus: 'active',
            playerPlusAccessExpiresAt: null,
            coachSubscriptionActive: false,
            coachSubscriptionStatus: 'inactive',
            coachAccessExpiresAt: null,
            captainSubscriptionActive: true,
            captainSubscriptionStatus: 'active',
            captainAccessExpiresAt: null,
            tiqTeamLeagueEntryEnabled: true,
            tiqIndividualLeagueCreatorEnabled: false,
            leagueAccessExpiresAt: null,
          },
        },
      })
      return
    }

    if (url.pathname === '/api/captain/lineup-builder') {
      await json(route, {
        ok: true,
        players: players.map(([id, name]) => ({ id, name })),
        rosterMembers: players.map(([id, name]) => ({ player_id: id, player_name: name })),
        opponentRosterNames: [...opponentPlayers],
      })
      return
    }

    if (url.pathname === '/api/captain/lineup-drafts') {
      await json(route, { ok: true, draft: null })
      return
    }

    if (url.pathname === '/api/captain/match-results' && request.method() === 'POST') {
      state.submissions.push(request.postDataJSON() as Record<string, unknown>)
      state.saved = true
      await json(route, {
        ok: true,
        message: 'Saved 3 court results, refreshed TiQ ratings, and updated Team Chat.',
        externalMatchId: 'captain-scorecard:regression-match',
        recap,
        teamAnnouncementUpdated: true,
      })
      return
    }

    if (url.pathname === '/api/team-rooms' && request.method() === 'GET') {
      const cards = state.saved ? [currentCard(), nextCard()] : [currentCard()]
      await json(route, {
        ok: true,
        teams: [{
          id: 'connection-1',
          teamName: TEAM,
          leagueName: LEAGUE,
          flight: FLIGHT,
          roles: ['player', 'captain'],
          isDefault: true,
          href: `/team-room?room=room-1&team=${encodeURIComponent(TEAM)}`,
        }],
        room: teamRoomFixture(cards, state.saved, recap),
      })
      return
    }

    await json(route, { ok: true })
  })
}

function matchCard(input: {
  id: string
  date: string
  opponent: string
  state: () => 'active' | 'archived'
  lineup: Array<{ label: string; players: string[] }>
  finalLineup: Record<string, string> | null
}) {
  return () => ({
    cardType: input.lineup.length ? 'projected_lineup' : 'availability',
    title: input.lineup.length ? 'Projected lineup — can you play?' : 'Can you play?',
    matchDate: input.date,
    opponent: input.opponent,
    matchTime: '6:00 PM',
    facility: 'Forest Park Tennis Center',
    matchId: input.id,
    externalMatchId: input.id,
    lineup: input.lineup,
    availabilityRequestId: `request-${input.id}`,
    availabilityRequestUrl: `/availability/request-${input.id}`,
    state: input.state(),
    lineupVersion: 1,
    lineupChanges: [],
    lineupChangeNotice: null,
    finalLineup: input.finalLineup,
    arrivalCheckIns: [],
    arrivalOutreach: [],
    matchCompletedAt: input.state() === 'archived' ? '2026-09-14T23:00:00.000Z' : '',
    acknowledged: false,
    acknowledgmentSummary: { total: 0, profileIds: [] },
    availabilitySummary: input.lineup.length ? null : {
      yes: 0,
      maybe: 0,
      no: 0,
      waiting: 6,
      total: 6,
      yesNames: [],
      waitingNames: players.map(([, name]) => name),
      maybeNames: [],
      noNames: [],
      scenarioId: 'scenario-2',
    },
    reminder: null,
  })
}

function teamRoomFixture(
  cards: Array<ReturnType<ReturnType<typeof matchCard>>>,
  saved: boolean,
  recap: {
    lines: Array<{
      label: string
      teamPlayers: string[]
      opponentPlayers: readonly string[]
      outcome: 'team' | 'opponent'
      score: string
    }>
  },
) {
  const messages = cards.map((card, index) => ({
    id: index === 0 ? 'message-1' : 'message-2',
    senderUserId: 'captain-user',
    senderName: 'Regression Captain',
    body: index === 0 ? 'Final lineup' : 'Availability for the next match',
    kind: index === 0 ? 'system' : 'announcement',
    createdAt: index === 0 ? '2026-09-09T16:05:00.000Z' : '2026-09-15T16:00:00.000Z',
    editedAt: '',
    deletedAt: '',
    isMine: true,
    replyToMessageId: '',
    replyTo: null,
    reactions: [],
    attachment: null,
    card,
    levelUpChallenge: null,
    lineupAnnouncement: null,
    response: null,
    responseSummary: { yes: 0, maybe: 0, no: 0, total: 0 },
    responseDetails: [],
  }))
  return {
    id: 'room-1',
    subject: TEAM,
    teamName: TEAM,
    teamLogoUrl: '',
    leagueName: LEAGUE,
    flight: FLIGHT,
    roles: ['player', 'captain'],
    canManage: true,
    muted: false,
    members: [{ id: 'captain-user', name: 'Regression Captain', playerName: 'Alex Ace', roles: ['player', 'captain'], muted: false }],
    rosterMembers: [],
    removedMembers: [],
    activeInviteCount: 0,
    messages,
    href: `/team-room?room=room-1&team=${encodeURIComponent(TEAM)}`,
    activeCardId: saved ? 'message-2' : 'message-1',
    nextScheduledMatch: saved ? {
      id: 'match-2',
      source: 'usta',
      matchDate: NEXT_MATCH_DATE,
      matchTime: '6:00 PM',
      opponent: NEXT_OPPONENT,
      facility: 'Forest Park Tennis Center',
    } : null,
    finalResultCardId: saved ? 'message-1' : '',
    activeLevelUpChallengeId: '',
    finalResult: saved ? {
      matchId: MATCH_ID,
      externalMatchId: 'captain-scorecard:regression-match',
      teamName: TEAM,
      opponentName: OPPONENT,
      teamScore: '2',
      opponentScore: '1',
      score: '2-1',
      outcome: 'win',
      unresolvedPlayerCount: 0,
      lines: recap.lines.map((line, index) => ({
        id: `line-${index + 1}`,
        label: line.label,
        teamPlayers: line.teamPlayers,
        opponentPlayers: [...line.opponentPlayers],
        score: line.score,
        winner: line.outcome,
        teamMissingPlayerCount: 0,
        opponentMissingPlayerCount: 0,
      })),
    } : null,
    finalLineupReview: null,
    actionQueue: {
      messageId: saved ? 'message-2' : 'message-1',
      matchDate: saved ? NEXT_MATCH_DATE : MATCH_DATE,
      waitingCount: saved ? 6 : 0,
      waitingNames: saved ? players.map(([, name]) => name) : [],
      maybeCount: 0,
      maybeNames: [],
      unseenLineupCount: 0,
      unseenLineupNames: [],
      lineupChangeCount: 0,
      unresolvedCount: saved ? 6 : 0,
      unresolvedProfileIds: [],
      reminderAt: '',
      reminderStatus: '',
      lastReminderAt: '',
    },
  }
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

function jwt(payload: Record<string, unknown>) {
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.captain-regression-signature`
}
