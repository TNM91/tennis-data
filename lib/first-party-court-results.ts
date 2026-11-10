import type { SupabaseClient } from '@supabase/supabase-js'
import { competitionInput } from './native-competitions-contract'
import { loadFirstPartyNativeCompetitions } from './native-competitions'
import { findReviewedTeamConversation, loadReviewedTeamLinks, readReviewedTeamRooms, reviewedTeamRoom, type ReviewedTeamRoom } from './first-party-team-scopes'
import { checkTeamChatAccess } from './team-chat-updates'
import { canManageTeamRoom } from './team-room'
import { readReviewedRevisions } from './first-party-revisions'
import { loadPlayerAccess } from './player-api-auth'
import { courtAccountId, courtDate, courtNumber, courtScorecardKey, type CaptainCourt, type CourtDesk, type CourtFixture,
  type CourtSubmission, type PostedCourtScorecard } from './native-court-result-contract'

const table = 'native_captain_court_results'
const columns = 'fixture_id,court_number,league_id,match_date,room_a,room_b,a1,a2,b1,b2,posted_by,format,winner,score,revision'
const activeFixtureStates = ['confirmed', 'coordinator_set', 'completed']
type CourtRow = {
  fixture_id: string; court_number: number; league_id: string; match_date: string; room_a: string; room_b: string;
  a1: string | null; a2: string | null; b1: string | null; b2: string | null; posted_by: string | null;
  format: 'singles' | 'doubles'; winner: 'A' | 'B'; score: string; revision: string
}
type RosterLink = { profile_user_id: string; team_role: string; team_roles: string[] }
export class CourtUnavailable extends Error {
  constructor(readonly status: 403 | 409, message: string) { super(message) }
}

function rows<T>(result: { data: unknown; error: unknown }, max: number): T[] {
  if (result.error || !Array.isArray(result.data) || result.data.length > max) throw Error('Court records unavailable')
  return result.data as T[]
}

function sameFixture(result: CourtRow, context: CourtFixture, a: ReviewedTeamRoom, b: ReviewedTeamRoom) {
  return result.fixture_id === context.fixture && result.league_id === context.league && result.match_date === context.date &&
    result.room_a === a.roomId && result.room_b === b.roomId
}

async function roster(service: SupabaseClient, room: ReviewedTeamRoom) {
  const [links, participants, removals] = await Promise.all([
    service.from('team_profile_links').select('profile_user_id,team_role,team_roles').eq('team_name', room.teamName)
      .eq('league_name', room.leagueName).eq('flight', room.flight).eq('status', 'accepted').is('archived_at', null)
      .in('source_type', ['manual_invite', 'tiq_entry']).limit(101),
    service.from('internal_conversation_participants').select('profile_id').eq('conversation_id', room.roomId).limit(101),
    service.from('team_room_member_removals').select('profile_id').eq('conversation_id', room.roomId).limit(101),
  ])
  const members = new Set(rows<{ profile_id: string }>(participants, 100).map(row => row.profile_id))
  const excluded = new Set(rows<{ profile_id: string }>(removals, 100).map(row => row.profile_id))
  return rows<RosterLink>(links, 100).filter(link => courtAccountId(link.profile_user_id) &&
    members.has(link.profile_user_id) && !excluded.has(link.profile_user_id))
}

