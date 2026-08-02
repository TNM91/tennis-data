import { createClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

type PushBody = {
  action?: unknown
  endpoint?: unknown
  keys?: {
    p256dh?: unknown
    auth?: unknown
  }
}

export async function POST(request: Request) {
  const auth = await getPushAuth(request)
  if (!auth.ok) return auth.response

  let body: PushBody
  try {
    body = await request.json() as PushBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid notification request.' }, { status: 400 })
  }

  const endpoint = cleanText(body.endpoint)
  if (!endpoint.startsWith('https://') || endpoint.length > 2048) {
    return Response.json({ ok: false, message: 'This notification endpoint is invalid.' }, { status: 400 })
  }

  if (cleanText(body.action) === 'unsubscribe') {
    const { error } = await auth.service
      .from('team_room_push_subscriptions')
      .delete()
      .eq('profile_id', auth.userId)
      .eq('endpoint', endpoint)
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    return Response.json({ ok: true, subscribed: false })
  }

  const p256dh = cleanText(body.keys?.p256dh)
  const authKey = cleanText(body.keys?.auth)
  if (!p256dh || !authKey || p256dh.length > 512 || authKey.length > 512) {
    return Response.json({ ok: false, message: 'This browser did not provide valid notification keys.' }, { status: 400 })
  }

  const { data: existing } = await auth.service
    .from('team_room_push_subscriptions')
    .select('profile_id')
    .eq('endpoint', endpoint)
    .maybeSingle()
  if (existing?.profile_id && existing.profile_id !== auth.userId) {
    return Response.json({ ok: false, message: 'This notification endpoint belongs to another profile.' }, { status: 409 })
  }

  const { error } = await auth.service
    .from('team_room_push_subscriptions')
    .upsert({
      profile_id: auth.userId,
      endpoint,
      p256dh,
      auth_key: authKey,
      user_agent: cleanText(request.headers.get('user-agent')).slice(0, 500),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })
  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
  return Response.json({ ok: true, subscribed: true })
}

async function getPushAuth(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Sign in to manage team alerts.' }, { status: 401 }) }
  }
  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Sign in to manage team alerts.' }, { status: 401 }) }
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Team alerts are not configured yet.' }, { status: 503 }) }
  }
  return {
    ok: true as const,
    userId: data.user.id,
    service: createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  }
}

function getBearerToken(request: Request) {
  const value = request.headers.get('authorization') || ''
  return value.toLowerCase().startsWith('bearer ') ? value.slice('bearer '.length).trim() : ''
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
