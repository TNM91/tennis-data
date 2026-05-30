import { getCoachApiAuth } from '@/lib/coach-api-auth'
import { mapLevelUpSessionRow, type LevelUpSessionRow } from '@/lib/level-up-sessions'

export const runtime = 'nodejs'

const sessionSelect =
  'id,player_user_id,coach_user_id,student_link_id,assignment_id,identity_slug,focus_id,focus_title,work_type,training_context,drill_title,rating,feeling,access_mode,note,elapsed_seconds,shared_with_coach,completed_at,created_at,updated_at'

export async function GET(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const studentLinkId = url.searchParams.get('studentLinkId')?.trim() ?? ''

  let query = auth.supabase
    .from('level_up_sessions')
    .select(sessionSelect)
    .eq('coach_user_id', auth.userId)
    .eq('shared_with_coach', true)
    .order('completed_at', { ascending: false })
    .limit(100)

  if (studentLinkId) {
    query = query.eq('student_link_id', studentLinkId)
  }

  const { data, error } = await query
  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })

  const sessions = ((data ?? []) as LevelUpSessionRow[]).map(mapLevelUpSessionRow)
  return Response.json({ ok: true, sessions })
}
