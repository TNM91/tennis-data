import { createClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import {
  mapUpgradeRequestRecordToInsert,
  mapUpgradeRequestRow,
  type UpgradeRequestRecord,
  type UpgradeRequestRow,
} from '@/lib/upgrade-requests'
import type { PricingPlanId } from '@/lib/pricing-plans'

export const runtime = 'nodejs'

type UpgradeRequestBody = Partial<UpgradeRequestRecord>
type ClaimRequestBody = {
  requestId?: unknown
}

const PAID_PLAN_IDS: PricingPlanId[] = ['player_plus', 'captain', 'league']

export async function POST(request: Request) {
  let body: UpgradeRequestBody

  try {
    body = (await request.json()) as UpgradeRequestBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid request body.' }, { status: 400 })
  }

  const planId = body.planId
  const email = cleanString(body.email).toLowerCase()
  const goal = cleanString(body.goal)

  if (!planId || !PAID_PLAN_IDS.includes(planId)) {
    return Response.json({ ok: false, message: 'Choose a paid plan.' }, { status: 400 })
  }

  if (!email || !email.includes('@')) {
    return Response.json({ ok: false, message: 'Enter a valid email.' }, { status: 400 })
  }

  if (!goal) {
    return Response.json({ ok: false, message: 'Tell us what you want TenAceIQ to help with first.' }, { status: 400 })
  }

  const token = getBearerToken(request)
  const record: UpgradeRequestRecord = {
    id: '',
    planId,
    planName: cleanString(body.planName) || planId,
    name: cleanString(body.name),
    email,
    userId: await getRequesterUserId(token),
    organization: cleanString(body.organization),
    goal,
    nextHref: sanitizeNextHref(body.nextHref),
    createdAt: '',
    status: 'pending',
    source: 'supabase',
  }

  const supabase = createUpgradeRequestWriteClient()

  if (!supabase) {
    return Response.json(
      { ok: false, message: 'Upgrade request capture is not configured.' },
      { status: 500 },
    )
  }

  const { data, error } = await supabase
    .from('upgrade_requests')
    .insert(mapUpgradeRequestRecordToInsert(record))
    .select('id, plan_id, plan_name, requester_name, requester_email, requester_user_id, organization, goal, next_href, status, source, created_at, updated_at')
    .single()

  if (error) {
    return Response.json(
      {
        ok: false,
        message: error.message || 'Upgrade request could not be saved.',
      },
      { status: 500 },
    )
  }

  return Response.json({ ok: true, request: mapUpgradeRequestRow(data as UpgradeRequestRow) })
}

export async function PATCH(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return Response.json({ ok: false, message: 'Sign in to link this request.' }, { status: 401 })
  }

  const userResult = await getRequesterUser(token)
  if (!userResult.userId || !userResult.email) {
    return Response.json({ ok: false, message: 'Sign in to link this request.' }, { status: 401 })
  }

  let body: ClaimRequestBody
  try {
    body = (await request.json()) as ClaimRequestBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid request body.' }, { status: 400 })
  }

  const requestId = cleanString(body.requestId)
  if (!requestId) {
    return Response.json({ ok: false, message: 'Missing request id.' }, { status: 400 })
  }

  const supabase = createUpgradeRequestWriteClient()

  if (!supabase) {
    return Response.json(
      { ok: false, message: 'Upgrade request capture is not configured.' },
      { status: 500 },
    )
  }

  const { data: existing, error: loadError } = await supabase
    .from('upgrade_requests')
    .select('id, requester_email, requester_user_id')
    .eq('id', requestId)
    .maybeSingle()

  if (loadError) {
    return Response.json({ ok: false, message: loadError.message }, { status: 500 })
  }

  if (!existing) {
    return Response.json({ ok: false, message: 'Upgrade request was not found.' }, { status: 404 })
  }

  const row = existing as { requester_email?: string | null; requester_user_id?: string | null }
  if ((row.requester_email ?? '').toLowerCase() !== userResult.email.toLowerCase()) {
    return Response.json({ ok: false, message: 'This signed-in email does not match the request email.' }, { status: 403 })
  }

  if (row.requester_user_id && row.requester_user_id !== userResult.userId) {
    return Response.json({ ok: false, message: 'This request is already linked to another account.' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('upgrade_requests')
    .update({ requester_user_id: userResult.userId })
    .eq('id', requestId)
    .select('id, plan_id, plan_name, requester_name, requester_email, requester_user_id, organization, goal, next_href, status, source, created_at, updated_at')
    .single()

  if (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, request: mapUpgradeRequestRow(data as UpgradeRequestRow) })
}

async function getRequesterUserId(token: string) {
  if (!token) return undefined

  const user = await getRequesterUser(token)
  return user.userId
}

async function getRequesterUser(token: string) {
  const supabase = createRequestSupabaseClient(token)
  const { data, error } = await supabase.auth.getUser(token)

  if (error) return { userId: undefined, email: undefined }
  return { userId: data.user?.id, email: data.user?.email ?? undefined }
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}

function createRequestSupabaseClient(token: string) {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined,
  })
}

function createUpgradeRequestWriteClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 1000) : ''
}

function sanitizeNextHref(value: unknown) {
  const candidate = cleanString(value)
  if (!candidate.startsWith('/')) return ''
  if (candidate.startsWith('//')) return ''
  return candidate.slice(0, 240)
}
