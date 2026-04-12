'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { normalizeUserRole, type UserRole } from '@/lib/roles'

type AuthContextValue = {
  session: Session | null
  userId: string | null
  role: UserRole
  authResolved: boolean
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchProfileRole(userId: string | null | undefined): Promise<UserRole> {
  if (!userId) return 'public'

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (error) return 'member'
    return normalizeUserRole(data?.role ?? 'member')
  } catch {
    return 'member'
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<UserRole>('public')
  const [authResolved, setAuthResolved] = useState(false)

  const mountedRef = useRef(true)

  const loadAuth = useCallback(async () => {
    try {
      const {
        data: { session: nextSession },
      } = await supabase.auth.getSession()

      if (!mountedRef.current) return

      setSession(nextSession ?? null)

      if (!nextSession?.user?.id) {
        setRole('public')
        return
      }

      const nextRole = await fetchProfileRole(nextSession.user.id)

      if (!mountedRef.current) return
      setRole(nextRole)
    } catch {
      if (!mountedRef.current) return
      setSession(null)
      setRole('public')
    } finally {
      if (mountedRef.current) {
        setAuthResolved(true)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void loadAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mountedRef.current) return

      setSession(nextSession ?? null)

      if (!nextSession?.user?.id) {
        setRole('public')
        setAuthResolved(true)
        return
      }

      const nextRole = await fetchProfileRole(nextSession.user.id)

      if (!mountedRef.current) return
      setRole(nextRole)
      setAuthResolved(true)
    })

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [loadAuth])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      userId: session?.user?.id ?? null,
      role,
      authResolved,
      refreshAuth: loadAuth,
    }),
    [authResolved, loadAuth, role, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}