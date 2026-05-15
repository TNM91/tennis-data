'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/app/components/auth-provider'

export default function AdminGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { authResolved, role } = useAuth()

  useEffect(() => {
    if (!authResolved || role === 'admin') return

    // window.location.search already includes the leading "?" when non-empty,
    // so append it directly — do NOT add another "?" or the redirect URL
    // becomes /admin/import??kind=... which breaks URLSearchParams on the
    // login page and causes the ?next= round-trip to land on /mylab instead.
    const search = typeof window !== 'undefined' ? window.location.search : ''
    const nextPath =
      pathname && pathname !== '/login'
        ? `${pathname}${search}`
        : ''
    const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''
    router.replace(`/login${next}`)
  }, [authResolved, pathname, role, router])

  if (!authResolved) {
    return (
      <section style={gateShellStyle}>
        <div style={gateLoadingCardStyle}>
          Checking admin access...
        </div>
      </section>
    )
  }

  if (role !== 'admin') {
    return (
      <section style={gateShellStyle}>
        <div style={gateDeniedCardStyle}>
          Admin access is required for this area. Redirecting to login...
        </div>
      </section>
    )
  }

  return <>{children}</>
}

const gateShellStyle: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '24px',
  minWidth: 0,
}

const gateCardBaseStyle: CSSProperties = {
  borderRadius: '22px',
  padding: '18px 20px',
  fontSize: '15px',
  fontWeight: 700,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const gateLoadingCardStyle: CSSProperties = {
  ...gateCardBaseStyle,
  color: '#eaf4ff',
  background: 'linear-gradient(180deg, rgba(24,49,93,0.68) 0%, rgba(13,26,50,0.92) 100%)',
  border: '1px solid rgba(116,190,255,0.18)',
}

const gateDeniedCardStyle: CSSProperties = {
  ...gateCardBaseStyle,
  color: '#fecaca',
  background: 'rgba(60,16,24,0.76)',
  border: '1px solid rgba(248,113,113,0.22)',
}
