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
import { getClientAuthState } from '@/lib/auth'
import { normalizeUserRole, type UserRole } from '@/lib/roles'

type AuthContextValue = {
  session: Session | null
  userId: string | null
  role: UserRole
  authResolved: boolean
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const AUTH_PROVIDER_TIMEOUT_MS = 8000

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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((resolve) => {
      window.setTimeout(() => resolve(fallback), timeoutMs)
    }),
  ])
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<UserRole>('public')
  const [authResolved, setAuthResolved] = useState(false)

  const mountedRef = useRef(true)

  const loadAuth = useCallback(async () => {
    try {
      const authState = await getClientAuthState()
      if (!mountedRef.current) return

      const {
        data: { session: nextSession },
      } = await withTimeout(
        supabase.auth.getSession(),
        AUTH_PROVIDER_TIMEOUT_MS,
        { data: { session: null }, error: null },
      )

      if (!mountedRef.current) return

      setSession(nextSession ?? null)
      setRole(authState.role)
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

      const nextRole = await withTimeout(
        fetchProfileRole(nextSession.user.id),
        AUTH_PROVIDER_TIMEOUT_MS,
        'member' as UserRole,
      )

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
