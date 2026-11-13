import { accountResponse, readAccountJson } from '@/lib/mobile-account-auth'
import { entryLeague } from '@/lib/native-league-entry-contract'
import { leagueScheduleChange, readLeagueScheduleReview, readScheduledLeagueMatch, validateLeagueScheduleSlot } from '@/lib/native-league-schedule-contract'
import { loadLeagueScheduling, saveLeagueScheduling } from '@/lib/native-league-schedule'
import { reviewedSchedulingLeague } from '@/lib/native-competitions'
import { getSignedInPlayerApiAuth, loadPlayerAccess } from '@/lib/player-api-auth'

export const runtime = 'nodejs'
export const maxDuration = 30

const json = (body: object, status = 200) =>
  accountResponse({ releaseScope: 'first-party', ...body }, status, { 'Referrer-Policy': 'no-referrer' })
const fail = (message: string, status: number) => json({ ok: false, message }, status)

async function authorize(request: Request, id: string) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return { response: fail('Sign in to schedule a league match.', auth.response.status) }
  const access = await loadPlayerAccess(auth.supabase, auth.userId)
  const league = access.canUseLeagueTools ? await reviewedSchedulingLeague(auth.supabase, auth.userId, id) : null
  if (!league) return { response: fail('Only the coordinator of this active league can schedule matches.', 403) }
  return { owner: auth.userId, league }
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
    return json({ ok: true, ...readLeagueScheduleReview({ ok: true, ...review, owner, leagueId: id }, owner, id) })
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
} as const

export async function POST(request: Request) {
  let input: ReturnType<typeof leagueScheduleChange>
  try {
    if (new URL(request.url).search) throw Error('Choose a league.')
    input = leagueScheduleChange(await readAccountJson(request, 4096))
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Check the match details.', 400)
  }
  try {
    const access = await authorize(request, input.leagueId)
    if (access.response) return access.response
    const { owner, league } = access
    // The transaction checks the start time after looking for an existing save receipt.
    try { validateLeagueScheduleSlot(input, { ...league, zone: league.timeZone }, null) }
    catch (error) { return fail(error instanceof Error ? error.message : 'Check the match date.', 400) }
    const result = await saveLeagueScheduling(owner, league, input)
    if (typeof result.code === 'string' && Object.hasOwn(saveErrors, result.code)) {
      const [status, message] = saveErrors[result.code as keyof typeof saveErrors]
      return fail(message, status)
    }
    if (result.code !== 'saved' || typeof result.notified !== 'number' || !Number.isSafeInteger(result.notified) ||
        result.notified < 0 || typeof result.unreachable !== 'number' || ![0, 1, 2].includes(result.unreachable)) throw Error('Invalid save receipt')
    return json({ ok: true, owner, leagueId: league.id, requestId: input.requestId,
      match: readScheduledLeagueMatch(result.match), notified: result.notified, unreachable: result.unreachable })
  } catch {
    return fail('The save couldn’t be confirmed. Retry the same change to check its status.', 503)
  }
}
