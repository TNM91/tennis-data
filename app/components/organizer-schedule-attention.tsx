'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import type { OrganizerScheduleAttentionItem } from '@/lib/competition-schedule-attention'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type AttentionPayload = {
  ok?: boolean
  competitionCount?: number
  itemCount?: number
  items?: OrganizerScheduleAttentionItem[]
  message?: string
}

const stateCopy = {
  unavailable: { label: 'Unavailable', action: 'Adjust match' },
  changed: { label: 'Ask again', action: 'Review change' },
  waiting: { label: 'Waiting', action: 'Review replies' },
} as const

function formatMatchDate(value: string) {
  const parsed = value ? new Date(`${value}T12:00:00`) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return value || 'Date TBD'
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function OrganizerScheduleAttention() {
  const { session, userId, authResolved } = useAuth()
  const { isMobile } = useViewportBreakpoints()
  const [items, setItems] = useState<OrganizerScheduleAttentionItem[]>([])
  const [competitionCount, setCompetitionCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const accessToken = session?.access_token || ''
    if (!authResolved || !userId || !accessToken) {
      setItems([])
      setCompetitionCount(0)
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/competition-schedule-attention', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const body = (await response.json()) as AttentionPayload
      if (!response.ok || !body.ok) throw new Error(body.message || 'Schedule attention could not load.')
      setItems(body.items ?? [])
      setCompetitionCount(Math.max(0, Number(body.competitionCount) || 0))
    } catch (loadError) {
      setItems([])
      setError(loadError instanceof Error ? loadError.message : 'Schedule attention could not load.')
    } finally {
      setLoading(false)
    }
  }, [authResolved, session?.access_token, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (loading || (!competitionCount && !error)) return null

  if (error) {
    return (
      <div style={errorStyle} role="status">
        <span>{error}</span>
        <button type="button" onClick={() => void refresh()} style={refreshButtonStyle}>Try again</button>
      </div>
    )
  }

  if (!items.length) {
    return (
      <section style={clearStyle} aria-label="Schedule reply attention">
        <span style={clearDotStyle} aria-hidden="true" />
        <div style={clearCopyStyle}>
          <strong>Schedule reply queue is clear.</strong>
          <span>No upcoming match replies need attention.</span>
        </div>
        <button type="button" onClick={() => void refresh()} style={refreshButtonStyle}>Refresh</button>
      </section>
    )
  }

  const visibleItems = items.slice(0, 3)
  const extraItems = items.slice(3)

  return (
    <section id="schedule-attention" style={panelStyle} aria-labelledby="schedule-attention-title">
      <div style={headerStyle}>
        <div>
          <span style={eyebrowStyle}>Needs attention</span>
          <h2 id="schedule-attention-title" style={titleStyle}>
            {items.length} match{items.length === 1 ? '' : 'es'} need a reply decision.
          </h2>
        </div>
        <button type="button" onClick={() => void refresh()} style={refreshButtonStyle}>Refresh</button>
      </div>

      <div style={listStyle}>
        {visibleItems.map((item) => <AttentionRow key={item.eventId} item={item} compact={isMobile} />)}
      </div>

      {extraItems.length ? (
        <details style={moreStyle}>
          <summary style={moreSummaryStyle}>Show {extraItems.length} more</summary>
          <div style={listStyle}>
            {extraItems.map((item) => <AttentionRow key={item.eventId} item={item} compact={isMobile} />)}
          </div>
        </details>
      ) : null}
    </section>
  )
}

function AttentionRow({ item, compact }: { item: OrganizerScheduleAttentionItem; compact: boolean }) {
  const copy = stateCopy[item.state]
  return (
    <Link href={item.href} style={compact ? compactRowStyle : rowStyle}>
      <span style={item.state === 'unavailable' ? urgentMarkerStyle : markerStyle} aria-hidden="true" />
      <span style={rowCopyStyle}>
        <span style={metaStyle}>{item.competitionKind === 'league' ? 'League' : 'Tournament'} · {item.competitionName}</span>
        <strong>{item.matchLabel}</strong>
        <span>{formatMatchDate(item.date)}{item.time ? ` · ${item.time}` : ''}{item.location ? ` · ${item.location}` : ''}</span>
      </span>
      <span style={compact ? compactCountsStyle : countsStyle}>
        <span style={item.state === 'unavailable' ? urgentPillStyle : attentionPillStyle}>{copy.label}</span>
        <span>{item.availableCount} yes</span>
        {item.unavailableCount ? <span>{item.unavailableCount} can’t</span> : null}
        {item.changedCount ? <span>{item.changedCount} changed</span> : null}
        {item.waitingCount ? <span>{item.waitingCount} waiting</span> : null}
      </span>
      <span style={compact ? compactActionStyle : actionStyle}>{copy.action}</span>
    </Link>
  )
}

const panelStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  border: '1px solid rgba(251, 191, 36, 0.25)',
  borderRadius: 22,
  background: 'linear-gradient(135deg, rgba(120, 53, 15, 0.16), rgba(7, 20, 35, 0.9) 46%)',
  padding: 'clamp(14px, 2vw, 20px)',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
}

const eyebrowStyle: CSSProperties = {
  color: '#fcd34d',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  margin: '5px 0 0',
  color: '#f8fafc',
  fontSize: 'clamp(18px, 3vw, 25px)',
  lineHeight: 1.1,
}

const listStyle: CSSProperties = { display: 'grid', gap: 8 }

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '6px minmax(0, 1fr) auto auto',
  alignItems: 'center',
  gap: 12,
  minWidth: 0,
  border: '1px solid rgba(148, 163, 184, 0.16)',
  borderRadius: 16,
  background: 'rgba(4, 15, 27, 0.7)',
  color: '#e2e8f0',
  padding: 12,
  textDecoration: 'none',
}

