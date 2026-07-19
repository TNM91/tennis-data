'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

type PlayerDevelopmentPrintControlsProps = {
  activePacket: 'workbook' | 'coach' | 'overview'
  identitySlug?: string
}

const labels: Record<PlayerDevelopmentPrintControlsProps['activePacket'], string> = {
  overview: 'Optional print backup',
  workbook: 'Optional player backup',
  coach: 'Optional coach planner',
}

export default function PlayerDevelopmentPrintControls({
  activePacket,
  identitySlug,
}: PlayerDevelopmentPrintControlsProps) {
  const basePath = identitySlug ? `/player-development/${identitySlug}` : '/player-development'
  const isWorkbook = activePacket === 'workbook'
  const [screenScope, setScreenScope] = useState<'quick' | 'full'>('quick')

  useEffect(() => {
    document.body.dataset.playerDevelopmentScreenScope = screenScope

    return () => {
      delete document.body.dataset.playerDevelopmentScreenScope
    }
  }, [screenScope])

  function printPacket(scope: 'core' | 'full' = 'full') {
    document.body.dataset.playerDevelopmentPrintScope = scope
    window.print()
    window.setTimeout(() => {
      delete document.body.dataset.playerDevelopmentPrintScope
    }, 500)
  }

  return (
    <details className="surface-card panel-pad player-development-print-controls player-development-print-controls-drawer" style={wrapStyle}>
      <summary style={summaryStyle}>
        <span style={copyStyle}>
          <span style={eyebrowStyle}>Paper backup</span>
          <strong style={titleStyle}>{labels[activePacket]}</strong>
        </span>
        <span style={cueStyle}>Print options</span>
      </summary>
      <div className="player-development-print-controls-actions" style={actionsStyle}>
        {isWorkbook ? (
          <>
            <button type="button" className="button-primary" onClick={() => printPacket('core')} style={linkStyle}>
              Print quick backup
            </button>
            <button type="button" className="button-secondary" onClick={() => printPacket('full')} style={linkStyle}>
              Print full backup
            </button>
          </>
        ) : (
          <button type="button" className="button-primary" onClick={() => printPacket('full')} style={linkStyle}>
            Print backup
          </button>
        )}
        <button
          type="button"
          className="button-secondary"
          onClick={() => setScreenScope((scope) => scope === 'quick' ? 'full' : 'quick')}
          style={linkStyle}
        >
          {screenScope === 'quick' ? 'Preview all pages' : 'Show cover only'}
        </button>
        {activePacket !== 'workbook' ? <PacketLink href={`${basePath}/workbook`}>Player backup</PacketLink> : null}
        {activePacket !== 'coach' ? <PacketLink href={`${basePath}/coach-planner`}>Coach backup</PacketLink> : null}
      </div>
    </details>
  )
}

function PacketLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="button-secondary" style={linkStyle}>
      {children}
    </Link>
  )
}

const wrapStyle = {
  display: 'grid',
  gap: 10,
}

const summaryStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
  cursor: 'pointer',
  listStyle: 'none',
}

const copyStyle = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
}

const eyebrowStyle = {
  color: 'var(--brand-green-3)',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
}

const titleStyle = {
  color: 'var(--foreground-strong)',
  fontSize: '1.1rem',
}

const cueStyle = {
  borderRadius: 999,
  border: '1px solid rgba(116, 190, 255, 0.22)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  padding: '7px 10px',
  whiteSpace: 'nowrap' as const,
}

const actionsStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 132px), 1fr))',
  gap: 8,
  marginTop: 2,
  minWidth: 0,
  width: '100%',
}

const linkStyle = {
  minHeight: 42,
  width: '100%',
}
