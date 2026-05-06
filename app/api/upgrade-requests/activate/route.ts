import { createClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import { buildProfileActivationPayload, resolveUpgradeActivationTarget } from '@/lib/upgrade-activation'

export const runtime = 'nodejs'

type ActivateRequestBody = {
  requestId?: unknown
}

export async function POST(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return Response.json({ ok: false, message: 'Admin sign-in required.' }, { status: 401 })
  }

  const adminCheck = await getAdminUserId(token)
  if (!adminCheck.ok) {
    return Response.json({ ok: false, message: adminCheck.message }, { status: adminCheck.status })
  }

  let body: ActivateRequestBody
  try {
    body = (await request.json()) as ActivateRequestBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid request body.' }, { status: 400 })
  }

  const requestId = cleanString(body.requestId)

  if (!requestId) {
    return Response.json({ ok: false, message: 'Missing upgrade request id.' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return Response.json(
      { ok: false, message: 'SUPABASE_SERVICE_ROLE_KEY is required to activate plan access.' },
      { status: 500 },
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const { data: requestRow, error: requestLoadError } = await supabase
    .from('upgrade_requests')
    .select('id, plan_id, requester_user_id, status')
    .eq('id', requestId)
    .maybeSingle()

  if (requestLoadError) {
    return Response.json({ ok: false, message: requestLoadError.message }, { status: 500 })
  }

  const activationTarget = resolveUpgradeActivationTarget(requestRow
    ? {
        id: String(requestRow.id),
        planId: typeof requestRow.plan_id === 'string' ? requestRow.plan_id : null,
        userId: typeof requestRow.requester_user_id === 'string' ? requestRow.requester_user_id : null,
        status: typeof requestRow.status === 'string' ? requestRow.status : null,
      }
    : null)

  if (!activationTarget.ok) {
    return Response.json(
      { ok: false, message: activationTarget.message },
      { status: activationTarget.status },
    )
  }

  const profilePayload = buildProfileActivationPayload(activationTarget.planId)
  const { error: profileError } = await supabase
    .from('profiles')
    .update(profilePayload)
    .eq('id', activationTarget.userId)

  if (profileError) {
    return Response.json({ ok: false, message: profileError.message }, { status: 500 })
  }

  const { error: requestError } = await supabase
    .from('upgrade_requests')
    .update({ status: 'converted' })
    .eq('id', activationTarget.requestId)

  if (requestError) {
    return Response.json({ ok: false, message: requestError.message }, { status: 500 })
  }

  return Response.json({ ok: true, message: `Activated ${activationTarget.planId} access.` })
}

async function getAdminUserId(token: string): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: number; message: string }
> {
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser(token)

  if (userError || !userData.user) {
    return { ok: false, status: 401, message: 'Admin sign-in required.' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError) {
    return { ok: false, status: 500, message: profileError.message }
  }

  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return { ok: false, status: 403, message: 'Admin access required.' }
  }

  return { ok: true, userId: userData.user.id }
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