async function context(db: SupabaseClient, service: SupabaseClient, owner: string, leagueId: string, fixtureId: string) {
  const snapshot = await loadFirstPartyNativeCompetitions(db, owner, competitionInput('discover', '', leagueId))
  const detail = snapshot.detail, fixture = detail?.fixtures.find(row => row.id === fixtureId)
  if (!detail || detail.league.format !== 'team' || !fixture || !activeFixtureStates.includes(fixture.status) || !courtDate(fixture.date)) {
    throw new CourtUnavailable(403, 'This team fixture is unavailable.')
  }
  const { name: leagueName, flight, timeZone } = detail.league
  const today = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  if (!courtDate(today) || fixture.date > today) throw new CourtUnavailable(403, 'Court scores open on match day.')
  const approvals = readReviewedTeamRooms(process.env.TIQ_FIRST_PARTY_TEAM_ROOMS)
  const a = reviewedTeamRoom(approvals, { teamName: fixture.a, leagueName, flight })
  const b = reviewedTeamRoom(approvals, { teamName: fixture.b, leagueName, flight })
  if (!a || !b || a.roomId === b.roomId) throw new CourtUnavailable(403, 'Both teams need active TenAceIQ rosters.')
  const [own, openA, openB] = await Promise.all([
    loadReviewedTeamLinks(service, owner, approvals), findReviewedTeamConversation(service, a), findReviewedTeamConversation(service, b),
  ])
  if (!openA || !openB || !own.some(room => room.roomId === a.roomId || room.roomId === b.roomId)) {
    throw new CourtUnavailable(403, 'This team fixture is unavailable to your account.')
  }
  const [rosterA, rosterB] = await Promise.all([roster(service, a), roster(service, b)])
  const linkA = rosterA.find(link => link.profile_user_id === owner), linkB = rosterB.find(link => link.profile_user_id === owner)
  if (Boolean(linkA) === Boolean(linkB)) throw new CourtUnavailable(403, 'Your team assignment could not be confirmed.')
  const link = (linkA ?? linkB)!
  const captain = canManageTeamRoom(link.team_roles?.length ? link.team_roles : [link.team_role]) &&
    (await loadPlayerAccess(db, owner)).canUseCaptainWorkflow
  const match: CourtFixture = { league: leagueId, fixture: fixtureId, date: fixture.date, teamA: a.teamName, teamB: b.teamName, side: linkA ? 'A' : 'B' }
  return { match, a, b, rosterA, rosterB, captain }
}

function captainCourt(row: CourtRow): CaptainCourt {
  return { court: row.court_number, format: row.format, a: [row.a1, row.a2].filter(courtAccountId),
    b: [row.b1, row.b2].filter(courtAccountId), winner: row.winner, score: row.score, revision: row.revision }
}

export async function loadCourtDesk(db: SupabaseClient, service: SupabaseClient, owner: string, leagueId: string, fixtureId: string): Promise<CourtDesk> {
  const value = await context(db, service, owner, leagueId, fixtureId)
  const { match, a, b, rosterA, rosterB, captain } = value
  if (!captain) return { ...match, captain, membersA: [], membersB: [], courts: [] }
  const ids = [...new Set([...rosterA, ...rosterB].map(link => link.profile_user_id))]
  const [saved, profiles] = await Promise.all([
    service.from(table).select(columns).eq('fixture_id', fixtureId).order('court_number').limit(31),
    service.from('profiles').select('id,message_display_name').in('id', ids).limit(200),
  ])
  const names = new Map(rows<{ id: string; message_display_name: string | null }>(profiles, 200)
    .map(row => [row.id, row.message_display_name?.replace(/\p{Cc}/gu, '').trim().slice(0, 100) || '']))
  const members = (roster: RosterLink[]) => roster.map(({ profile_user_id: id }) => ({ id,
    name: names.get(id) || 'Team member' })).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  const results = rows<CourtRow>(saved, 30)
  if (results.some(row => !sameFixture(row, match, a, b))) throw new CourtUnavailable(409, 'The fixture changed. Review the court before posting again.')
  const membersA = members(rosterA), membersB = members(rosterB)
  const visibleA = new Set(membersA.map(member => member.id)), visibleB = new Set(membersB.map(member => member.id))
  const courts = results.map(captainCourt).map(row => ({ ...row, a: row.a.filter(id => visibleA.has(id)), b: row.b.filter(id => visibleB.has(id)) }))
  return { ...match, captain, membersA, membersB, courts }
}

export async function publishCourtResult(db: SupabaseClient, service: SupabaseClient, owner: string, leagueId: string, fixtureId: string, input: CourtSubmission) {
  const { match, a, b, rosterA, rosterB, captain } = await context(db, service, owner, leagueId, fixtureId)
  if (!captain || input.a.some(id => !rosterA.some(link => link.profile_user_id === id)) ||
      input.b.some(id => !rosterB.some(link => link.profile_user_id === id))) {
    throw new CourtUnavailable(403, 'Only a captain can post scores for the confirmed players on these teams.')
  }
  const row: CourtRow = { fixture_id: fixtureId, league_id: leagueId, court_number: input.court, match_date: match.date,
    room_a: a.roomId, room_b: b.roomId, a1: input.a[0], a2: input.a[1] ?? null, b1: input.b[0], b2: input.b[1] ?? null,
    format: input.format, winner: input.winner, score: input.score, revision: input.revision, posted_by: owner }
  const query = input.expected
    ? service.from(table).update(row).eq('fixture_id', fixtureId).eq('court_number', input.court).eq('revision', input.expected)
      .eq('match_date', match.date).eq('room_a', a.roomId).eq('room_b', b.roomId).eq('league_id', leagueId)
    : service.from(table).insert(row)
  const written = await query.select(columns).retry(false).maybeSingle()
  const result = written.data ?? (await service.from(table).select(columns).eq('fixture_id', fixtureId)
    .eq('court_number', input.court).retry(false).maybeSingle()).data
  if (result && (Object.keys(row) as (keyof CourtRow)[]).every(key => result[key] === row[key])) return captainCourt(result as CourtRow)
  if (result && result.revision !== input.expected) throw new CourtUnavailable(409, 'A captain already saved a different result for this court. Reload the court scores.')
  throw Error('Court result could not be confirmed')
}

