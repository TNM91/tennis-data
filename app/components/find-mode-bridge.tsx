'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'

type FindBridgeLink = {
  href: string
  label: string
  icon: TiqFeatureIconName
}

export default function FindModeBridge({
  active,
  primary,
  secondary,
  links,
}: {
  active: string
  primary: string
  secondary: string
  links: FindBridgeLink[]
}) {
  return (
    <section style={findBridgeWrap} aria-label="Find mode navigation">
      <div style={findBridgeHeader}>
        <TiqFeatureIcon name="opponentScouting" size="md" variant="surface" />
        <div style={findBridgeCopy}>
          <div style={findBridgeEyebrow}>Find mode / {active}</div>
          <h2 style={findBridgeTitle}>{primary}</h2>
          <p style={findBridgeText}>{secondary}</p>
        </div>
      </div>
      <div style={findBridgeGrid}>
        {links.map((link, index) => (
          <Link key={link.href} href={link.href} style={findBridgeCard}>
            <span style={findBridgeNumber}>{index + 1}</span>
            <TiqFeatureIcon name={link.icon} size="sm" variant="ghost" />
            <strong style={findBridgeLabel}>{link.label}</strong>
          </Link>
        ))}
      </div>
    </section>
  )
}

const findBridgeWrap: CSSProperties = {
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 32px)))',
  margin: '18px auto 0',
  display: 'grid',
  gap: 14,
  padding: 16,
  borderRadius: 22,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'linear-gradient(180deg, rgba(13,28,53,0.74) 0%, rgba(9,20,39,0.9) 100%)',
  boxShadow: '0 18px 46px rgba(2,10,24,0.14), inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
}

const findBridgeHeader: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '48px minmax(0, 1fr)',
  gap: 12,
  alignItems: 'center',
  minWidth: 0,
}

const findBridgeCopy: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
}

const findBridgeEyebrow: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const findBridgeTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.15rem, 2vw, 1.5rem)',
  lineHeight: 1.05,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const findBridgeText: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const findBridgeGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const findBridgeCard: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28px 32px minmax(0, 1fr)',
  gap: 9,
  alignItems: 'center',
  minHeight: 58,
  padding: '9px 10px',
  borderRadius: 15,
  border: '1px solid rgba(116,190,255,0.09)',
  background: 'rgba(255,255,255,0.035)',
  color: 'var(--foreground)',
  textDecoration: 'none',
  minWidth: 0,
}

const findBridgeNumber: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  fontWeight: 950,
}

const findBridgeLabel: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
}
