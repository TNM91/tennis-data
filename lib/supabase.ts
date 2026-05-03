import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const supabaseUrl = 'https://pwxppfazbyourjrsutgx.supabase.co'
export const supabaseKey = 'sb_publishable_FQBYCnXJy2vjIYlri8TG7g_2XZ9IqqZ'

let client: SupabaseClient | null = null

function getSupabaseClient() {
  if (client) return client

  client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return client
}

export const supabase = getSupabaseClient()
