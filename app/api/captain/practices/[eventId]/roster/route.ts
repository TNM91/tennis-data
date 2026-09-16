import { createClient } from '@supabase/supabase-js'
import { getCaptainAvailabilityServiceClient } from '@/lib/captain-availability-request-server'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return Response.json({ message: 'Sign in to edit the practice roster.' }, { status: 401 })

  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: userData } = await authClient.auth.getUser(token)
  const userId = userData.user?.id || ''
  if (!userId) return Response.json({ message: 'Sign in to edit the practice roster.' }, { status: 401 })

  let body: { inviteeId?: unknown; status?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return Response.json({ message: 'Choose a player and try again.' }, { status: 400 })
  }
  const inviteeId = typeof body.inviteeId === 'string' ? body.inviteeId.trim() : ''
  const status = body.status
  if (!inviteeId || (status !== 'out' && status !== 'unanswered')) {
    return Response.json({ message: 'Choose a player and an availability status.' }, { status: 400 })
  }

  const eventId = (await params).eventId
  const service = getCaptainAvailabilityServiceClient()
  const { data: invite, error: inviteError } = await service
    .from('captain_practice_invites')
    .select('id,created_by_user_id,internal_schedule_events(status)')
    .eq('event_id', eventId)
    .maybeSingle()
  if (inviteError) return Response.json({ message: 'The practice could not be checked.' }, { status: 500 })
  if (!invite || invite.created_by_user_id !== userId) {
    return Response.json({ message: 'Only the captain who created this practice can edit its roster.' }, { status: 403 })
  }
  const event = invite.internal_schedule_events as unknown as { status: string } | null
  if (event?.status === 'cancelled') {
    return Response.json({ message: 'This practice has been cancelled.' }, { status: 409 })
  }

  const { data: player, error: playerError } = await service
    .from('captain_practice_invitees')
    .select('id,profile_id,player_name,response_status')
    .eq('id', inviteeId)
    .eq('invite_id', invite.id)
    .maybeSingle()
  if (playerError) return Response.json({ message: 'The player could not be checked.' }, { status: 500 })
  if (!player) return Response.json({ message: 'This player is not on the practice roster.' }, { status: 404 })

  const now = new Date().toISOString()
  const { error } = await service
    .from('captain_practice_invitees')
    .update({
      response_status: status,
      responded_at: status === 'out' ? now : null,
      captain_confirmed_at: null,
      captain_confirmed_by_user_id: null,
    })
    .eq('id', player.id)
    .eq('invite_id', invite.id)
  if (error) return Response.json({ message: 'The practice roster could not be updated.' }, { status: 500 })

  if (player.profile_id) {
    const { error: responseError } = await service.from('internal_schedule_event_responses').upsert({
      event_id: eventId,
      profile_id: player.profile_id,
      response_status: status,
      updated_at: now,
    }, { onConflict: 'event_id,profile_id' })
    if (responseError) {
      return Response.json({ message: 'The roster changed, but the linked team reply could not sync. Refresh before trying again.' }, { status: 500 })
    }
  }

  return Response.json({ ok: true, playerName: player.player_name, status })
}
