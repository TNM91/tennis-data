import 'server-only'

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from './supabase'

export type ClubApiAuth =
  | { ok: true; supabase: SupabaseClient; user: User; userId: string }
  | { ok: false; response: Response }

export async function getClubApiAuth(request: Request): Promise<ClubApiAuth> {
  const value = request.headers.get('authorization') ?? ''
  const token = value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : ''
  if (!token) {
    return {
      ok: false,
      response: Response.json({ ok: false, message: 'Sign in to open your club workspace.' }, { status: 401 }),
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    return {
      ok: false,
      response: Response.json({ ok: false, message: 'Sign in to open your club workspace.' }, { status: 401 }),
    }
  }

  return { ok: true, supabase, user: data.user, userId: data.user.id }
}
