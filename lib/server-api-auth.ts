import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

type AdminApiAuth =
  | { ok: true; userId: string; supabase: SupabaseClient }
  | { ok: false; response: Response }

export async function getAdminApiAuth(request: Request): Promise<AdminApiAuth> {
  const token = getBearerToken(request)
  if (!token) {
    return {
      ok: false,
      response: Response.json({ ok: false, message: 'Admin sign-in required.' }, { status: 401 }),
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) {
    return {
      ok: false,
      response: Response.json({ ok: false, message: 'Admin sign-in required.' }, { status: 401 }),
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Admin authorization profile lookup failed', profileError)
    return {
      ok: false,
      response: Response.json({ ok: false, message: 'Unable to verify admin access.' }, { status: 503 }),
    }
  }

  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return {
      ok: false,
      response: Response.json({ ok: false, message: 'Admin access required.' }, { status: 403 }),
    }
  }

  return { ok: true, userId: userData.user.id, supabase }
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}
