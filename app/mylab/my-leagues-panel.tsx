'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import type { PlayerLeagueCard, PlayerLeagueHomeView } from '@/lib/player-league-home'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

export default function MyLeaguesPanel({ view }: { view: PlayerLeagueHomeView }) {
  const { isMobile } = useViewportBreakpoints()
  const hasLeagues = view.active.length > 0 || view.past.length > 0

  return (
    <section id="my-leagues" style={panelStyle} aria-label="My Leagues">
      <div style={headerStyle}>
        <div style={titleClusterStyle}>
          <TiqFeatureIcon name="leagueTennis" size="md" variant="surface" />
          <div style={headerCopyStyle}>
            <span style={kickerStyle}>Player leagues</span>
            <h2 style={titleStyle}>My Leagues</h2>
            <p style={bodyStyle}>Weekly doubles, ladders, round robins, and other leagues where you compete as a player.</p>
          </div>
        </div>
        <Link href="/explore/leagues" style={secondaryActionStyle}>Find leagues</Link>
      </div>

      {view.active.length ? (
        <>
          <div style={groupHeaderStyle}>
            <strong>Active leagues</strong>
            <span style={countStyle}>{view.active.length}</span>
          </div>
          <div style={leagueGridStyle(isMobile)}>
            {view.active.map((league) => <LeagueCard key={league.leagueId} league={league} />)}
          </div>
        </>
      ) : (
        <div style={emptyStyle}>
          <strong>{hasLeagues ? 'No active player leagues.' : 'Your player leagues will appear here.'}</strong>
          <span>{hasLeagues ? 'Past seasons stay available below.' : 'Join a player league to keep its schedule, results, and standings close to My Lab.'}</span>
        </div>
      )}

      {view.past.length ? (
        <details style={pastDetailsStyle}>
          <summary style={pastSummaryStyle}>
            <span>Past seasons</span>
            <span style={countStyle}>{view.past.length}</span>
          </summary>
          <div style={pastGridStyle(isMobile)}>
            {view.past.map((league) => <LeagueCard key={league.leagueId} league={league} compact />)}
          </div>
        </details>
      ) : null}
    </section>
  )
}

function LeagueCard({ league, compact = false }: { league: PlayerLeagueCard; compact?: boolean }) {
  return (
    <Link href={league.href} style={leagueCardStyle}>
      <span style={cardTopStyle}>
        <span style={statusStyle(league.status)}>{league.statusLabel}</span>
        <span style={tiqBadgeStyle}>TIQ league</span>
      </span>
      <span style={leagueNameStyle}>{league.leagueName}</span>
      <span style={seasonStyle}>{league.seasonLabel} · {league.formatLabel}</span>
      {!compact ? <span style={metaStyle}>{league.scheduleLabel} · {league.locationLabel}</span> : null}
      <span style={scoreRowStyle}>
        <span style={scoreMetricStyle}><small style={scoreLabelStyle}>Your record</small><strong style={scoreValueStyle}>{league.playerRecord}</strong></span>
        <span style={scoreMetricStyle}><small style={scoreLabelStyle}>League</small><strong style={scoreValueStyle}>{league.resultLabel}</strong></span>
      </span>
      <span style={leaderStyle}>{league.leaderLabel}</span>
      <span style={cardActionStyle}>{league.cta} <span aria-hidden="true">→</span></span>
    </Link>
  )
}

