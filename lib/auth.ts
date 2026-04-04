'use client'

import { supabase } from '@/lib/supabase'
import { getUserRole, type UserRole } from '@/lib/roles'

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

  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
    },
    role: getUserRole(data.user.id),
    loading: false,
  }
}