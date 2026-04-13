'use client'

import { supabase } from '@/lib/supabase'
import { normalizeUserRole, type UserRole } from '@/lib/roles'

export type AuthState = {
  user: { id: string; email?: string | null } | null
  role: UserRole
  loading: boolean
}

const AUTH_TIMEOUT_MS = 8000

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((resolve) => {
      window.setTimeout(() => resolve(fallback), timeoutMs)
    }),
  ])
}

export async function getClientAuthState(): Promise<AuthState> {
  const {
    data: { session },
  } = await withTimeout(
    supabase.auth.getSession(),
    AUTH_TIMEOUT_MS,
    { data: { session: null }, error: null },
  )

  const user = session?.user ?? null

  if (!user) {
    return {
      user: null,
      role: 'public',
      loading: false,
    }
  }

  const userId = user.id

  const profileResult = await withTimeout(
    Promise.resolve(
      supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle(),
    ),
    AUTH_TIMEOUT_MS,
    { data: null, error: null, count: null, status: 408, statusText: 'timeout' },
  )

  return {
    user: {
      id: userId,
      email: user.email ?? null,
    },
    role: normalizeUserRole(profileResult.data?.role ?? 'member'),
    loading: false,
  }
}
