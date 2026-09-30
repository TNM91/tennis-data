'use client'

import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import { listInternalNotifications } from '@/lib/internal-notifications'
import { buildPlayerWeeklyLeagueAction, type PlayerWeeklyLeagueAction } from '@/lib/player-weekly-league-home'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

export default function WeeklyLeagueActionCard({
  userId,
  authResolved,
}: {
  userId: string | null
  authResolved: boolean
}) {
  const [action, setAction] = useState<PlayerWeeklyLeagueAction | null>(null)
  const { isMobile } = useViewportBreakpoints()

  useEffect(() => {
    if (!authResolved || !userId) return

    let active = true
    void listInternalNotifications(userId, { limit: 30 })
      .then((notifications) => {
        if (!active) return
        setAction(buildPlayerWeeklyLeagueAction(notifications))
      })
      .catch(() => {
        if (active) setAction(null)
      })

    return () => {
      active = false
    }
  }, [authResolved, userId])

  if (!authResolved || !userId || !action) return null

  return (
    <Link href={action.href} style={cardStyle(isMobile)} data-weekly-league-stage={action.stage}>
      <TiqFeatureIcon name="leagueTennis" size="md" variant="surface" />
      <span style={copyStyle}>
        <span style={eyebrowStyle}>{action.eyebrow}</span>
        <strong style={titleStyle}>{action.title}</strong>
        <span style={detailStyle}>{action.detail}</span>
      </span>
      <span style={actionStyle(isMobile)}>{action.cta} <span aria-hidden="true">→</span></span>
    </Link>
  )
}

const cardStyle = (isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? 'auto minmax(0, 1fr)' : 'auto minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 14,
  minWidth: 0,
  padding: 16,
  borderRadius: 20,
  border: '1px solid color-mix(in srgb, var(--brand-green) 32%, var(--shell-panel-border) 68%)',
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-green) 13%, var(--shell-panel-bg) 87%), var(--shell-panel-bg))',
  boxShadow: 'var(--shadow-soft)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
})

const copyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
}

const eyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  fontSize: 18,
  lineHeight: 1.2,
  overflowWrap: 'anywhere',
}

const detailStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
}

const actionStyle = (isMobile: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 42,
  padding: '0 14px',
  borderRadius: 999,
  background: 'var(--brand-green)',
  color: '#07111f',
  fontSize: 13,
  fontWeight: 950,
  textAlign: 'center',
  whiteSpace: 'nowrap',
  ...(isMobile ? { gridColumn: '1 / -1', width: '100%' } : {}),
})
