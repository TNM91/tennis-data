import { accountClient, accountResponse, readAccountJson, verifiedAccount } from '@/lib/mobile-account-auth'
import { courtAccountId } from '@/lib/native-court-result-contract'
import { entryLeague } from '@/lib/native-league-entry-contract'
import { readLeagueScoreCard, readLeagueScoreChange, readLeagueScoreDesk, readLeagueScoreFixture, validateLeagueScoreLines } from '@/lib/native-league-score-contract'
import { loadFirstPartyNativeCompetitions, loadTestflightLeagueScores, publicLeague } from '@/lib/native-competitions'
import { readTestflightScoreLeague, testflightLeagueScoreId } from '@/lib/testflight-league-scores'
import { nativeLeagueColumns } from '@/lib/native-league-season'
import { readReviewedRevisions, reviewedRevisionDigest } from '@/lib/first-party-revisions'
import { resolveTeamMatchFormat } from '@/lib/competition-format-registry'
import { readReviewedTeamRooms, reviewedTeamRoom, findReviewedTeamConversation } from '@/lib/first-party-team-scopes'
import { loadPlayerAccess } from '@/lib/player-api-auth'
import { supabaseKey } from '@/lib/supabase-public-config'
import { lineupRecord } from '@/lib/native-captain-lineup-contract'

export const runtime = 'nodejs'
export const maxDuration = 60
const json = (body: object, status = 200) => accountResponse(
  { releaseScope: 'first-party', ...body }, status, { 'Referrer-Policy': 'no-referrer' },
)
const fail = (message: string, status: number) => json({ ok: false, message }, status)

