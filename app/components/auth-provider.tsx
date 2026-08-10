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
  refreshAuth: () => Promise<AuthRefreshState | null>
}

type AuthRefreshState = {
  session: Session | null
  userId: string | null
  role: UserRole
  entitlements: ProductEntitlementSnapshot | null
}

const AuthContext = createContext<AuthContextValue | null>(null)
const AUTH_PROVIDER_TIMEOUT_MS = 8000
const AUTH_RETRY_INTERVAL_MS = 15000
const AUTH_SESSION_TIMEOUT = { timedOut: true } as const
const AUTH_ENTITLEMENT_TIMEOUT = { timedOut: true } as const

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
      globalThis.setTimeout(() => resolve(fallback), timeoutMs)
    }),
  ])
}

function isAuthSessionTimeout(value: unknown): value is typeof AUTH_SESSION_TIMEOUT {
  return value === AUTH_SESSION_TIMEOUT
}

function isAuthEntitlementTimeout(value: unknown): value is typeof AUTH_ENTITLEMENT_TIMEOUT {
  return value === AUTH_ENTITLEMENT_TIMEOUT
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [authResolved, setAuthResolved] = useState(false)

  const mountedRef = useRef(true)
  const sessionRef = useRef<Session | null>(null)
  const roleRef = useRef<UserRole>('public')
  const entitlementsRef = useRef<ProductEntitlementSnapshot | null>(null)

  const resolveSignedInSession = useCallback(async (nextSession: Session): Promise<AuthRefreshState | null> => {
    const nextUserId = nextSession.user.id
    const previousUserId = sessionRef.current?.user?.id ?? null
    const hasCurrentAccess =
      previousUserId === nextUserId && entitlementsRef.current !== null

    if (previousUserId && previousUserId !== nextUserId) {
      roleRef.current = 'member'
      entitlementsRef.current = null
      setRole('member')
      setEntitlements(null)
    }

    sessionRef.current = nextSession
    setSession(nextSession)
    if (previousUserId !== nextUserId) setAuthResolved(false)

    const [nextRole, entitlementResult] = await Promise.all([
      withTimeout(
        fetchProfileRole(nextUserId),
        AUTH_PROVIDER_TIMEOUT_MS,
        hasCurrentAccess ? roleRef.current : 'member' as UserRole,
      ),
      withTimeout(
        getClientEntitlementSnapshot(nextUserId),
        AUTH_PROVIDER_TIMEOUT_MS,
        AUTH_ENTITLEMENT_TIMEOUT,
      ),
    ])

    if (!mountedRef.current || sessionRef.current?.user?.id !== nextUserId) return null

    roleRef.current = nextRole
    setRole(nextRole)

    const nextEntitlements =
      !isAuthEntitlementTimeout(entitlementResult) && entitlementResult !== null
        ? entitlementResult
        : hasCurrentAccess
          ? entitlementsRef.current
          : null

    if (nextEntitlements !== null) {
      entitlementsRef.current = nextEntitlements
      setEntitlements(nextEntitlements)
    }
    setAuthResolved(true)

    return {
      session: nextSession,
      userId: nextUserId,
      role: nextRole,
      entitlements: nextEntitlements,
    }
  }, [])

  const loadAuth = useCallback(async (): Promise<AuthRefreshState | null> => {
    try {
      const sessionResult = await withTimeout(
        supabase.auth.getSession(),
        AUTH_PROVIDER_TIMEOUT_MS,
        AUTH_SESSION_TIMEOUT,
      )

      if (isAuthSessionTimeout(sessionResult)) {
        return null
      }

      const {
        data: { session: nextSession },
      } = sessionResult

      if (!nextSession?.user?.id) {
        if (!mountedRef.current) return null
        sessionRef.current = null
        roleRef.current = 'public'
        entitlementsRef.current = null
        setSession(null)
        setRole('public')
        setEntitlements(null)
        setAuthResolved(true)
        return {
          session: null,
          userId: null,
          role: 'public',
          entitlements: null,
        }
      }

      return await resolveSignedInSession(nextSession)
    } catch {
      return null
    }
  }, [resolveSignedInSession])

  useEffect(() => {
    mountedRef.current = true
    const initialLoadId = window.setTimeout(() => {
      void loadAuth()
    }, 0)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mountedRef.current) return

      if (!nextSession?.user?.id) {
        sessionRef.current = null
        roleRef.current = 'public'
        entitlementsRef.current = null
        setSession(null)
        setRole('public')
        setEntitlements(null)
        setAuthResolved(true)
        return
      }

      try {
        await resolveSignedInSession(nextSession)
      } catch {
        // Keep the last confirmed access while Safari, the network, or storage recovers.
      }
    })

    return () => {
      mountedRef.current = false
      window.clearTimeout(initialLoadId)
      subscription.unsubscribe()
    }
  }, [loadAuth, resolveSignedInSession])

  useEffect(() => {
    if (authResolved) return
    const retryInterval = window.setInterval(() => void loadAuth(), AUTH_RETRY_INTERVAL_MS)
    return () => window.clearInterval(retryInterval)
  }, [authResolved, loadAuth])

  useEffect(() => {
    if (!authResolved || !session?.user?.id || entitlements !== null) return
    const retryInterval = window.setInterval(() => void loadAuth(), AUTH_RETRY_INTERVAL_MS)
    return () => window.clearInterval(retryInterval)
  }, [authResolved, entitlements, loadAuth, session?.user?.id])

  useEffect(() => {
    function refreshVisiblePage() {
      if (document.visibilityState === 'visible') void loadAuth()
    }

    function refreshRestoredPage() {
      void loadAuth()
    }

    document.addEventListener('visibilitychange', refreshVisiblePage)
    window.addEventListener('pageshow', refreshRestoredPage)
    window.addEventListener('online', refreshRestoredPage)

    return () => {
      document.removeEventListener('visibilitychange', refreshVisiblePage)
      window.removeEventListener('pageshow', refreshRestoredPage)
      window.removeEventListener('online', refreshRestoredPage)
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
