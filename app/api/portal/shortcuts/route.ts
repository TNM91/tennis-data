import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  isPinnedPortalShortcutList,
  normalizePinnedPortalShortcuts,
} from '@/lib/portal-lane-preferences'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

type PortalShortcutPreferenceRow = {
  shortcut_ids?: unknown
  personalization_cue_dismissed?: unknown
  updated_at?: unknown
}

export async function GET(request: Request) {
  const auth = await getShortcutAuth(request)
  if (!auth.ok) return auth.response

  const loaded = await loadShortcutPreferences(auth.service, auth.userId)
  if (!loaded.ok) return loaded.response
  return Response.json({ ok: true, ...loaded.state, cloudAvailable: true })
}

export async function PUT(request: Request) {
  const auth = await getShortcutAuth(request)
  if (!auth.ok) return auth.response

  let body: { shortcuts?: unknown; cueDismissed?: unknown }
  try {
    body = await request.json() as { shortcuts?: unknown; cueDismissed?: unknown }
  } catch {
    return Response.json({ ok: false, message: 'Shortcut preferences are invalid.' }, { status: 400 })
  }

  if (!isPinnedPortalShortcutList(body.shortcuts) || typeof body.cueDismissed !== 'boolean') {
    return Response.json({ ok: false, message: 'Choose four valid shortcuts.' }, { status: 400 })
  }

  const updatedAt = new Date().toISOString()
  const shortcuts = normalizePinnedPortalShortcuts(body.shortcuts)
  const { error } = await auth.service
    .from('portal_shortcut_preferences')
    .upsert({
      user_id: auth.userId,
      shortcut_ids: shortcuts,
      personalization_cue_dismissed: body.cueDismissed,
      updated_at: updatedAt,
    }, { onConflict: 'user_id' })

  if (error) {
    if (isMissingShortcutPreferencesTable(error.message)) {
      return Response.json({ ok: true, shortcuts, cueDismissed: body.cueDismissed, cloudAvailable: false, updatedAt: null })
    }
    return Response.json({ ok: false, message: 'Shortcuts could not be synced.' }, { status: 500 })
  }

  return Response.json({ ok: true, shortcuts, cueDismissed: body.cueDismissed, cloudAvailable: true, updatedAt })
}

async function loadShortcutPreferences(service: SupabaseClient, userId: string): Promise<
  | { ok: true; state: { shortcuts: ReturnType<typeof normalizePinnedPortalShortcuts> | null; cueDismissed: boolean; updatedAt: string | null } }
  | { ok: false; response: Response }
> {
  const { data, error } = await service
    .from('portal_shortcut_preferences')
    .select('shortcut_ids,personalization_cue_dismissed,updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    if (isMissingShortcutPreferencesTable(error.message)) {
      return { ok: false, response: Response.json({ ok: true, shortcuts: null, cueDismissed: false, cloudAvailable: false, updatedAt: null }) }
    }
    return { ok: false, response: Response.json({ ok: false, message: 'Shortcuts could not be restored.' }, { status: 500 }) }
  }

  const row = data as PortalShortcutPreferenceRow | null
  return {
    ok: true,
    state: {
      shortcuts: isPinnedPortalShortcutList(row?.shortcut_ids)
        ? normalizePinnedPortalShortcuts(row?.shortcut_ids)
        : null,
      cueDismissed: row?.personalization_cue_dismissed === true,
      updatedAt: typeof row?.updated_at === 'string' ? row.updated_at : null,
    },
  }
}

async function getShortcutAuth(request: Request): Promise<
  | { ok: true; userId: string; service: SupabaseClient }
  | { ok: false; response: Response }
> {
  const token = getBearerToken(request)
  if (!token) {
    return { ok: false, response: Response.json({ ok: false, message: 'Sign in to sync shortcuts.' }, { status: 401 }) }
  }

  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false, response: Response.json({ ok: false, message: 'Sign in to sync shortcuts.' }, { status: 401 }) }
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return { ok: false, response: Response.json({ ok: false, message: 'Shortcut sync is not configured.' }, { status: 503 }) }
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

function isMissingShortcutPreferencesTable(message: string | null | undefined) {
  const normalized = (message || '').toLowerCase()
  return normalized.includes('portal_shortcut_preferences')
    && (normalized.includes('does not exist') || normalized.includes('schema cache'))
}
