import { createClient } from '@supabase/supabase-js'
import {
  canAcceptLeagueDelegateInvite,
  getLeagueDelegateDisplayName,
  isLeagueDelegateInviteExpired,
} from '@/lib/league-delegates'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

type DelegateInviteRow = {
  id: string
  league_id: string
  email: string
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  accepted_by_user_id: string | null
  expires_at: string
}

function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return null
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

function getBearerToken(request: Request) {
  const value = request.headers.get('authorization') || ''
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : ''
}

async function loadInvite(token: string) {
  const service = getServiceClient()
  if (!service) return { service: null, invite: null, league: null, error: 'League delegate invites are not configured yet.' }
  const { data: invite, error } = await service
    .from('tiq_league_delegate_invites')
    .select('id,league_id,email,status,accepted_by_user_id,expires_at')
    .eq('invite_token', token)
    .maybeSingle()
  if (error || !invite) return { service, invite: null, league: null, error: 'This league delegate invite is no longer available.' }
  const { data: league } = await service
    .from('tiq_leagues')
    .select('league_name,photo_url')
    .eq('id', invite.league_id)
    .maybeSingle()
  if (!league) return { service, invite: null, league: null, error: 'This league is no longer available.' }
  return { service, invite: invite as DelegateInviteRow, league, error: '' }
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token?.trim() || ''
  if (!token) return Response.json({ ok: false, message: 'Invite token is missing.' }, { status: 400 })
  const loaded = await loadInvite(token)
  if (!loaded.service) return Response.json({ ok: false, message: loaded.error }, { status: 503 })
  if (!loaded.invite || !loaded.league) return Response.json({ ok: false, message: loaded.error }, { status: 404 })
  if (loaded.invite.status === 'pending' && isLeagueDelegateInviteExpired(loaded.invite.expires_at)) {
    await loaded.service.from('tiq_league_delegate_invites').update({ status: 'expired' }).eq('id', loaded.invite.id)
    loaded.invite.status = 'expired'
  }
  return Response.json({
    ok: true,
    invite: {
      email: loaded.invite.email,
      status: loaded.invite.status,
      expiresAt: loaded.invite.expires_at,
      leagueName: loaded.league.league_name,
      logoUrl: loaded.league.photo_url || '',
    },
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token?.trim() || ''
  if (!token) return Response.json({ ok: false, message: 'Invite token is missing.' }, { status: 400 })
  const loaded = await loadInvite(token)
  if (!loaded.service) return Response.json({ ok: false, message: loaded.error }, { status: 503 })
  if (!loaded.invite || !loaded.league) return Response.json({ ok: false, message: loaded.error }, { status: 404 })

  const authToken = getBearerToken(request)
  if (!authToken) return Response.json({ ok: false, message: 'Sign in to accept this league invitation.' }, { status: 401 })
  const auth = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${authToken}` } },
  })
  const { data: userData, error: userError } = await auth.auth.getUser(authToken)
  const user = userData.user
  if (userError || !user) return Response.json({ ok: false, message: 'Sign in to accept this league invitation.' }, { status: 401 })
  if (loaded.invite.status === 'accepted' && loaded.invite.accepted_by_user_id === user.id) {
    return Response.json({ ok: true, leagueId: loaded.invite.league_id })
  }
  if (loaded.invite.status !== 'pending') return Response.json({ ok: false, message: 'This league invitation is no longer pending.' }, { status: 409 })
  if (isLeagueDelegateInviteExpired(loaded.invite.expires_at)) {
    await loaded.service.from('tiq_league_delegate_invites').update({ status: 'expired' }).eq('id', loaded.invite.id)
    return Response.json({ ok: false, message: 'This league invitation has expired.' }, { status: 410 })
  }
  if (!canAcceptLeagueDelegateInvite(loaded.invite.email, user.email)) {
    return Response.json({ ok: false, message: `Sign in with ${loaded.invite.email} to accept this league invitation.` }, { status: 403 })
  }

  const { error: delegateError } = await loaded.service.from('tiq_league_delegates').upsert({
    league_id: loaded.invite.league_id,
    user_id: user.id,
    role: 'delegate',
    email: loaded.invite.email,
    display_name: getLeagueDelegateDisplayName(user.user_metadata, user.email),
  }, { onConflict: 'league_id,user_id' })
  if (delegateError) return Response.json({ ok: false, message: 'League access could not be activated.' }, { status: 500 })

  const { error: inviteError } = await loaded.service.from('tiq_league_delegate_invites').update({
    status: 'accepted',
    accepted_by_user_id: user.id,
    accepted_at: new Date().toISOString(),
  }).eq('id', loaded.invite.id).eq('status', 'pending')
  if (inviteError) return Response.json({ ok: false, message: 'League access was added, but the invitation could not be closed.' }, { status: 500 })
  return Response.json({ ok: true, leagueId: loaded.invite.league_id })
}
