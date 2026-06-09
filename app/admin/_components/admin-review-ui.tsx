'use client'

import type { CSSProperties, ReactNode } from 'react'

export function AdminReviewFrame({ children }: { children: ReactNode }) {
  return (
    <section style={adminReviewFrameStyle}>
      {children}
    </section>
  )
}

export function AdminReviewHero({
  kicker,
  title,
  children,
  actions,
}: {
  kicker: string
  title: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="hero-panel" style={adminHeroStyle}>
      <div style={adminHeroContentStyle}>
        <div className="section-kicker">{kicker}</div>
        <h1 className="page-title" style={adminHeroTitleStyle}>{title}</h1>
        <p className="page-subtitle" style={adminHeroSubtitleStyle}>
          {children}
        </p>
        {actions ? <div style={adminActionRowStyle}>{actions}</div> : null}
      </div>
    </div>
  )
}

export function AdminReviewGrid({ children }: { children: ReactNode }) {
  return (
    <div style={adminReviewGridStyle}>
      {children}
    </div>
  )
}

export function AdminReviewPanel({
  children,
  compact = false,
  style,
  ariaLabel,
}: {
  children: ReactNode
  compact?: boolean
  style?: CSSProperties
  ariaLabel?: string
}) {
  return (
    <section
      aria-label={ariaLabel}
      className="surface-card"
      style={{
        ...adminReviewPanelStyle,
        ...(compact ? { minHeight: 0 } : null),
        ...style,
      }}
    >
      {children}
    </section>
  )
}

export function AdminActionRow({ children }: { children: ReactNode }) {
  return <div style={adminActionRowStyle}>{children}</div>
}

export function AdminStatusPanel({
  tone,
  text,
  children,
}: {
  tone: 'success' | 'error'
  text: string
  children?: ReactNode
}) {
  return (
    <div
      style={{
        ...adminStatusPanelStyle,
        border: tone === 'success'
          ? '1px solid rgba(155,225,29,0.24)'
          : '1px solid rgba(248,113,113,0.24)',
        background: tone === 'success'
          ? 'rgba(155,225,29,0.10)'
          : 'rgba(239,68,68,0.10)',
        color: tone === 'success' ? 'var(--foreground-strong)' : '#fecaca',
      }}
    >
      {text}
      {children ? <div style={{ marginTop: 10 }}>{children}</div> : null}
    </div>
  )
}

export function AdminEmptyState({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div style={adminEmptyStateStyle}>
      {text}
      {children ? <div style={{ marginTop: 12 }}>{children}</div> : null}
    </div>
  )
}

export function AdminFact({ label, value }: { label: string; value: string }) {
  return (
    <div style={adminFactStyle}>
      <div style={adminFactLabelStyle}>{label}</div>
      <div style={adminFactValueStyle}>{value || '-'}</div>
    </div>
  )
}

export const adminActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  marginTop: 18,
  minWidth: 0,
}

export const adminSubPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 14,
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

export const adminReviewHeaderRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  flexWrap: 'wrap',
  minWidth: 0,
}

export const adminFactGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const adminReviewFrameStyle: CSSProperties = {
  width: '100%',
  maxWidth: 1280,
  margin: '0 auto',
  padding: '18px 24px 36px',
  minWidth: 0,
}

const adminHeroStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  padding: 24,
  borderRadius: 22,
  minWidth: 0,
}

const adminHeroContentStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  minWidth: 0,
}

const adminHeroTitleStyle: CSSProperties = {
  marginTop: 8,
  overflowWrap: 'anywhere',
}

const adminHeroSubtitleStyle: CSSProperties = {
  maxWidth: 860,
  overflowWrap: 'anywhere',
}

const adminReviewGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
  gap: 18,
  marginTop: 18,
  alignItems: 'start',
  minWidth: 0,
}

const adminReviewPanelStyle: CSSProperties = {
  padding: 18,
  minHeight: 520,
  minWidth: 0,
}

const adminStatusPanelStyle: CSSProperties = {
  marginTop: 16,
  borderRadius: 16,
  padding: '12px 14px',
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const adminEmptyStateStyle: CSSProperties = {
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  borderRadius: 16,
  padding: 16,
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.6,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const adminFactStyle: CSSProperties = {
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  borderRadius: 14,
  padding: 12,
  minWidth: 0,
}

const adminFactLabelStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const adminFactValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  marginTop: 5,
  overflowWrap: 'anywhere',
}
