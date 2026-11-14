import { accountResponse, readAccountJson } from '@/lib/mobile-account-auth'
import { entryLeague } from '@/lib/native-league-entry-contract'
import { leaguePostponement, leagueScheduleChange, readLeagueScheduleReview, readScheduledLeagueMatch, validateLeagueScheduleSlot } from '@/lib/native-league-schedule-contract'
import { loadLeagueScheduling, postponeLeagueMatch, saveLeagueScheduling } from '@/lib/native-league-schedule'
import { loadFirstPartyNativeCompetitions, loadTestflightLeagueScores, reviewedSchedulingLeague } from '@/lib/native-competitions'
import { leagueAttentionFixture } from '@/lib/native-league-attention-contract'
import { testflightLeagueScoreId } from '@/lib/testflight-league-scores'
import { eventCalendarStart } from '@/lib/calendar-date'
import { getSignedInPlayerApiAuth, loadPlayerAccess } from '@/lib/player-api-auth'

export const runtime = 'nodejs'
export const maxDuration = 30

const json = (body: object, status = 200) =>
  accountResponse({ releaseScope: 'first-party', ...body }, status, { 'Referrer-Policy': 'no-referrer' })
const fail = (message: string, status: number) => json({ ok: false, message }, status)
const supportsPostponement = (request: Request) => request.headers.get('X-TenAceIQ-League-Postpone') === '1'

async function authorize(request: Request, id: string) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return { response: fail('Sign in to schedule a league match.', auth.response.status) }
  if (supportsPostponement(request) && auth.emailVerified === true && id === testflightLeagueScoreId(auth.userId)) {
    const demo = await loadTestflightLeagueScores(auth.supabase, auth.userId, { selected: id, scope: 'mine', query: '' })
    if (demo?.detail) return { owner: auth.userId, league: demo.league, db: auth.supabase, demo }
  }
  const access = await loadPlayerAccess(auth.supabase, auth.userId)
  const league = access.canUseLeagueTools ? await reviewedSchedulingLeague(auth.supabase, auth.userId, id) : null
  if (!league) return { response: fail('Only the coordinator of this active league can schedule matches.', 403) }
  return { owner: auth.userId, league, db: auth.supabase, verified: auth.emailVerified === true }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  let id: string
  try {
    if ([...params].length !== 1) throw Error()
    id = entryLeague(params.get('league'))
  } catch { return fail('Choose a league.', 400) }
  try {
    const access = await authorize(request, id)
    if (access.response) return access.response
    const { owner, league } = access
    const review = await loadLeagueScheduling(owner, league)
    const result = readLeagueScheduleReview({ ok: true, ...review, owner, leagueId: id }, owner, id)
    if (!supportsPostponement(request) || (!access.demo && !access.verified)) {
      const now = new Date()
      result.matches = result.matches.filter(match => {
        const start = eventCalendarStart(match.date, match.time || '00:00', result.zone)
        return match.status !== 'postponed' && start !== null && start > now
      }).map(match => ({ ...match, canPostpone: undefined }))
    }
    return json({ ok: true, ...result })
  } catch {
    return fail('The schedule couldn’t load. Try again.', 503)
  }
}

const saveErrors = {
  invalid: [400, 'Check the match details.'],
  date: [400, 'Choose a future date and time within this league season.'],
  venue: [400, 'Choose a venue from the current list.'],
  forbidden: [403, 'Only the coordinator of this active league can schedule matches.'],
  stale: [409, 'This match or season changed. Refresh the schedule and try again.'],
  roster: [409, 'Choose two different approved entries. Refresh the roster if it changed.'],
  unchanged: [409, 'Change the time, venue, court, or match length before saving.'],
  capacity: [409, 'This season has reached its match limit.'],
  overlap: [409, 'A participant or court is already booked in this league during that time. Choose another slot.'],
  played: [409, 'This match can’t be postponed after scores have been recorded.'],
} as const

export async function POST(request: Request) {
  let input: ReturnType<typeof leagueScheduleChange> | ReturnType<typeof leaguePostponement>
  try {
    if (new URL(request.url).search) throw Error('Choose a league.')
    const body = await readAccountJson(request, 4096)
    input = body?.action === 'postpone' && supportsPostponement(request)
      ? leaguePostponement(body) : leagueScheduleChange(body)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Check the match details.', 400)
  }
  try {
    const access = await authorize(request, input.leagueId)
    if (access.response) return access.response
    const { owner, league } = access
    let result
    const postponing = 'action' in input
    if ('action' in input) {
      if (!access.demo && !access.verified) return fail('Verify your email to postpone this match.', 403)
      const snapshot = access.demo ?? await loadFirstPartyNativeCompetitions(access.db, owner,
        { scope: 'discover', query: '', selected: league.id }, true)
      const fixtures = ('publishedSchedule' in snapshot ? snapshot.publishedSchedule : undefined) ?? snapshot.detail?.fixtures
      const current = fixtures?.find(match => match.id === input.matchId)
      const expected = leagueAttentionFixture(input.fixture)
      if (!current || snapshot.detail?.league.updatedAt !== league.updatedAt || (current.status !== 'postponed' &&
          Object.entries(leagueAttentionFixture(current)).some(([key, value]) => expected[key as keyof typeof expected] !== value))) {
        return fail(saveErrors.stale[1], 409)
      }
      result = await postponeLeagueMatch(owner, league, input)
    } else {
      // The transaction checks the start time after looking for an existing save receipt.
      try { validateLeagueScheduleSlot(input, { ...league, zone: league.timeZone }, null) }
      catch (error) { return fail(error instanceof Error ? error.message : 'Check the match date.', 400) }
      result = await saveLeagueScheduling(owner, league, input)
    }
    if (typeof result.code === 'string' && Object.hasOwn(saveErrors, result.code)) {
      const [status, message] = saveErrors[result.code as keyof typeof saveErrors]
      return fail(message, status)
    }
    if (result.code !== 'saved' || typeof result.notified !== 'number' || !Number.isSafeInteger(result.notified) ||
        result.notified < 0 || typeof result.unreachable !== 'number' || ![0, 1, 2].includes(result.unreachable)) throw Error('Invalid save receipt')
    const match = readScheduledLeagueMatch(result.match)
    if (match.status !== (postponing ? 'postponed' : 'coordinator_set') ||
        (input.matchId && input.matchId !== match.id)) throw Error('Invalid match receipt')
    return json({ ok: true, owner, leagueId: league.id, requestId: input.requestId,
      match, notified: result.notified, unreachable: result.unreachable })
  } catch {
    return fail('The save couldn’t be confirmed. Retry the same change to check its status.', 503)
  }
}
