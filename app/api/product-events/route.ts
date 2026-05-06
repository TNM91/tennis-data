import { createClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import { buildProductUsageEventInsert } from '@/lib/product-usage-events'

export const runtime = 'nodejs'

type ProductUsageEventInserter = {
  from(table: 'product_usage_events'): {
    insert(payload: Record<string, unknown>): PromiseLike<{
      error: { message?: string } | null
    }>
  }
}

export async function POST(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return Response.json({ ok: false, message: 'Sign in to record product activity.' }, { status: 401 })
  }

  const userResult = await getRequesterUser(token)
  if (!userResult.userId) {
    return Response.json({ ok: false, message: 'Sign in to record product activity.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const payload = buildProductUsageEventInsert(userResult.userId, {
    eventName: typeof body?.eventName === 'string' ? body.eventName : undefined,
    surface: typeof body?.surface === 'string' ? body.surface : undefined,
    planId: typeof body?.planId === 'string' ? body.planId : undefined,
    metadata: isRecord(body?.metadata) ? body.metadata : undefined,
  })

  if (!payload) {
    return Response.json({ ok: false, message: 'Product event is not valid.' }, { status: 400 })
  }

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
  }) as unknown as ProductUsageEventInserter

  const { error } = await supabase
    .from('product_usage_events')
    .insert(payload)

  if (error) {
    return Response.json({ ok: false, message: error.message ?? 'Product event could not be recorded.' }, { status: 500 })
  }

  return Response.json({ ok: true })
}

async function getRequesterUser(token: string) {
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
  const { data, error } = await supabase.auth.getUser(token)

  if (error) return { userId: undefined }
  return { userId: data.user?.id }
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
