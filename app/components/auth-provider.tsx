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
import type { ProductEntitlementSnapshot } from '@/lib/access-model'
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
const AUTH_ENTITLEMENT_CACHE_TTL_MS = 30 * 60 * 1000
const AUTH_ACCESS_CACHE_PREFIX = 'tenaceiq-auth-access:v2:'
const AUTH_SESSION_TIMEOUT = { timedOut: true } as const
const AUTH_ACCESS_TIMEOUT = { timedOut: true } as const

type AccountAccess = {
  role: UserRole
  entitlements: ProductEntitlementSnapshot
}

type CachedAccountAccess = AccountAccess & {
  cachedAt: number
}

async function fetchAccountAccess(accessToken: string): Promise<AccountAccess | null> {
  try {
    const response = await fetch('/api/auth/access', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (!response.ok) return null

    const payload = await response.json() as {
      access?: { role?: unknown; entitlements?: ProductEntitlementSnapshot }
    }
    if (!payload.access?.entitlements) return null

    return {
      role: normalizeUserRole(payload.access.role ?? 'member'),
      entitlements: payload.access.entitlements,
    }
  } catch {
    return null
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

function isAuthAccessTimeout(value: unknown): value is typeof AUTH_ACCESS_TIMEOUT {
  return value === AUTH_ACCESS_TIMEOUT
}

function isCachedAccountAccess(value: unknown): value is CachedAccountAccess {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CachedAccountAccess>
  const entitlements = candidate.entitlements as Partial<ProductEntitlementSnapshot> | undefined
  if (!entitlements) return false

  return Number.isFinite(candidate.cachedAt) &&
    normalizeUserRole(candidate.role) !== 'public' &&
    typeof entitlements.playerPlusSubscriptionActive === 'boolean' &&
    typeof entitlements.captainSubscriptionActive === 'boolean' &&
    typeof entitlements.tiqTeamLeagueEntryEnabled === 'boolean' &&
    typeof entitlements.tiqIndividualLeagueCreatorEnabled === 'boolean'
}

function getAccessCacheKey(userId: string) {
  return `${AUTH_ACCESS_CACHE_PREFIX}${userId}`
}

function readCachedAccountAccess(userId: string): AccountAccess | null {
  try {
    const raw = window.localStorage.getItem(getAccessCacheKey(userId))
    if (!raw) return null
    const cached = JSON.parse(raw) as unknown
    if (!isCachedAccountAccess(cached) || Date.now() - cached.cachedAt > AUTH_ENTITLEMENT_CACHE_TTL_MS) {
      window.localStorage.removeItem(getAccessCacheKey(userId))
      return null
    }
    return { role: cached.role, entitlements: cached.entitlements }
  } catch {
    return null
  }
}

function writeCachedAccountAccess(userId: string, access: AccountAccess) {
  try {
    window.localStorage.setItem(getAccessCacheKey(userId), JSON.stringify({ cachedAt: Date.now(), ...access }))
  } catch {
    // Private browsing or a full storage quota must not block sign-in.
  }
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
  const accessRequestRef = useRef<{ accessToken: string; promise: Promise<AccountAccess | null> } | null>(null)

  const resolveSignedInSession = useCallback(async (nextSession: Session): Promise<AuthRefreshState | null> => {
    const nextUserId = nextSession.user.id
    const previousUserId = sessionRef.current?.user?.id ?? null
    const hasCurrentAccess = previousUserId === nextUserId && entitlementsRef.current !== null && roleRef.current !== 'public'
    const cachedAccess = hasCurrentAccess
      ? { role: roleRef.current, entitlements: entitlementsRef.current as ProductEntitlementSnapshot }
      : readCachedAccountAccess(nextUserId)

    if (previousUserId && previousUserId !== nextUserId) {
      roleRef.current = 'member'
      entitlementsRef.current = null
      setRole('member')
      setEntitlements(null)
    }

    sessionRef.current = nextSession
    setSession(nextSession)
    if (cachedAccess !== null) {
      // This cache keeps the shell responsive, but only stores a complete
      // server-verified account snapshot. Protected routes and mutations
      // still authorize on the server while the fresh snapshot replaces it.
      roleRef.current = cachedAccess.role
      entitlementsRef.current = cachedAccess.entitlements
      setRole(cachedAccess.role)
      setEntitlements(cachedAccess.entitlements)
      setAuthResolved(true)
    } else if (previousUserId !== nextUserId) {
      setAuthResolved(false)
    }

    const currentAccessRequest = accessRequestRef.current
    const accessRequest = currentAccessRequest?.accessToken === nextSession.access_token
      ? currentAccessRequest.promise
      : fetchAccountAccess(nextSession.access_token)
    if (accessRequest !== currentAccessRequest?.promise) {
      accessRequestRef.current = { accessToken: nextSession.access_token, promise: accessRequest }
      void accessRequest.finally(() => {
        if (accessRequestRef.current?.promise === accessRequest) accessRequestRef.current = null
      })
    }

    const accessResult = await withTimeout(
      accessRequest,
      AUTH_PROVIDER_TIMEOUT_MS,
      AUTH_ACCESS_TIMEOUT,
    )

    if (!mountedRef.current || sessionRef.current?.user?.id !== nextUserId) return null

    const nextAccess = !isAuthAccessTimeout(accessResult) && accessResult !== null
      ? accessResult
      : cachedAccess

    if (nextAccess !== null) {
      roleRef.current = nextAccess.role
      entitlementsRef.current = nextAccess.entitlements
      setRole(nextAccess.role)
      setEntitlements(nextAccess.entitlements)
      if (!isAuthAccessTimeout(accessResult) && accessResult !== null) {
        writeCachedAccountAccess(nextUserId, nextAccess)
      }
    } else {
      roleRef.current = 'member'
      entitlementsRef.current = null
      setRole('member')
      setEntitlements(null)
    }
    setAuthResolved(true)

    return {
      session: nextSession,
      userId: nextUserId,
      role: nextAccess?.role ?? 'member',
      entitlements: nextAccess?.entitlements ?? null,
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
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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

      // Supabase holds an auth lock while this callback runs. Defer profile and
      // entitlement work until after the callback returns so Safari restores
      // the session instead of leaving authenticated pages in a loading state.
      window.setTimeout(() => {
        void resolveSignedInSession(nextSession).catch(() => {
          // Keep the last confirmed access while Safari, the network, or storage recovers.
        })
      }, 0)
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