const compactRowStyle: CSSProperties = {
  ...rowStyle,
  gridTemplateColumns: '6px minmax(0, 1fr)',
  gap: 9,
  padding: 10,
}

const markerStyle: CSSProperties = { width: 6, height: '100%', minHeight: 42, borderRadius: 999, background: '#facc15' }
const urgentMarkerStyle: CSSProperties = { ...markerStyle, background: '#fb7185' }

const rowCopyStyle: CSSProperties = { display: 'grid', gap: 4, minWidth: 0 }
const metaStyle: CSSProperties = { color: '#93c5fd', fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }

const countsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
  gap: 6,
  color: '#cbd5e1',
  fontSize: 11,
  fontWeight: 800,
}

const attentionPillStyle: CSSProperties = { padding: '5px 8px', borderRadius: 999, color: '#fde68a', background: 'rgba(120, 53, 15, 0.42)' }
const urgentPillStyle: CSSProperties = { ...attentionPillStyle, color: '#fecdd3', background: 'rgba(136, 19, 55, 0.42)' }
const actionStyle: CSSProperties = { color: '#d9f99d', fontSize: 12, fontWeight: 950, whiteSpace: 'nowrap' }
const compactCountsStyle: CSSProperties = { ...countsStyle, gridColumn: '2', justifyContent: 'flex-start' }
const compactActionStyle: CSSProperties = { ...actionStyle, gridColumn: '2' }

const moreStyle: CSSProperties = { display: 'grid', gap: 8 }
const moreSummaryStyle: CSSProperties = { cursor: 'pointer', color: '#cbd5e1', fontSize: 12, fontWeight: 900 }

const refreshButtonStyle: CSSProperties = {
  minHeight: 36,
  border: '1px solid rgba(148, 163, 184, 0.24)',
  borderRadius: 999,
  background: 'rgba(30, 41, 59, 0.72)',
  color: '#f8fafc',
  padding: '7px 11px',
  font: 'inherit',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
}

const clearStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 10,
  border: '1px solid rgba(163, 230, 53, 0.22)',
  borderRadius: 18,
  background: 'rgba(63, 98, 18, 0.12)',
  color: '#e2e8f0',
  padding: 12,
}

const clearDotStyle: CSSProperties = { width: 10, height: 10, borderRadius: 999, background: '#a3e635' }
const clearCopyStyle: CSSProperties = { display: 'grid', gap: 3 }
const errorStyle: CSSProperties = { ...clearStyle, borderColor: 'rgba(248, 113, 113, 0.24)', background: 'rgba(127, 29, 29, 0.12)' }
