import { getCaptainApiAuth } from '@/lib/captain-api-auth'
import { getCaptainAvailabilityServiceClient, isUuid } from '@/lib/captain-availability-request-server'
import { buildTeamRoomScopeId, canManageTeamRoom } from '@/lib/team-room'
import { hasCompleteSavedLineup } from '@/lib/captain-quick-start'
import { readTeamRoomFinalLineupReceipt } from '@/lib/team-room-final-lineup'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await getCaptainApiAuth(request)
  if (!auth.ok) return auth.response
  const connectionId = new URL(request.url).searchParams.get('connection') || ''
  if (!isUuid(connectionId)) return Response.json({ message: 'Choose your linked team.' }, { status: 400 })
  try {
    const service = getCaptainAvailabilityServiceClient()
    // Validate ownership and accepted captain authority before any service-role reads.
    const link = await service.from('team_profile_links')
      .select('team_name,league_name,flight,team_role,team_roles')
      .eq('id', connectionId).eq('profile_user_id', auth.userId)
      .eq('status', 'accepted').is('archived_at', null).maybeSingle()
    if (link.error) throw link.error
    if (!link.data || !canManageTeamRoom(link.data.team_roles?.length ? link.data.team_roles : [link.data.team_role])) {
      return Response.json({ message: 'Choose a team you captain.' }, { status: 403 })
    }
    const team = link.data
    const [teammates, scenarios, conversation] = await Promise.all([
      service.from('team_profile_links').select('id', { count: 'exact', head: true })
        .eq('team_name', team.team_name).eq('league_name', team.league_name).eq('flight', team.flight)
        .eq('status', 'accepted').is('archived_at', null).neq('profile_user_id', auth.userId),
      // Preserve existing lineup RLS; do not expose another captain's private drafts.
      auth.supabase.from('lineup_scenarios').select('id,slots_json,match_date,opponent_team')
        .eq('team_name', team.team_name).eq('league_name', team.league_name).eq('flight', team.flight)
        .order('match_date', { ascending: false }).limit(100),
      service.from('internal_conversations').select('id')
        .eq('related_entity_type', 'team_room')
        .eq('related_entity_id', buildTeamRoomScopeId({ teamName: team.team_name, leagueName: team.league_name, flight: team.flight })).maybeSingle(),
    ])
    if (teammates.error || scenarios.error || conversation.error) throw new Error('Progress could not be checked.')
    let sentMatch: { date: string; opponent: string } | null = null
    if (conversation.data) {
      const removal = await service.from('team_room_member_removals').select('profile_id')
        .eq('conversation_id', conversation.data.id).eq('profile_id', auth.userId).maybeSingle()
      if (removal.error) throw removal.error
      if (removal.data) return Response.json({ message: 'You no longer have access to this Team Chat.' }, { status: 403 })
      const announcement = await service.from('internal_messages').select('id,metadata')
        .eq('conversation_id', conversation.data.id).is('deleted_at', null)
        .or('metadata->>finalLineupAnnouncement.eq.true,metadata->>finalLineupChangeAnnouncement.eq.true')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (announcement.error) throw announcement.error
      const sourceId = announcement.data?.metadata?.sourceMessageId
      if (typeof sourceId === 'string' && isUuid(sourceId)) {
        const source = await service.from('internal_messages').select('metadata')
          .eq('conversation_id', conversation.data.id).eq('id', sourceId).is('deleted_at', null).maybeSingle()
        if (source.error) throw source.error
        const receipt = readTeamRoomFinalLineupReceipt(source.data?.metadata?.finalLineup)
        if (receipt?.announcementMessageId === announcement.data?.id && receipt?.sourceMessageId === sourceId) {
          sentMatch = { date: source.data?.metadata?.matchDate || '', opponent: source.data?.metadata?.opponent || '' }
        }
      }
    }
    const saved = scenarios.data?.find((row) => hasCompleteSavedLineup(row.slots_json))
    return Response.json({
      teammateConnected: (teammates.count || 0) > 0,
      lineupSaved: Boolean(saved || sentMatch),
      lineupSent: Boolean(sentMatch),
      match: sentMatch || { date: saved?.match_date || '', opponent: saved?.opponent_team || '', scenarioId: saved?.id || '' },
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return Response.json({ message: 'Setup progress could not be checked. Your saved work has not changed.' }, { status: 503 })
  }
}
