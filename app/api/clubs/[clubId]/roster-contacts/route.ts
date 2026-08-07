import { getClubApiAuth } from '@/lib/club-api-auth'
import { cleanClubText, isClubManager, normalizeClubRoles } from '@/lib/club-workspace'

export const runtime = 'nodejs'

export async function GET(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId } = await context.params

  const { data: membership } = await auth.supabase
    .from('club_memberships')
    .select('roles')
    .eq('club_id', clubId)
    .eq('user_id', auth.userId)
    .eq('status', 'active')
    .maybeSingle()
  if (!membership || !isClubManager(normalizeClubRoles(membership.roles, []))) {
    return Response.json({ ok: false, message: 'Club manager access is required to use imported roster contacts.' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('captain_roster_contacts')
    .select('id,team_name,league_name,flight,full_name,phone,email,role,is_captain,updated_at')
    .eq('captain_user_id', auth.userId)
    .order('team_name')
    .order('full_name')
  if (error) return Response.json({ ok: false, message: 'Imported roster contacts could not be opened.' }, { status: 400 })

  return Response.json({
    ok: true,
    contacts: (data ?? []).map((contact) => ({
      id: cleanClubText(contact.id),
      teamName: cleanClubText(contact.team_name),
      leagueName: cleanClubText(contact.league_name),
      flight: cleanClubText(contact.flight),
      fullName: cleanClubText(contact.full_name),
      phone: cleanClubText(contact.phone, 40),
      email: cleanClubText(contact.email, 180).toLowerCase(),
      role: cleanClubText(contact.role, 40) || 'Player',
      isCaptain: contact.is_captain === true,
      updatedAt: cleanClubText(contact.updated_at, 80),
    })),
  })
}
