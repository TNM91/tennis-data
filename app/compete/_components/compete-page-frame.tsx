'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import SiteShell from '@/app/components/site-shell'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type FrameProps = {
  title: string
  eyebrow: string
  description: string
  children: ReactNode
}

const HERO_SIGNALS = [
  {
    label: 'Mode',
    value: 'League',
    text: 'Run the season',
  },
  {
    label: 'Focus',
    value: 'Ready',
    text: 'Matches and results',
  },
  {
    label: 'Handoff',
    value: 'Captain',
    text: 'Team decisions',
  },
]

export default function CompetePageFrame({
  title,
  eyebrow,
  description,
  children,
}: FrameProps) {
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()

  return (
    <SiteShell active="/compete">
      <section
        style={{
          padding: isMobile ? '16px 0 48px' : '20px 0 64px',
          overflowX: 'clip',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
            margin: '0 auto',
            display: 'grid',
            gap: isMobile ? '14px' : '18px',
            minWidth: 0,
          }}
        >
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: isMobile ? '24px' : '30px',
              border: '1px solid rgba(116,190,255,0.15)',
              background: 'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(4,10,24,0.9))',
              boxShadow: '0 30px 86px rgba(2, 8, 23, 0.46), inset 0 1px 0 rgba(255,255,255,0.05)',
              minWidth: 0,
            }}
          >
            <div aria-hidden="true" style={watermarkStyle} />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gap: '14px',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  padding: isSmallMobile ? '18px' : isMobile ? '20px' : '24px',
                  display: 'grid',
                  gap: '16px',
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(min(100%, 390px), auto)',
                    gap: '14px',
                    alignItems: 'start',
                    minWidth: 0,
                  }}
                >
                  <div style={{ display: 'grid', gap: '10px', minWidth: 0 }}>
                    <div style={eyebrowChipStyle}>{eyebrow}</div>
                    <h1
                      style={{
                        margin: 0,
                        fontSize: isSmallMobile ? '32px' : isMobile ? '38px' : '48px',
                        lineHeight: 1.02,
                        letterSpacing: 0,
                        fontWeight: 900,
                        color: 'var(--foreground-strong)',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {title}
                    </h1>
                    <p
                      style={{
                        margin: 0,
                        maxWidth: '760px',
                        fontSize: isMobile ? '14px' : '15px',
                        lineHeight: 1.62,
                        fontWeight: 600,
                        color: 'var(--shell-copy-muted)',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {description}
                    </p>
                    <div style={mottoStyle}>More Tennis. Less Chaos.</div>
                  </div>

                  <div
                    style={{
                      ...signalGridStyle,
                      gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : signalGridStyle.gridTemplateColumns,
                    }}
                  >
                    {HERO_SIGNALS.map((signal) => (
                      <HeroSignal key={signal.label} {...signal} />
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {children}
        </div>
      </section>
    </SiteShell>
  )
}

function HeroSignal({
  label,
  value,
  text,
}: {
  label: string
  value: string
  text: string
}) {
  return (
    <div style={signalCardStyle}>
      <div
        style={{
          color: 'var(--muted)',
          fontSize: '10px',
          fontWeight: 800,
          letterSpacing: 0,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: '4px',
          color: 'var(--foreground-strong)',
          fontSize: '20px',
          fontWeight: 900,
          letterSpacing: 0,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: '3px',
          color: 'var(--shell-copy-muted)',
          fontSize: '12px',
          lineHeight: 1.35,
          fontWeight: 700,
          overflowWrap: 'anywhere',
        }}
      >
        {text}
      </div>
    </div>
  )
}

export function CompeteCard({
  title,
  text,
  href,
  meta,
  icon = 'teamRankings',
  action = 'Open',
}: {
  title: string
  text: string
  href: string
  meta: string
  icon?: TiqFeatureIconName
  action?: string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...cardStyle,
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        borderColor: hovered
          ? 'color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)'
          : 'var(--shell-panel-border)',
      }}
    >
      <div style={cardTopStyle}>
        <TiqFeatureIcon name={icon} size="sm" variant="ghost" />
        <div style={cardMetaStyle}>{meta}</div>
      </div>
      <div style={cardTitleStyle}>{title}</div>
      <div style={cardTextStyle}>{text}</div>
      <div style={cardCtaStyle}>{action} {'\u2192'}</div>
    </Link>
  )
}

export function CompeteGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
        gap: '16px',
        minWidth: 0,
      }}
    >
      {children}
    </div>
  )
}

const eyebrowChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  width: 'fit-content',
  maxWidth: '100%',
  minHeight: '40px',
  padding: '0 16px',
  borderRadius: '999px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-green) 10%, var(--shell-chip-bg) 90%)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const mottoStyle: CSSProperties = {
  width: 'fit-content',
  maxWidth: '100%',
  minHeight: 34,
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-green) 9%, var(--shell-chip-bg) 91%)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const signalGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
  minWidth: 0,
}

const signalCardStyle: CSSProperties = {
  minWidth: 0,
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8, 16, 34, 0.72)',
  padding: '12px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  display: 'grid',
  alignContent: 'start',
}

const cardStyle: CSSProperties = {
  minWidth: 0,
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8, 16, 34, 0.74)',
  boxShadow: '0 18px 48px rgba(2, 10, 24, 0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
  padding: '20px 20px 18px',
  display: 'grid',
  gap: '10px',
  textDecoration: 'none',
  transition: 'transform 160ms ease, border-color 160ms ease',
}

const cardTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '10px',
  minWidth: 0,
}

const cardMetaStyle: CSSProperties = {
  color: 'var(--muted)',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const cardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '22px',
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const cardTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.75,
  fontWeight: 600,
  overflowWrap: 'anywhere',
}

const cardCtaStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '13px',
  fontWeight: 800,
  letterSpacing: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: '-86px',
  top: '-108px',
  width: '340px',
  aspectRatio: '1',
  borderRadius: '50%',
  border: '34px solid rgba(155,225,29,0.07)',
  boxShadow: 'inset 0 0 0 2px rgba(125,211,252,0.05), 0 0 76px rgba(125,211,252,0.08)',
  opacity: 0.72,
  pointerEvents: 'none',
}
