import { getClubApiAuth } from '@/lib/club-api-auth'
import { cleanClubMultiline, cleanClubText, mapClubTemplateRow } from '@/lib/club-workspace'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId } = await context.params

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, message: 'Enter the competition details.' }, { status: 400 })
  }

  const name = cleanClubText(body.name, 120)
  if (name.length < 2) return Response.json({ ok: false, message: 'Name this competition template.' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('club_competition_templates')
    .insert({
      club_id: clubId,
      name,
      competition_type: body.competitionType === 'tournament' ? 'tournament' : 'league',
      entrant_type: body.entrantType === 'teams' ? 'teams' : 'players',
      format_id: cleanClubText(body.formatId, 80) || 'round_robin',
      division_label: cleanClubText(body.divisionLabel),
      default_facility: cleanClubText(body.defaultFacility),
      schedule_notes: cleanClubMultiline(body.scheduleNotes),
      is_public: body.isPublic !== false,
      created_by_user_id: auth.userId,
    })
    .select('id,club_id,name,competition_type,entrant_type,format_id,division_label,default_facility,schedule_notes,is_public,updated_at')
    .single()

  if (error) return Response.json({ ok: false, message: 'Club staff access is required to add a competition.' }, { status: 403 })
  return Response.json({ ok: true, template: mapClubTemplateRow(data as Record<string, unknown>) })
}
