import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  sanitizePlatformResumeCloudOperations,
  sanitizePlatformResumeSuppressions,
  type PlatformResumeSuppression,
} from '@/lib/platform-resume-preferences'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

type SuppressionRow = {
  fingerprint?: unknown
  mode?: unknown
  saved_at?: unknown
  until_at?: unknown
}

export async function GET(request: Request) {
  const auth = await getPreferencesAuth(request)
  if (!auth.ok) return auth.response

  const loaded = await loadSuppressions(auth.service, auth.userId)
  if (!loaded.ok) return loaded.response
  return Response.json({ ok: true, suppressions: loaded.suppressions, cloudAvailable: true })
}

export async function POST(request: Request) {
  const auth = await getPreferencesAuth(request)
  if (!auth.ok) return auth.response

  let body: { operations?: unknown }
  try {
    body = await request.json() as { operations?: unknown }
  } catch {
    return Response.json({ ok: false, message: 'Shortcut preferences are invalid.' }, { status: 400 })
  }

  const operations = sanitizePlatformResumeCloudOperations(body.operations)
  if (!operations.length) {
    return Response.json({ ok: false, message: 'No shortcut changes were provided.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const results = await Promise.all(operations.map(async (operation) => {
    const fingerprintHash = hashFingerprint(operation.fingerprint)
    if (operation.action === 'remove') {
      return auth.service
        .from('platform_resume_suppressions')
        .delete()
        .eq('user_id', auth.userId)
        .eq('fingerprint_hash', fingerprintHash)
    }

    const suppression = operation.suppression as PlatformResumeSuppression
    return auth.service
      .from('platform_resume_suppressions')
      .upsert({
        user_id: auth.userId,
        fingerprint_hash: fingerprintHash,
        fingerprint: suppression.fingerprint,
        mode: suppression.mode,
        saved_at: suppression.savedAt,
        until_at: suppression.until || null,
        updated_at: now,
      }, { onConflict: 'user_id,fingerprint_hash' })
  }))
  const operationError = results.find((result) => result.error)?.error
  if (operationError) {
    if (isMissingPreferencesTable(operationError.message)) {
      return Response.json({ ok: true, suppressions: [], cloudAvailable: false })
    }
    return Response.json({ ok: false, message: 'Shortcut preferences could not be saved.' }, { status: 500 })
  }

  await pruneSuppressions(auth.service, auth.userId, now)
  const loaded = await loadSuppressions(auth.service, auth.userId)
  if (!loaded.ok) return loaded.response
  return Response.json({ ok: true, suppressions: loaded.suppressions, cloudAvailable: true })
}

async function loadSuppressions(service: SupabaseClient, userId: string): Promise<
  | { ok: true; suppressions: PlatformResumeSuppression[] }
  | { ok: false; response: Response }
> {
  const { data, error } = await service
    .from('platform_resume_suppressions')
    .select('fingerprint,mode,saved_at,until_at')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false })
    .limit(30)

  if (error) {
    if (isMissingPreferencesTable(error.message)) {
      return { ok: false, response: Response.json({ ok: true, suppressions: [], cloudAvailable: false }) }
    }
    return { ok: false, response: Response.json({ ok: false, message: 'Shortcut preferences could not be restored.' }, { status: 500 }) }
  }

  const suppressions = sanitizePlatformResumeSuppressions(((data as SuppressionRow[] | null) || []).map((row) => ({
    fingerprint: row.fingerprint,
    mode: row.mode,
    savedAt: row.saved_at,
    until: row.until_at,
  })))
  return { ok: true, suppressions }
}

async function pruneSuppressions(service: SupabaseClient, userId: string, now: string) {
  await service
    .from('platform_resume_suppressions')
    .delete()
    .eq('user_id', userId)
    .eq('mode', 'later')
    .lte('until_at', now)

  const { data } = await service
    .from('platform_resume_suppressions')
    .select('fingerprint_hash')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false })
    .range(30, 59)
  const staleHashes = (data || []).flatMap((row) => (
    typeof row.fingerprint_hash === 'string' ? [row.fingerprint_hash] : []
  ))
  if (staleHashes.length) {
    await service
      .from('platform_resume_suppressions')
      .delete()
      .eq('user_id', userId)
      .in('fingerprint_hash', staleHashes)
  }
}

async function getPreferencesAuth(request: Request): Promise<
  | { ok: true; userId: string; service: SupabaseClient }
  | { ok: false; response: Response }
> {
  const token = getBearerToken(request)
  if (!token) {
    return { ok: false, response: Response.json({ ok: false, message: 'Sign in to sync shortcut preferences.' }, { status: 401 }) }
  }

  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false, response: Response.json({ ok: false, message: 'Sign in to sync shortcut preferences.' }, { status: 401 }) }
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return { ok: false, response: Response.json({ ok: false, message: 'Shortcut preference sync is not configured.' }, { status: 503 }) }
  }

  return {
    ok: true,
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

function hashFingerprint(fingerprint: string) {
  return createHash('sha256').update(fingerprint).digest('hex')
}

function isMissingPreferencesTable(message: string | null | undefined) {
  const normalized = (message || '').toLowerCase()
  return normalized.includes('platform_resume_suppressions')
    && (normalized.includes('does not exist') || normalized.includes('schema cache'))
}
