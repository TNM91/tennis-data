import {getCoachApiAuth} from '@/lib/coach-api-auth'
import {accountClient, accountResponse} from '@/lib/mobile-account-auth'
import {readCoachGrowthOverview} from '@/lib/coach-growth-overview'
import {isValidCalendarDate} from '@/lib/calendar-date'
export const runtime = 'nodejs'
export const maxDuration = 30
export async function GET(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) {auth.response.headers.set('Cache-Control', 'private, no-store'); return auth.response}
  const query = new URL(request.url).searchParams, day = query.get('day') ?? ''
  if ([...query.keys()].some(key => key !== 'day') || query.getAll('day').length !== 1 || !isValidCalendarDate(day)) return accountResponse({ok: false}, 400)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) return accountResponse({ok: false}, 503)
  try {
    const {data, error} = await accountClient(key).rpc('native_coach_growth_overview', {p_owner: auth.userId, p_day: day})
    if (error || !data?.ok) return accountResponse({ok: false}, data?.status === 400 ? 400 : data?.status === 403 ? 403 : 503)
    return accountResponse({ok: true, ...readCoachGrowthOverview(data, auth.userId, day)}, 200)
  } catch {return accountResponse({ok: false}, 503)}
}
