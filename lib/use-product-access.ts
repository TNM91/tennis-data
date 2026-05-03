'use client'

import { useEffect, useMemo, useState } from 'react'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { getClientAuthState, type AuthState } from '@/lib/auth'
import { type UserRole } from '@/lib/roles'

export function useProductAccess() {
  const [user, setUser] = useState<AuthState['user']>(null)
  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)

  useEffect(() => {
    let active = true

    async function loadAuth() {
      try {
        const authState = await getClientAuthState()
        if (!active) return
        setUser(authState.user)
        setRole(authState.role)
        setEntitlements(authState.entitlements)
      } catch {
        if (!active) return
        setUser(null)
        setRole('public')
        setEntitlements(null)
      }
    }

    void loadAuth()

    return () => {
      active = false
    }
  }, [])

  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])

  return { access, user, role, entitlements }
}
