import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

const REVIEW_SELECT = 'event_id, status, review_note, reviewed_by_user_id, reviewed_at, updated_at'
const REVIEW_STATUSES = ['open', 'reviewed'] as const

type ProfileSyncReviewStatus = (typeof REVIEW_STATUSES)[number]

type PatchBody = {
  eventId?: unknown
  status?: unknown
  reviewNote?: unknown
}

export async function GET(request: Request) {
  const token = getBearerToken(request)
  const auth = createAuthedClient(token)
  const user = await getAuthenticatedUser(auth)
  if (!user.userId) {
    return Response.json({ ok: false, message: 'Sign in as an admin to review profile sync repairs.' }, { status: 401 })
  }
  if (!(await isAdmin(auth, user.userId))) {
    return Response.json({ ok: false, message: 'Admin access is required.' }, { status: 403 })
  }

  const service = createServiceClient()
  if (!service) {
    return Response.json({ ok: false, message: 'Profile sync review is not configured.' }, { status: 500 })
  }

  const { data, error } = await service
    .from('profile_sync_review_events')
    .select(REVIEW_SELECT)
    .order('updated_at', { ascending: false })
    .limit(500)

  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
  return Response.json({ ok: true, reviews: data || [] })
}

export async function PATCH(request: Request) {
  const token = getBearerToken(request)
  const auth = createAuthedClient(token)
  const user = await getAuthenticatedUser(auth)
  if (!user.userId) {
    return Response.json({ ok: false, message: 'Sign in as an admin to update profile sync reviews.' }, { status: 401 })
  }
  if (!(await isAdmin(auth, user.userId))) {
    return Response.json({ ok: false, message: 'Admin access is required.' }, { status: 403 })
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid profile sync review body.' }, { status: 400 })
  }

  const eventId = cleanText(body.eventId)
  const status = normalizeStatus(body.status)
  const reviewNote = cleanText(body.reviewNote, 1000)
  if (!eventId) {
    return Response.json({ ok: false, message: 'Missing profile sync event id.' }, { status: 400 })
  }
  if (status === 'reviewed' && reviewNote.length < 6) {
    return Response.json({ ok: false, message: 'Add a short note before marking this sync repair reviewed.' }, { status: 400 })
  }

  const service = createServiceClient()
  if (!service) {
    return Response.json({ ok: false, message: 'Profile sync review is not configured.' }, { status: 500 })
  }

  const { data: event, error: eventError } = await service
    .from('product_usage_events')
    .select('id, event_name')
    .eq('id', eventId)
    .maybeSingle()

  if (eventError) return Response.json({ ok: false, message: eventError.message }, { status: 500 })
  if (!event || cleanText((event as { event_name?: string | null }).event_name) !== 'profile_cloud_sync_repair') {
    return Response.json({ ok: false, message: 'Profile sync repair event was not found.' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const { data, error } = await service
    .from('profile_sync_review_events')
    .upsert({
      event_id: eventId,
      status,
      review_note: status === 'reviewed' ? reviewNote : '',
      reviewed_by_user_id: status === 'reviewed' ? user.userId : null,
      reviewed_at: status === 'reviewed' ? now : null,
      updated_at: now,
    }, { onConflict: 'event_id' })
    .select(REVIEW_SELECT)
    .single()

  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
  return Response.json({ ok: true, review: data })
}

async function getAuthenticatedUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user?.id) return { userId: '', email: '' }
  return { userId: data.user.id, email: data.user.email || '' }
}

async function isAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (error) return false
  return cleanText((data as { role?: string | null } | null)?.role) === 'admin'
}

function createAuthedClient(token: string) {
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

function createServiceClient() {
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

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}

function normalizeStatus(value: unknown): ProfileSyncReviewStatus {
  return REVIEW_STATUSES.includes(value as ProfileSyncReviewStatus) ? value as ProfileSyncReviewStatus : 'open'
}

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : ''
}
