'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import {
  listInternalNotifications,
  markInternalNotificationRead,
  type InternalNotification,
} from '@/lib/internal-notifications'
import { isWeeklyLevelUpCoachNotification } from '@/lib/level-up/weekly-plan'

export default function LevelUpCoachAlert() {
  const pathname = usePathname() || '/'
  const { authResolved, userId } = useAuth()
  const [notification, setNotification] = useState<InternalNotification | null>(null)

  const loadAlert = useCallback(async () => {
    if (!authResolved || !userId) {
      setNotification(null)
      return
    }

    try {
      const notifications = await listInternalNotifications(userId, { unreadOnly: true, limit: 20 })
      const coachAlerts = notifications.filter(isWeeklyLevelUpCoachNotification)
      if (pathname === '/level-up/my-quest' && coachAlerts.length) {
        setNotification(null)
        await Promise.all(coachAlerts.map((alert) => markInternalNotificationRead(alert.id, userId).catch(() => undefined)))
        return
      }
      setNotification(coachAlerts[0] ?? null)
    } catch {
      // The next focus or timed refresh will quietly retry.
    }
  }, [authResolved, pathname, userId])

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void loadAlert(), 0)
    if (!authResolved || !userId) return () => window.clearTimeout(initialTimer)

    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') void loadAlert()
    }

    const timer = window.setInterval(() => void loadAlert(), 60_000)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [authResolved, loadAlert, userId])

  if (!notification || pathname === '/level-up/my-quest') return null

  function openAlert() {
    setNotification(null)
    if (userId) void markInternalNotificationRead(notification!.id, userId).catch(() => undefined)
  }

  return (
    <aside aria-label="Coach reply ready" aria-live="polite" style={wrapStyle}>
      <Link href={notification.href} onClick={openAlert} style={alertStyle}>
        <span style={copyStyle}>
          <span style={eyebrowStyle}>Coach replied</span>
          <strong style={titleStyle}>{notification.title}</strong>
          <small style={bodyStyle}>{notification.body}</small>
        </span>
        <span style={actionStyle}>Open My Quest</span>
      </Link>
    </aside>
  )
}

const wrapStyle: CSSProperties = {
  position: 'relative',
  zIndex: 28,
  width: 'min(1120px, 100%)',
  margin: '10px auto 0',
  paddingInline: 'clamp(8px, 2.4vw, 12px)',
  boxSizing: 'border-box',
}

const alertStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto)',
  alignItems: 'center',
  gap: 12,
  minWidth: 0,
  padding: '12px 14px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 42%, var(--shell-panel-border) 58%)',
  borderRadius: 16,
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-green) 12%, var(--surface) 88%), color-mix(in srgb, var(--brand-blue-2) 8%, var(--surface) 92%))',
  boxShadow: '0 16px 38px rgba(2, 10, 24, 0.2)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  boxSizing: 'border-box',
}

const copyStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
}

const eyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.2,
  overflowWrap: 'anywhere',
}

const bodyStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 720,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
}

const actionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 40,
  padding: '0 13px',
  borderRadius: 999,
  background: 'var(--brand-green)',
  color: '#07111f',
  fontSize: 12,
  fontWeight: 950,
  textAlign: 'center',
}
