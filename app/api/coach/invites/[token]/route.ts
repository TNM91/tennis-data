import { createClient } from '@supabase/supabase-js'
import {acceptCoachInvitation, CoachInviteAcceptanceFault} from '@/lib/coach-invite-acceptance'
import {
  mapCoachInviteRow,
  type CoachStudentInviteRow,
} from '@/lib/coach-invites'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'
const json = (body: unknown, init?: ResponseInit) => Response.json(body, {...init, headers: {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer'}})

type InviteDetailRow = CoachStudentInviteRow & {
  coach_user_id: string
  accepted_by_user_id?: string | null
  coach_player_links?:
    | {
        player_user_id?: string | null
        coach_user_id?: string | null
        player_name: string | null
        identity_slug: string | null
        level_label: string | null
      }
    | {
        player_user_id?: string | null
        coach_user_id?: string | null
        player_name: string | null
        identity_slug: string | null
        level_label: string | null
      }[]
    | null
}

type InviteStudentRow = {
  coach_user_id?: string | null
  player_user_id?: string | null
  player_name: string | null
  identity_slug: string | null
  level_label: string | null
}

function getInviteStudentRow(row: InviteDetailRow): InviteStudentRow | null {
  if (Array.isArray(row.coach_player_links)) return row.coach_player_links[0] ?? null
  return row.coach_player_links ?? null
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const token = (await context.params).token?.trim() ?? ''
  if (!/^[a-zA-Z0-9_.:-]{1,120}$/.test(token)) return json({ ok: false, message: 'Invite token is missing or invalid.' }, { status: 400 })

  const service = getServiceClient()
  if (!service) {
    return json({ ok: false, message: 'Coach invites are not configured yet.' }, { status: 503 })
  }

  const { data, error } = await service
    .from('coach_student_invites')
    .select('id,coach_user_id,student_link_id,invite_email,invite_token,status,message,expires_at,updated_at,accepted_by_user_id,coach_player_links(coach_user_id,player_user_id,player_name,identity_slug,level_label)')
    .eq('invite_token', token)
    .maybeSingle()

  if (error) return json({ok: false, message: 'That invitation is temporarily unavailable.'}, {status: 503})
  if (!data) return json({ ok: false, message: 'Coach invite was not found.' }, { status: 404 })

  const row = data as unknown as InviteDetailRow
  const student = getInviteStudentRow(row)
  if (student?.coach_user_id !== undefined && student.coach_user_id !== row.coach_user_id) return json({ok: false, message: 'This student connection is unavailable.'}, {status: 409})
  return json({
    ok: true,
    invite: mapCoachInviteRow({...row, status: row.status === 'accepted' && row.student_link_id && student?.player_user_id !== row.accepted_by_user_id ? 'pending' : row.status}, new URL(request.url).origin),
    student: {
      playerName: student?.player_name ?? 'Invited player',
      identitySlug: student?.identity_slug ?? 'relentless-competitor-4-0',
      levelLabel: student?.level_label ?? '',
    },
  })
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const token = (await context.params).token?.trim() ?? ''
  if (!/^[a-zA-Z0-9_.:-]{1,120}$/.test(token)) return json({ ok: false, message: 'Invite token is missing or invalid.' }, { status: 400 })

  const service = getServiceClient()
  if (!service) {
    return json({ ok: false, message: 'Coach invites are not configured yet.' }, { status: 503 })
  }

  const authToken = getBearerToken(request)
  if (!authToken) {
    return json({ ok: false, message: 'Sign in to accept this coach invite.' }, { status: 401 })
  }

  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${authToken}` } },
  })
  const { data: userData, error: userError } = await authClient.auth.getUser(authToken)
  const user = userData.user
  if (userError || !user) {
    return json({ ok: false, message: 'Sign in to accept this coach invite.' }, { status: 401 })
  }

  try {await acceptCoachInvitation(service, token, user); return json({ok: true})}
  catch (error) {return error instanceof CoachInviteAcceptanceFault ? json({ok: false, message: error.message}, {status: error.status}) : json({ok: false, message: 'The connection could not be confirmed. Refresh the invitation and try again.'}, {status: 503})}
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
