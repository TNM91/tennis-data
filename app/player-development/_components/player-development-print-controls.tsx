'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

type PlayerDevelopmentPrintControlsProps = {
  activePacket: 'workbook' | 'coach' | 'overview'
  identitySlug?: string
}

const labels: Record<PlayerDevelopmentPrintControlsProps['activePacket'], string> = {
  overview: 'Print overview',
  workbook: 'Print player workbook',
  coach: 'Print coach planner',
}

export default function PlayerDevelopmentPrintControls({
  activePacket,
  identitySlug,
}: PlayerDevelopmentPrintControlsProps) {
  const basePath = identitySlug ? `/player-development/${identitySlug}` : '/player-development'
  const isWorkbook = activePacket === 'workbook'

  function printPacket(scope: 'core' | 'full' = 'full') {
    document.body.dataset.playerDevelopmentPrintScope = scope
    window.print()
    window.setTimeout(() => {
      delete document.body.dataset.playerDevelopmentPrintScope
    }, 500)
  }

  return (
    <div className="surface-card panel-pad player-development-print-controls" style={wrapStyle}>
      <div style={copyStyle}>
        <span style={eyebrowStyle}>Print packet</span>
        <strong style={titleStyle}>{labels[activePacket]}</strong>
      </div>
      <div style={actionsStyle}>
        {isWorkbook ? (
          <>
            <button type="button" className="button-primary" onClick={() => printPacket('core')}>
              Print core workbook
            </button>
            <button type="button" className="button-secondary" onClick={() => printPacket('full')} style={linkStyle}>
              Print full workbook
            </button>
          </>
        ) : (
          <button type="button" className="button-primary" onClick={() => printPacket('full')}>
            Print / save PDF
          </button>
        )}
        <PacketLink href={`${basePath}/workbook`}>Workbook</PacketLink>
        <PacketLink href={`${basePath}/coach-planner`}>Coach planner</PacketLink>
      </div>
    </div>
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
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap' as const,
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

const actionsStyle = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: 10,
}

const linkStyle = {
  minHeight: 46,
}
