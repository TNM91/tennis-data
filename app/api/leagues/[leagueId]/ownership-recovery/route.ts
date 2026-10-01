import { createClient } from '@supabase/supabase-js'
import {
  canRecoverLegacyLeagueOwnership,
  matchesLeagueNameConfirmation,
} from '@/lib/league-ownership-recovery'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

type RecoveryBody = { confirmation?: unknown }
type LeagueRow = { id: string; league_name: string; created_by_user_id: string | null }

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leagueId: string }> },
) {
  const token = getBearerToken(request)
  if (!token) return Response.json({ ok: false, message: 'Sign in to restore league access.' }, { status: 401 })

  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: requesterData, error: requesterError } = await authClient.auth.getUser(token)
  const requester = requesterData.user
  if (requesterError || !requester) {
    return Response.json({ ok: false, message: 'Sign in to restore league access.' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return Response.json({ ok: false, message: 'League access recovery is not configured.' }, { status: 503 })
  }
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const leagueId = decodeURIComponent((await params).leagueId || '').trim()
  if (!leagueId) return Response.json({ ok: false, message: 'Choose a league to continue.' }, { status: 400 })

  let body: RecoveryBody
  try {
    body = (await request.json()) as RecoveryBody
  } catch {
    return Response.json({ ok: false, message: 'Type the league name to confirm.' }, { status: 400 })
  }

  const { data: leagueData, error: leagueError } = await service
    .from('tiq_leagues')
    .select('id,league_name,created_by_user_id')
    .eq('id', leagueId)
    .maybeSingle()
  const league = leagueData as LeagueRow | null
  if (leagueError || !league) return Response.json({ ok: false, message: 'That league could not be found.' }, { status: 404 })

  const confirmation = typeof body.confirmation === 'string' ? body.confirmation : ''
  if (!matchesLeagueNameConfirmation(league.league_name, confirmation)) {
    return Response.json({ ok: false, message: 'The league name does not match.' }, { status: 400 })
  }
  if (league.created_by_user_id === requester.id) return Response.json({ ok: true, alreadyOwner: true })

  const [profileResult, previousOwnerResult] = await Promise.all([
    service.from('profiles').select('role').eq('id', requester.id).maybeSingle(),
    league.created_by_user_id
      ? service.auth.admin.getUserById(league.created_by_user_id)
      : Promise.resolve({ data: { user: null }, error: null }),
  ])
  if (profileResult.error || previousOwnerResult.error) {
    return Response.json({ ok: false, message: 'League ownership could not be verified.' }, { status: 503 })
  }

  const previousOwner = previousOwnerResult.data.user
  const canRecover = canRecoverLegacyLeagueOwnership({
    requesterEmail: requester.email,
    requesterEmailConfirmed: Boolean(requester.email_confirmed_at),
    previousOwnerEmail: previousOwner?.email,
    previousOwnerEmailConfirmed: Boolean(previousOwner?.email_confirmed_at),
    requesterIsAdmin: (profileResult.data as { role?: string } | null)?.role === 'admin',
  })
  if (!canRecover) {
    return Response.json({
      ok: false,
      message: 'This league belongs to a different account. Ask its current owner or a TenAceIQ admin to transfer it.',
    }, { status: 403 })
  }

  let updateQuery = service
    .from('tiq_leagues')
    .update({
      created_by_user_id: requester.id,
      updated_by_user_id: requester.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', league.id)
  updateQuery = league.created_by_user_id
    ? updateQuery.eq('created_by_user_id', league.created_by_user_id)
    : updateQuery.is('created_by_user_id', null)

  const { data: updated, error: updateError } = await updateQuery.select('id').maybeSingle()
  if (updateError || !updated?.id) {
    return Response.json({ ok: false, message: 'League ownership changed before access could be restored. Refresh and try again.' }, { status: 409 })
  }

  return Response.json({ ok: true, alreadyOwner: false })
}

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization')
  return header?.toLowerCase().startsWith('bearer ') ? header.slice('bearer '.length).trim() : ''
}
