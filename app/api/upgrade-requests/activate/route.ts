import { createClient } from '@supabase/supabase-js'
import type { PricingPlanId } from '@/lib/pricing-plans'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

type ActivateRequestBody = {
  requestId?: unknown
  planId?: unknown
  userId?: unknown
}

const ACTIVATABLE_PLAN_IDS: PricingPlanId[] = ['player_plus', 'captain', 'league']

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
  const userId = cleanString(body.userId)
  const planId = cleanString(body.planId) as PricingPlanId

  if (!requestId) {
    return Response.json({ ok: false, message: 'Missing upgrade request id.' }, { status: 400 })
  }

  if (!userId) {
    return Response.json({ ok: false, message: 'This request is not linked to an account yet.' }, { status: 400 })
  }

  if (!ACTIVATABLE_PLAN_IDS.includes(planId)) {
    return Response.json({ ok: false, message: 'This plan cannot be activated from the request queue.' }, { status: 400 })
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

  const profilePayload = buildProfileActivationPayload(planId)
  const { error: profileError } = await supabase
    .from('profiles')
    .update(profilePayload)
    .eq('id', userId)

  if (profileError) {
    return Response.json({ ok: false, message: profileError.message }, { status: 500 })
  }

  const { error: requestError } = await supabase
    .from('upgrade_requests')
    .update({ status: 'converted' })
    .eq('id', requestId)

  if (requestError) {
    return Response.json({ ok: false, message: requestError.message }, { status: 500 })
  }

  return Response.json({ ok: true, message: `Activated ${planId} access.` })
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

function buildProfileActivationPayload(planId: PricingPlanId) {
  const payload: Record<string, boolean | string> = {
    player_plus_subscription_active: true,
    player_plus_subscription_status: 'active',
  }

  if (planId === 'captain') {
    payload.captain_subscription_active = true
    payload.captain_subscription_status = 'active'
  }

  if (planId === 'league') {
    payload.tiq_team_league_entry_enabled = true
    payload.tiq_individual_league_creator_enabled = true
  }

  return payload
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