async function handle(request: Request) {
  const account = await verifiedAccount(request)
  if (!account) return fail('Sign in to open the league scorecard.', 401)
  const params = new URL(request.url).searchParams
  let leagueId: string, matchId: string | null, change: ReturnType<typeof readLeagueScoreChange> | undefined
  try {
    if (request.method === 'POST') {
      if (params.size) throw Error('Choose a scheduled match.')
      change = readLeagueScoreChange(await readAccountJson(request, 8192))
      leagueId = change.leagueId
      matchId = change.matchId
    } else {
      if ([...params.keys()].some(key => !['league', 'match'].includes(key) || params.getAll(key).length !== 1)) {
        throw Error('Choose a scheduled match.')
      }
      leagueId = entryLeague(params.get('league'))
      matchId = params.get('match')
      if (matchId !== null && !courtAccountId(matchId)) throw Error('Choose a scheduled match.')
    }
  } catch (error) { return fail(error instanceof Error ? error.message : 'Check the scorecard.', 400) }
  const denied = () => fail('Only this match’s captains and league coordinator can open its scorecard.', 403)
  const modern = request.headers.get('X-TenAceIQ-League-Score') === '2'
  const owner = account.user.id, db = accountClient(supabaseKey, account.token)
  const isDemo = modern && leagueId === testflightLeagueScoreId(owner)
  const approval = readReviewedRevisions(process.env.TIQ_FIRST_PARTY_LEAGUE_APPROVALS, 'detail').get(leagueId)
  if (!isDemo && !approval) return denied()
  const cols = nativeLeagueColumns + ',is_public,third_set_rule,team_match_format_id'
  const {data,error} = isDemo ? {data:await readTestflightScoreLeague(db,owner,cols), error:null} : await db.from('tiq_leagues').select(cols)
    .eq('id', leagueId).eq('league_format', 'team').eq('season_status', 'active').eq('is_public', true).maybeSingle()
  if (error) throw Error('League unavailable')
  if (!data) return denied()
  const source = lineupRecord(data), input = { scope: 'discover' as const, query: '', selected: leagueId }
  const demo = isDemo ? await loadTestflightLeagueScores(db,owner,input) : null
  if (isDemo && (!demo?.detail || demo.league.updatedAt!==source.updated_at)) return denied()
  const league = demo?.league ?? publicLeague(source)
  if (!demo && reviewedRevisionDigest(league) !== approval?.summary) return denied()
  const access = demo ? null : await loadPlayerAccess(db, owner)
  const coordinator = !!demo || source.created_by_user_id === owner && access?.canUseLeagueTools === true
  const captainAccess = !!demo || access?.canUseCaptainWorkflow === true
  if (!coordinator && (!matchId || !captainAccess)) return denied()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) throw Error('League score review unavailable')
  const service = accountClient(key)

  const { detail, publishedSchedule } = demo ? {...demo,publishedSchedule:undefined} :
    await loadFirstPartyNativeCompetitions(db, owner, input, true)
  if (!detail || detail.league.updatedAt !== league.updatedAt) return denied()
  const schedule = publishedSchedule ?? detail.fixtures
  const fixture = matchId ? schedule.find(item => item.id === matchId) : undefined
  if (matchId && !fixture) return denied()
  const visible = (match: ReturnType<typeof readLeagueScoreFixture>) => schedule.some(item => item.id === match.id &&
    item.a === match.a && item.b === match.b && item.date === match.date && item.time.slice(0, 5) === match.time)

  let roomA: string | null = null, roomB: string | null = null
  if (fixture) {
    if (!demo && captainAccess) {
      const rooms = readReviewedTeamRooms(process.env.TIQ_FIRST_PARTY_TEAM_ROOMS)
      const lookUp = async (teamName: string) => {
        const room = reviewedTeamRoom(rooms, { teamName, leagueName: league.name, flight: league.flight })
        return room?.scheduleLeagueId === leagueId && await findReviewedTeamConversation(service, room) ? room.roomId : null
      }
      const [a, b] = await Promise.all([lookUp(fixture.a), lookUp(fixture.b)])
      roomA = a
      roomB = b
    }
  }
  const scope = { p_actor: owner, p_league: leagueId, p_version: league.updatedAt, p_match: matchId,
    p_captain_access: captainAccess, p_room_a: roomA, p_room_b: roomB }
  const { data: review, error: readError } = await service.rpc('native_league_score_review', scope).retry(false)
  if (readError) throw Error('Scorecard unavailable')
  if (!review) return denied()
  if (!matchId) {
    if (!Array.isArray(review.matches) || review.matches.length > 100) throw Error('Queue unavailable')
    return json({ ok: true, owner, leagueId, matches: review.matches.map(readLeagueScoreFixture).filter(visible) })
  }
  const format = resolveTeamMatchFormat({ leagueName: league.name, flight: league.flight,
    explicitFormatId: typeof source.team_match_format_id === 'string' ? source.team_match_format_id : null })
  const desk = readLeagueScoreDesk({ ...review, canReview: review.canReview === true && coordinator,
    slots: format.slots.map(slot => ({ label: slot.label, format: slot.discipline })),
    thirdSetRule: ['full_set', 'match_tiebreak_10'].includes(String(source.third_set_rule)) ? source.third_set_rule : 'either',
  }, matchId)
  if (!visible(desk.match)) return denied()
  if (!modern && (desk.card?.lines.some(line=>line.outcome) || change?.lines.some(line=>line.outcome))) {
    return fail('Update TenAceIQ to review walkovers or retirements.', 409)
  }
  if (!change) return json({ ok: true, owner, leagueId, desk })
  if (change.action !== 'submit' && !desk.canReview || change.action === 'submit' && !captainAccess) return denied()
  const lines = change.action === 'submit' ? change.lines : change.action === 'approve' ? desk.card?.lines ?? [] : []
  try {
    if (change.action === 'submit' || change.action === 'approve') validateLeagueScoreLines(lines, desk)
  } catch (error) { return fail(error instanceof Error ? error.message : 'Check every court score.', 400) }

  const { data: result, error: saveError } = await service.rpc('native_league_save_score', {
    ...scope, p_fixture_version: change.fixtureVersion, p_revision: change.revision, p_request: change.requestId,
    p_action: change.action, p_lines: lines, p_note: change.note,
  }).retry(false)
  if (saveError) throw Error('The save could not be confirmed')
  if (result?.code === 'saved') return json({ ok: true, owner, leagueId, matchId, card: readLeagueScoreCard(result.card) })
  if (result?.code === 'forbidden') return denied()
  if (result?.code === 'invalid') return fail('Check every court score.', 400)
  const messages: Record<string, string> = {
    stale: 'The match or submission changed. Reload the scorecard and try again.',
    official: 'This match already has an official score.',
    pending: 'A scorecard is already waiting for the coordinator.',
    early: 'Scores open once the scheduled match starts.',
    capacity: 'This league has reached its result limit.',
  }
  if (Object.hasOwn(messages, result?.code)) return fail(messages[result.code], 409)
  throw Error('The save could not be confirmed')
}

async function respond(request: Request) {
  try { return await handle(request) }
  catch { return fail('The league scorecard couldn’t be confirmed. Try again.', 503) }
}
export const GET = respond
export const POST = respond