export async function loadPostedCourtScorecards(service: SupabaseClient, owner: string): Promise<PostedCourtScorecard[]> {
  const approvals = readReviewedTeamRooms(process.env.TIQ_FIRST_PARTY_TEAM_ROOMS)
  const leagueApprovals = readReviewedRevisions(process.env.TIQ_FIRST_PARTY_LEAGUE_APPROVALS, 'detail')
  if (!courtAccountId(owner) || !approvals.size || !leagueApprovals.size) return []
  const own = await loadReviewedTeamLinks(service, owner, approvals)
  if (!own.length) return []
  const allRooms = new Map([...approvals.values()].map(room => [room.roomId, room]))
  const ownRooms = new Map(own.map(room => [room.roomId, room]))
  const result = await service.from(table).select(columns).in('league_id', [...leagueApprovals.keys()])
    .or(['a1', 'a2', 'b1', 'b2'].map(field => `${field}.eq.${owner}`).join(','))
    .order('match_date', { ascending: false }).order('fixture_id').order('court_number').limit(30)
  const courts = rows<CourtRow>(result, 30)
  if (!courts.length) return []
  const fixtures = await service.from('tiq_league_schedule_items')
    .select('id,league_id,league_format,scheduled_date,participant_a_name,participant_b_name,status')
    .in('id', [...new Set(courts.map(court => court.fixture_id))]).limit(30)
  type Fixture = { id: string; league_id: string; league_format: string; scheduled_date: string; participant_a_name: string; participant_b_name: string; status: string }
  const byId = new Map(rows<Fixture>(fixtures, 30).map(fixture => [fixture.id, fixture]))
  const usedRooms = new Set(courts.flatMap(row => [row.room_a, row.room_b]))
  const allowed = new Set<string>()
  const activeRooms = [...ownRooms.values()].filter(room => usedRooms.has(room.roomId))
  for (let offset = 0; offset < activeRooms.length; offset += 4) {
    await Promise.all(activeRooms.slice(offset, offset + 4).map(async room => {
      if (await findReviewedTeamConversation(service, room) && (await checkTeamChatAccess(service, owner, room.roomId, false)).ok) {
        allowed.add(room.roomId)
      }
    }))
  }
  return courts.flatMap((row): PostedCourtScorecard[] => {
    const fixture = byId.get(row.fixture_id), a = allRooms.get(row.room_a), b = allRooms.get(row.room_b)
    const sideA = row.a1 === owner || row.a2 === owner, sideB = row.b1 === owner || row.b2 === owner
    if (sideA === sideB || !fixture || !a || !b || !allowed.has(sideA ? row.room_a : row.room_b) ||
        fixture.league_id !== row.league_id || fixture.league_format !== 'team' || fixture.scheduled_date !== row.match_date ||
        fixture.participant_a_name !== a.teamName || fixture.participant_b_name !== b.teamName || !activeFixtureStates.includes(fixture.status) ||
        !courtDate(row.match_date) || !courtNumber(row.court_number) || !['A', 'B'].includes(row.winner)) return []
    const id = courtScorecardKey(row.league_id, row.fixture_id, row.court_number)
    return [{ id, calendar_match_id: id, match_date: row.match_date, opponent: sideA ? b.teamName : a.teamName,
      format: row.format, outcome: row.winner === (sideA ? 'A' : 'B') ? 'Won' : 'Lost', score: row.score,
      scoreOrder: `${a.teamName} – ${b.teamName}`, court: row.court_number }]
  })
}
