'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/app/components/auth-provider'

export default function AdminGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { authResolved, role } = useAuth()

  useEffect(() => {
    if (!authResolved || role === 'admin') return

    const search = typeof window !== 'undefined' ? window.location.search : ''
    const nextPath =
      pathname && pathname !== '/login'
        ? `${pathname}${search ? `?${search}` : ''}`
        : ''
    const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''
    router.replace(`/login${next}`)
  }, [authResolved, pathname, role, router])

  if (!authResolved) {
    return (
      <section
        style={{
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '24px',
        }}
      >
        <div
          style={{
            borderRadius: '22px',
            padding: '18px 20px',
            color: '#eaf4ff',
            background: 'linear-gradient(180deg, rgba(24,49,93,0.68) 0%, rgba(13,26,50,0.92) 100%)',
            border: '1px solid rgba(116,190,255,0.18)',
            fontSize: '15px',
            fontWeight: 700,
          }}
        >
          Checking admin access...
        </div>
      </section>
    )
  }

  if (role !== 'admin') {
    return (
      <section
        style={{
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '24px',
        }}
      >
        <div
          style={{
            borderRadius: '22px',
            padding: '18px 20px',
            color: '#fecaca',
            background: 'rgba(60,16,24,0.76)',
            border: '1px solid rgba(248,113,113,0.22)',
            fontSize: '15px',
            fontWeight: 700,
          }}
        >
          Admin access is required for this area. Redirecting to login...
        </div>
      </section>
    )
  }

  return <>{children}</>
}
