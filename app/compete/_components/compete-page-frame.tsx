'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import SiteShell from '@/app/components/site-shell'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { COMPETE_NAV_ITEMS } from '@/lib/site-navigation'
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
    value: 'Compete',
    text: 'This week',
  },
  {
    label: 'Motto',
    value: 'Less chaos',
    text: 'More Tennis',
  },
  {
    label: 'Handoff',
    value: 'Ready',
    text: 'Captain tools',
  },
]

const COMPETE_NAV_META: Record<string, { icon: TiqFeatureIconName; short: string }> = {
  '/compete/leagues': {
    icon: 'teamRankings',
    short: 'Know the competition layer',
  },
  '/compete/teams': {
    icon: 'lineupBuilder',
    short: 'Find the team context',
  },
  '/compete/schedule': {
    icon: 'schedule',
    short: 'See what is next',
  },
  '/compete/results': {
    icon: 'reports',
    short: 'Review what changed',
  },
  '/data-assist': {
    icon: 'accountSecurity',
    short: 'Refresh trusted data',
  },
}

export default function CompetePageFrame({
  title,
  eyebrow,
  description,
  children,
}: FrameProps) {
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const pathname = usePathname()

  return (
    <SiteShell active="/compete">
      <section
        style={{
          padding: isMobile ? '16px 12px 28px' : '20px 16px 34px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'grid',
            gap: isMobile ? '14px' : '18px',
          }}
        >
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: isMobile ? '24px' : '30px',
              border: '1px solid var(--shell-panel-border)',
              background: 'var(--shell-panel-bg-strong)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage:
                  'linear-gradient(var(--page-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--page-grid-line) 1px, transparent 1px)',
                backgroundSize: isSmallMobile ? '26px 26px' : '32px 32px',
                opacity: 0.22,
                pointerEvents: 'none',
              }}
            />

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

                <nav
                  aria-label="Compete tools"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
                    gap: '10px',
                    minWidth: 0,
                  }}
                >
                  {COMPETE_NAV_ITEMS.map((item, index) => (
                    <SubnavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      index={index + 1}
                      active={pathname === item.href}
                      meta={COMPETE_NAV_META[item.href]?.short ?? 'Open competition tool'}
                      icon={COMPETE_NAV_META[item.href]?.icon ?? 'teamRankings'}
                    />
                  ))}
                </nav>
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
          letterSpacing: '0.1em',
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
        borderColor: hovered ? 'rgba(74, 163, 255, 0.24)' : 'var(--shell-panel-border)',
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

function SubnavLink({
  href,
  label,
  index,
  active,
  meta,
  icon,
}: {
  href: string
  label: string
  index: number
  active: boolean
  meta: string
  icon: TiqFeatureIconName
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-current={active ? 'page' : undefined}
      style={{
        minHeight: '64px',
        borderRadius: '18px',
        border: active
          ? '1px solid color-mix(in srgb, var(--brand-green) 34%, rgba(116,190,255,0.12) 66%)'
          : '1px solid rgba(116, 190, 255, 0.16)',
        background: active
          ? 'color-mix(in srgb, rgba(255,255,255,0.045) 82%, var(--brand-green) 18%)'
          : hovered
            ? 'var(--shell-chip-bg-strong)'
            : 'rgba(8, 18, 35, 0.42)',
        display: 'grid',
        gridTemplateColumns: '28px 34px minmax(0, 1fr) minmax(0, auto)',
        alignItems: 'center',
        gap: '10px',
        minWidth: 0,
        padding: '9px 12px',
        color: 'var(--foreground-strong)',
        letterSpacing: 0,
        textDecoration: 'none',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <span style={subnavStepStyle}>{index}</span>
      <TiqFeatureIcon name={icon} size="sm" variant={active ? 'surface' : 'ghost'} />
      <span style={subnavCopyStyle}>
        <span style={subnavLabelStyle}>{label}</span>
        <span style={subnavMetaStyle}>{meta}</span>
      </span>
      <span style={subnavStateStyle}>{active ? 'Here' : 'Open'}</span>
    </Link>
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
  border: '1px solid rgba(155, 225, 29, 0.28)',
  background: 'rgba(155, 225, 29, 0.10)',
  color: 'var(--home-eyebrow-color)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.12em',
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: '12px',
  boxShadow: 'var(--shadow-soft)',
  display: 'grid',
  alignContent: 'start',
}

const cardStyle: CSSProperties = {
  minWidth: 0,
  borderRadius: '24px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
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
  letterSpacing: '0.12em',
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
  letterSpacing: '0.02em',
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
}

const subnavStepStyle: CSSProperties = {
  width: 26,
  height: 26,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  fontWeight: 950,
}

const subnavCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
}

const subnavLabelStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.1,
  fontWeight: 900,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const subnavMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.25,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const subnavStateStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  minWidth: 0,
}
