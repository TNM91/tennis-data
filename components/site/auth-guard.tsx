'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClientAuthState } from '@/lib/auth'
import { isAdmin, isMember, type UserRole } from '@/lib/roles'

type AuthGuardProps = {
  children: React.ReactNode
  requireRole: 'member' | 'admin'
}

export function AuthGuard({ children, requireRole }: AuthGuardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<UserRole>('public')

  useEffect(() => {
    let mounted = true

    async function loadAuth() {
      const state = await getClientAuthState()

      if (!mounted) return

      setRole(state.role)
      setLoading(false)

      if (requireRole === 'member' && !isMember(state.role)) {
        router.replace('/login')
      }

      if (requireRole === 'admin' && !isAdmin(state.role)) {
        router.replace('/')
      }
    }

    loadAuth()

    return () => {
      mounted = false
    }
  }, [requireRole, router])

  if (loading) {
    return (
      <div className="page-shell page-shell-tight flex-1 pt-10">
        <div className="surface-card panel-pad">
          <p className="text-sm text-white/70">Loading…</p>
        </div>
      </div>
    )
  }

  if (requireRole === 'member' && !isMember(role)) return null
  if (requireRole === 'admin' && !isAdmin(role)) return null

  return <>{children}</>
}