const panelStyle: CSSProperties = {
  display: 'grid', gap: 14, minWidth: 0, padding: 18, borderRadius: 22,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-panel-border) 78%)',
  background: 'linear-gradient(180deg, color-mix(in srgb, var(--brand-blue-2) 7%, var(--shell-panel-bg) 93%), var(--shell-panel-bg))',
  boxShadow: 'var(--shadow-soft)',
}
const headerStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', minWidth: 0 }
const titleClusterStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 320px' }
const headerCopyStyle: CSSProperties = { display: 'grid', gap: 3, minWidth: 0 }
const kickerStyle: CSSProperties = { color: 'var(--brand-blue-2)', fontSize: 11, fontWeight: 950, letterSpacing: '0.08em', textTransform: 'uppercase' }
const titleStyle: CSSProperties = { margin: 0, color: 'var(--foreground-strong)', fontSize: 24, lineHeight: 1.1 }
const bodyStyle: CSSProperties = { margin: 0, color: 'var(--shell-copy-muted)', fontSize: 13, lineHeight: 1.45, overflowWrap: 'anywhere' }
const secondaryActionStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 40, padding: '0 14px', borderRadius: 999, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-chip-bg)', color: 'var(--foreground-strong)', fontSize: 13, fontWeight: 900, textDecoration: 'none' }
const groupHeaderStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, color: 'var(--foreground-strong)', fontSize: 14, fontWeight: 950 }
const leagueGridStyle = (isMobile: boolean): CSSProperties => ({ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 12, minWidth: 0 })
const pastGridStyle = (isMobile: boolean): CSSProperties => ({ ...leagueGridStyle(isMobile), padding: '0 12px 12px' })
const leagueCardStyle: CSSProperties = { display: 'grid', gap: 8, minWidth: 0, padding: 15, borderRadius: 18, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-chip-bg)', color: 'var(--foreground-strong)', textDecoration: 'none', overflowWrap: 'anywhere' }
const cardTopStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }
const statusStyle = (status: PlayerLeagueCard['status']): CSSProperties => ({ display: 'inline-flex', minHeight: 26, alignItems: 'center', padding: '0 9px', borderRadius: 999, background: status === 'active' ? 'color-mix(in srgb, var(--brand-green) 16%, var(--shell-chip-bg) 84%)' : 'rgba(116,190,255,0.10)', color: status === 'active' ? 'var(--brand-green)' : 'var(--brand-blue-2)', fontSize: 11, fontWeight: 950, textTransform: 'uppercase' })
const tiqBadgeStyle: CSSProperties = { color: 'var(--shell-copy-muted)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }
const leagueNameStyle: CSSProperties = { fontSize: 18, fontWeight: 950, lineHeight: 1.2 }
const seasonStyle: CSSProperties = { color: 'var(--brand-blue-2)', fontSize: 12, fontWeight: 900 }
const metaStyle: CSSProperties = { color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 700, lineHeight: 1.4 }
const scoreRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }
const scoreMetricStyle: CSSProperties = { display: 'grid', gap: 2, minWidth: 0, padding: 9, borderRadius: 12, background: 'color-mix(in srgb, var(--shell-panel-bg) 65%, transparent)', border: '1px solid color-mix(in srgb, var(--brand-blue-2) 10%, var(--shell-panel-border) 90%)' }
const scoreLabelStyle: CSSProperties = { color: 'var(--shell-copy-muted)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }
const scoreValueStyle: CSSProperties = { fontSize: 13, lineHeight: 1.25, overflowWrap: 'anywhere' }
const leaderStyle: CSSProperties = { color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 750 }
const cardActionStyle: CSSProperties = { color: 'var(--brand-green)', fontSize: 13, fontWeight: 950 }
const emptyStyle: CSSProperties = { display: 'grid', gap: 5, padding: 15, borderRadius: 16, border: '1px dashed var(--shell-panel-border)', color: 'var(--shell-copy-muted)', fontSize: 13, lineHeight: 1.45 }
const pastDetailsStyle: CSSProperties = { borderRadius: 16, border: '1px solid var(--shell-panel-border)', overflow: 'hidden' }
const pastSummaryStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 46, padding: '0 12px', color: 'var(--foreground-strong)', fontWeight: 900, cursor: 'pointer' }
const countStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, minHeight: 28, padding: '0 8px', borderRadius: 999, background: 'var(--shell-chip-bg)', color: 'var(--shell-copy-muted)', fontSize: 12 }
