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
    label: 'Weekly hub',
    value: 'Compete',
    text: 'Keep active leagues, teams, schedule, and results organized in one rhythm.',
  },
  {
    label: 'Decision speed',
    value: 'Fast',
    text: 'Move from discovery into action without hunting across disconnected pages.',
  },
  {
    label: 'Captain handoff',
    value: 'Ready',
    text: 'Jump directly into lineups, scenarios, availability, and outreach when needed.',
  },
]

const WORKFLOW_PULSES = [
  {
    label: 'Now',
    title: 'See active league context',
    text: 'Start from your live leagues and teams before captain decisions begin.',
  },
  {
    label: 'Next',
    title: 'Move into schedule and results',
    text: 'Stay inside one weekly path instead of bouncing across disconnected pages.',
  },
  {
    label: 'Ready',
    title: 'Hand off to Captain',
    text: 'Availability, lineups, scenarios, and messaging stay one click away.',
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
            gap: isMobile ? '18px' : '24px',
          }}
        >
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: isMobile ? '30px' : '38px',
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
                gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1.06fr) minmax(min(100%, 360px), 0.94fr)',
                gap: isTablet ? '14px' : '0',
                minWidth: 0,
                minHeight: isTablet ? 'auto' : '560px',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  padding: isSmallMobile
                    ? '26px 18px 22px'
                    : isMobile
                      ? '30px 22px 24px'
                      : isTablet
                        ? '36px 28px 28px'
                        : '46px 42px 38px',
                  display: 'grid',
                  alignContent: 'space-between',
                  gap: '24px',
                  minWidth: 0,
                }}
              >
                <div style={eyebrowChipStyle}>{eyebrow}</div>

                <div style={{ display: 'grid', gap: '18px', maxWidth: '640px', minWidth: 0 }}>
                  <h1
                    style={{
                      margin: 0,
                      fontSize: isSmallMobile ? '42px' : isMobile ? '50px' : isTablet ? '58px' : '70px',
                      lineHeight: isMobile ? 1.02 : 0.98,
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
                      maxWidth: '620px',
                      fontSize: isMobile ? '16px' : '18px',
                      lineHeight: 1.78,
                      fontWeight: 500,
                      color: 'var(--shell-copy-muted)',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {description}
                  </p>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))',
                    gap: '12px',
                    minWidth: 0,
                    maxWidth: '760px',
                  }}
                >
                  {HERO_SIGNALS.map((signal) => (
                    <HeroSignal key={signal.label} {...signal} />
                  ))}
                </div>
              </div>

              <div
                style={{
                  position: 'relative',
                  minWidth: 0,
                  minHeight: isSmallMobile ? '320px' : isMobile ? '360px' : isTablet ? '430px' : '560px',
                  borderLeft: isTablet ? 'none' : '1px solid rgba(116, 190, 255, 0.10)',
                  background: 'var(--shell-panel-bg)',
                }}
              >
                <div style={workflowBoardGlow} />
                <div style={workflowBoardGrid} />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: isTablet ? 'var(--shell-hero-mask-mobile)' : 'var(--shell-hero-mask)',
                    pointerEvents: 'none',
                  }}
                />

                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    display: 'grid',
                    alignContent: 'space-between',
                    gap: '18px',
                    minWidth: 0,
                    minHeight: '100%',
                    padding: isSmallMobile ? '20px 14px 16px' : isMobile ? '24px 18px 18px' : '28px 24px 22px',
                  }}
                >
                  <div style={{ display: 'grid', gap: '6px', maxWidth: '420px', minWidth: 0 }}>
                    <div
                      style={{
                        color: 'var(--brand-blue-2)',
                        fontSize: '12px',
                        fontWeight: 800,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      Workflow map
                    </div>
                    <div
                      style={{
                        color: 'var(--foreground)',
                        fontSize: '15px',
                        lineHeight: 1.7,
                        fontWeight: 600,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      Move through the week with one clean path from league context into team action.
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gap: '12px',
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))',
                        gap: '10px',
                        minWidth: 0,
                      }}
                    >
                      {WORKFLOW_PULSES.map((item) => (
                        <div key={item.title} style={workflowPulseCard}>
                          <div style={workflowPulseLabel}>{item.label}</div>
                          <div style={workflowPulseTitle}>{item.title}</div>
                          <div style={workflowPulseText}>{item.text}</div>
                        </div>
                      ))}
                    </div>

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
    <div
      style={{
        borderRadius: '20px',
        border: '1px solid var(--shell-panel-border)',
        background: 'var(--shell-chip-bg)',
        padding: '16px 16px 14px',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <div
        style={{
          color: 'var(--muted)',
          fontSize: '11px',
          fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: '6px',
          color: 'var(--foreground-strong)',
          fontSize: '24px',
          fontWeight: 900,
          letterSpacing: 0,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: '6px',
          color: 'var(--shell-copy-muted)',
          fontSize: '13px',
          lineHeight: 1.7,
          fontWeight: 600,
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

const workflowBoardGlow: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(circle at 76% 22%, rgba(155,225,29,0.18) 0%, rgba(155,225,29,0.06) 22%, rgba(155,225,29,0) 56%), radial-gradient(circle at 18% 78%, rgba(116,190,255,0.16) 0%, rgba(116,190,255,0.06) 20%, rgba(116,190,255,0) 50%)',
  pointerEvents: 'none',
}

const workflowBoardGrid: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(var(--page-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--page-grid-line) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
  opacity: 0.16,
  pointerEvents: 'none',
}

const workflowPulseCard: CSSProperties = {
  minWidth: 0,
  borderRadius: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: '14px 14px 13px',
  boxShadow: 'var(--shadow-soft)',
  display: 'grid',
  gap: '8px',
}

const workflowPulseLabel: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const workflowPulseTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '14px',
  fontWeight: 800,
  lineHeight: 1.3,
  overflowWrap: 'anywhere',
}

const workflowPulseText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  lineHeight: 1.6,
  overflowWrap: 'anywhere',
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
