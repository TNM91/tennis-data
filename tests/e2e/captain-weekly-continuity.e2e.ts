import { expect, test, type Page, type Route } from '@playwright/test'

const SUPABASE_PROJECT = 'pwxppfazbyourjrsutgx'
const TEAM = 'Regression Aces'
const LEAGUE = '2026 STL Tri-Level 18 & Over'
const FLIGHT = 'Men 3.5/4.0/4.5'
const MATCH_DATE = '2026-09-14'
const OPPONENT = 'Baseline Club'
const MATCH_ID = 'match-1'

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
    for (const [, playerName] of players) {
      await expect(page.getByText(playerName, { exact: false }).first()).toBeVisible()
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
