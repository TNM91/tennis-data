import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { LockFunc } from '@supabase/auth-js'

import { supabaseUrl, supabaseKey } from './supabase-public-config'
import { getNativeAuthStorage } from './native-auth-storage'
export { supabaseUrl, supabaseKey } from './supabase-public-config'

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
      storage: getNativeAuthStorage(),
    },
  })

  return client
}

export const supabase = getSupabaseClient()
