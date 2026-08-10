import { getCoachApiAuth } from '@/lib/coach-api-auth'
import { mapWeeklyLevelUpPlanRow, type WeeklyLevelUpPlanRow } from '@/lib/level-up/weekly-plan'

export const runtime = 'nodejs'

const planSelect = 'id,player_user_id,coach_user_id,student_link_id,identity_slug,week_start,shared_with_coach,plan_json,created_at,updated_at'

export async function GET(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const studentLinkId = url.searchParams.get('studentLinkId')?.trim() ?? ''
  let query = auth.supabase
    .from('level_up_weekly_plans')
    .select(planSelect)
    .eq('coach_user_id', auth.userId)
    .eq('shared_with_coach', true)
    .order('week_start', { ascending: false })
    .limit(100)

  if (studentLinkId) query = query.eq('student_link_id', studentLinkId)

  const { data, error } = await query
  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })

  const plans = ((data ?? []) as WeeklyLevelUpPlanRow[])
    .map(mapWeeklyLevelUpPlanRow)
    .filter((plan) => plan !== null)
  return Response.json({ ok: true, plans })
}
