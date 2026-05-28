import { createClient } from '@supabase/supabase-js'
import {
  canAcceptCoachInviteEmail,
  isCoachInviteExpired,
  mapCoachInviteRow,
  type CoachStudentInviteRow,
} from '@/lib/coach-invites'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

type InviteDetailRow = CoachStudentInviteRow & {
  coach_user_id: string
      coach_player_links?:
    | {
        coach_user_id?: string | null
        player_name: string | null
        identity_slug: string | null
        level_label: string | null
      }
    | {
        coach_user_id?: string | null
        player_name: string | null
        identity_slug: string | null
        level_label: string | null
      }[]
    | null
}

type InviteStudentRow = {
  coach_user_id?: string | null
  player_name: string | null
  identity_slug: string | null
  level_label: string | null
}

function getInviteStudentRow(row: InviteDetailRow): InviteStudentRow | null {
  if (Array.isArray(row.coach_player_links)) return row.coach_player_links[0] ?? null
  return row.coach_player_links ?? null
}

type InviteAcceptanceRow = {
  id: string
  student_link_id: string | null
  invite_email: string
  status: string
  expires_at: string | null
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const token = (await context.params).token?.trim() ?? ''
  if (!token) return Response.json({ ok: false, message: 'Invite token is missing.' }, { status: 400 })

  const service = getServiceClient()
  if (!service) {
    return Response.json({ ok: false, message: 'Coach invites are not configured yet.' }, { status: 503 })
  }

  const { data, error } = await service
    .from('coach_student_invites')
    .select('id,coach_user_id,student_link_id,invite_email,invite_token,status,message,expires_at,updated_at,coach_player_links(coach_user_id,player_name,identity_slug,level_label)')
    .eq('invite_token', token)
    .maybeSingle()

  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
  if (!data) return Response.json({ ok: false, message: 'Coach invite was not found.' }, { status: 404 })

  const row = data as unknown as InviteDetailRow
  const student = getInviteStudentRow(row)
  return Response.json({
    ok: true,
    invite: mapCoachInviteRow(row, new URL(request.url).origin),
    student: {
      playerName: student?.player_name ?? 'Invited player',
      identitySlug: student?.identity_slug ?? 'relentless-competitor-4-0',
      levelLabel: student?.level_label ?? '',
    },
  })
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const token = (await context.params).token?.trim() ?? ''
  if (!token) return Response.json({ ok: false, message: 'Invite token is missing.' }, { status: 400 })

  const service = getServiceClient()
  if (!service) {
    return Response.json({ ok: false, message: 'Coach invites are not configured yet.' }, { status: 503 })
  }

  const authToken = getBearerToken(request)
  if (!authToken) {
    return Response.json({ ok: false, message: 'Sign in to accept this coach invite.' }, { status: 401 })
  }

  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${authToken}` } },
  })
  const { data: userData, error: userError } = await authClient.auth.getUser(authToken)
  const user = userData.user
  if (userError || !user) {
    return Response.json({ ok: false, message: 'Sign in to accept this coach invite.' }, { status: 401 })
  }

  const { data: inviteData, error: inviteError } = await service
    .from('coach_student_invites')
    .select('id,student_link_id,invite_email,status,expires_at')
    .eq('invite_token', token)
    .maybeSingle()

  if (inviteError) return Response.json({ ok: false, message: inviteError.message }, { status: 500 })
  const invite = inviteData as InviteAcceptanceRow | null
  if (!invite) return Response.json({ ok: false, message: 'Coach invite was not found.' }, { status: 404 })
  if (invite.status !== 'pending') return Response.json({ ok: false, message: 'This coach invite is no longer pending.' }, { status: 409 })
  if (isCoachInviteExpired(invite.expires_at)) {
    await service.from('coach_student_invites').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', invite.id)
    return Response.json({ ok: false, message: 'This coach invite has expired.' }, { status: 410 })
  }

  if (!canAcceptCoachInviteEmail(invite.invite_email, user.email)) {
    return Response.json({ ok: false, message: 'Sign in with the email address this coach invited.' }, { status: 403 })
  }

  if (invite.student_link_id) {
    const { error: linkError } = await service
      .from('coach_player_links')
      .update({ player_user_id: user.id, status: 'active', updated_at: new Date().toISOString() })
      .eq('id', invite.student_link_id)

    if (linkError) return Response.json({ ok: false, message: linkError.message }, { status: 500 })
  }

  const { error: acceptError } = await service
    .from('coach_student_invites')
    .update({
      status: 'accepted',
      accepted_by_user_id: user.id,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', invite.id)

  if (acceptError) return Response.json({ ok: false, message: acceptError.message }, { status: 500 })

  return Response.json({ ok: true })
}

function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return null
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}
