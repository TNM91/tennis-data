import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { LockFunc } from '@supabase/auth-js'

export const supabaseUrl = 'https://pwxppfazbyourjrsutgx.supabase.co'
export const supabaseKey = 'sb_publishable_FQBYCnXJy2vjIYlri8TG7g_2XZ9IqqZ'

let client: SupabaseClient | null = null
let authLockQueue: Promise<unknown> = Promise.resolve()

const serializedAuthLock: LockFunc = async (_name, _acquireTimeout, fn) => {
  const runAfterPrevious = authLockQueue.catch(() => undefined).then(fn)
  authLockQueue = runAfterPrevious.catch(() => undefined)
  return await runAfterPrevious
}

function getSupabaseClient() {
  if (client) return client

  client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      lock: serializedAuthLock,
    },
  })

  return client
}

export const supabase = getSupabaseClient()
