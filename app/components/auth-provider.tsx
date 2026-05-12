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
import { getClientEntitlementSnapshot, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { normalizeUserRole, type UserRole } from '@/lib/roles'

type AuthContextValue = {
  session: Session | null
  userId: string | null
  role: UserRole
  entitlements: ProductEntitlementSnapshot | null
  authResolved: boolean
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const AUTH_PROVIDER_TIMEOUT_MS = 8000
const AUTH_SESSION_TIMEOUT = { timedOut: true } as const

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

async function withTimeout<T, F>(promise: Promise<T>, timeoutMs: number, fallback: F): Promise<T | F> {
  return await Promise.race<T | F>([
    promise,
    new Promise<F>((resolve) => {
      window.setTimeout(() => resolve(fallback), timeoutMs)
    }),
  ])
}

function isAuthSessionTimeout(value: unknown): value is typeof AUTH_SESSION_TIMEOUT {
  return value === AUTH_SESSION_TIMEOUT
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [authResolved, setAuthResolved] = useState(false)

  const mountedRef = useRef(true)

  const loadAuth = useCallback(async () => {
    let resolvedAuthState = false

    try {
      const sessionResult = await withTimeout(
        supabase.auth.getSession(),
        AUTH_PROVIDER_TIMEOUT_MS,
        AUTH_SESSION_TIMEOUT,
      )

      if (isAuthSessionTimeout(sessionResult)) {
        return
      }

      const {
        data: { session: nextSession },
      } = sessionResult

      if (!mountedRef.current) return
      setSession(nextSession ?? null)

      if (!nextSession?.user?.id) {
        setRole('public')
        setEntitlements(null)
        resolvedAuthState = true
        return
      }

      const [nextRole, nextEntitlements] = await Promise.all([
        withTimeout(
          fetchProfileRole(nextSession.user.id),
          AUTH_PROVIDER_TIMEOUT_MS,
          'member' as UserRole,
        ),
        withTimeout(
          getClientEntitlementSnapshot(nextSession.user.id),
          AUTH_PROVIDER_TIMEOUT_MS,
          null,
        ),
      ])

      if (!mountedRef.current) return
      setRole(nextRole)
      setEntitlements(nextEntitlements)
      resolvedAuthState = true
    } catch {
      return
    } finally {
      if (mountedRef.current && resolvedAuthState) {
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
        setEntitlements(null)
        setAuthResolved(true)
        return
      }

      setAuthResolved(false)

      const [nextRole, nextEntitlements] = await Promise.all([
        withTimeout(
          fetchProfileRole(nextSession.user.id),
          AUTH_PROVIDER_TIMEOUT_MS,
          'member' as UserRole,
        ),
        withTimeout(
          getClientEntitlementSnapshot(nextSession.user.id),
          AUTH_PROVIDER_TIMEOUT_MS,
          null,
        ),
      ])

      if (!mountedRef.current) return
      setRole(nextRole)
      setEntitlements(nextEntitlements)
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
      entitlements,
      authResolved,
      refreshAuth: loadAuth,
    }),
    [authResolved, entitlements, loadAuth, role, session],
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

export function useOptionalAuth() {
  return useContext(AuthContext)
}
