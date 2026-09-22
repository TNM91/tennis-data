import { createClient } from '@supabase/supabase-js'
import { sanitizeExploreResumeState } from '@/lib/explore-memory'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

type ResumeRow = { resume_state?: unknown; updated_at?: string | null }

export async function GET(request: Request) {
  const auth = await getResumeAuth(request)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.service
    .from('explore_workspace_preferences')
    .select('resume_state,updated_at')
    .eq('user_id', auth.userId)
    .maybeSingle()

  if (error) {
    if (isMissingResumeTable(error.message)) return Response.json({ ok: true, resume: null, cloudAvailable: false })
    return Response.json({ ok: false, message: 'Explore could not restore your last view.' }, { status: 500 })
  }

  const row = data as ResumeRow | null
  const resume = sanitizeExploreResumeState(row?.resume_state)
  if (row?.updated_at && !resume.lastVisitedAt) resume.lastVisitedAt = row.updated_at
  return Response.json({ ok: true, resume: Object.keys(resume).length ? resume : null, cloudAvailable: true })
}

export async function POST(request: Request) {
  const auth = await getResumeAuth(request)
  if (!auth.ok) return auth.response

  let body: { resume?: unknown }
  try {
    body = (await request.json()) as { resume?: unknown }
  } catch {
    return Response.json({ ok: false, message: 'Explore resume data is invalid.' }, { status: 400 })
  }

  const resume = sanitizeExploreResumeState(body.resume)
  if (!Object.keys(resume).length) {
    return Response.json({ ok: false, message: 'Explore resume data is empty.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  resume.lastVisitedAt = resume.lastVisitedAt || now
  const { error } = await auth.service
    .from('explore_workspace_preferences')
    .upsert({ user_id: auth.userId, resume_state: resume, updated_at: now }, { onConflict: 'user_id' })

  if (error) {
    if (isMissingResumeTable(error.message)) return Response.json({ ok: true, resume, cloudAvailable: false })
    return Response.json({ ok: false, message: 'Explore could not save your last view.' }, { status: 500 })
  }

  return Response.json({ ok: true, resume, cloudAvailable: true })
}

async function getResumeAuth(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Sign in to resume Explore.' }, { status: 401 }) }
  }

  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Sign in to resume Explore.' }, { status: 401 }) }
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Explore cloud resume is not configured.' }, { status: 503 }) }
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
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}

function isMissingResumeTable(message: string | null | undefined) {
  const normalized = (message || '').toLowerCase()
  return normalized.includes('explore_workspace_preferences')
    && (normalized.includes('does not exist') || normalized.includes('schema cache'))
}
