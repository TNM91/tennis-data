'use client'

import { supabase } from '@/lib/supabase'
import { normalizeUserRole, type UserRole } from '@/lib/roles'

export type AuthState = {
  user: { id: string; email?: string | null } | null
  role: UserRole
  loading: boolean
}

export async function getClientAuthState(): Promise<AuthState> {
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return {
      user: null,
      role: 'public',
      loading: false,
    }
  }

  const userId = data.user.id

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  return {
    user: {
      id: userId,
      email: data.user.email ?? null,
    },
    role: normalizeUserRole(profile?.role),
    loading: false,
  }
}