'use client'

import { useEffect, useMemo, useState } from 'react'
import { useOptionalAuth } from '@/app/components/auth-provider'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { getClientAuthState, type AuthState } from '@/lib/auth'
import { type UserRole } from '@/lib/roles'

export function useProductAccess() {
  const auth = useOptionalAuth()
  const [fallbackUser, setFallbackUser] = useState<AuthState['user']>(null)
  const [fallbackRole, setFallbackRole] = useState<UserRole>('public')
  const [fallbackEntitlements, setFallbackEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [fallbackResolved, setFallbackResolved] = useState(false)

  useEffect(() => {
    if (auth) return
    let active = true

    async function loadFallbackAuth() {
      try {
        const authState = await getClientAuthState()
        if (!active) return
        setFallbackUser(authState.user)
        setFallbackRole(authState.role)
        setFallbackEntitlements(authState.entitlements)
      } catch {
        if (!active) return
        setFallbackUser(null)
        setFallbackRole('public')
        setFallbackEntitlements(null)
      } finally {
        if (active) setFallbackResolved(true)
      }
    }

    void loadFallbackAuth()

    return () => {
      active = false
    }
  }, [auth])

  const userId = auth?.userId ?? fallbackUser?.id ?? null
  const role = auth?.role ?? fallbackRole
  const entitlements = auth?.entitlements ?? fallbackEntitlements
  const authResolved = auth?.authResolved ?? fallbackResolved

  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])
  const user = useMemo(() => userId ? { id: userId } : null, [userId])

  return { access, user, role, entitlements, authResolved }
}
