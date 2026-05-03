'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import SiteShell from '@/app/components/site-shell'
import { useTheme } from '@/app/components/theme-provider'
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

export default function CompetePageFrame({
  title,
  eyebrow,
  description,
  children,
}: FrameProps) {
  const { theme } = useTheme()
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()

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
                opacity: theme === 'dark' ? 0.22 : 0.32,
                pointerEvents: 'none',
              }}
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.06fr) minmax(360px, 0.94fr)',
                gap: isTablet ? '14px' : '0',
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
                }}
              >
                <div style={eyebrowChipStyle}>{eyebrow}</div>

                <div style={{ display: 'grid', gap: '18px', maxWidth: '640px' }}>
                  <h1
                    style={{
                      margin: 0,
                      fontSize: isSmallMobile ? '42px' : isMobile ? '50px' : isTablet ? '58px' : '70px',
                      lineHeight: isMobile ? 1.02 : 0.98,
                      letterSpacing: '-0.06em',
                      fontWeight: 900,
                      color: 'var(--foreground-strong)',
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
                    }}
                  >
                    {description}
                  </p>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                    gap: '12px',
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
                    minHeight: '100%',
                    padding: isSmallMobile ? '20px 14px 16px' : isMobile ? '24px 18px 18px' : '28px 24px 22px',
                  }}
                >
                  <div style={{ display: 'grid', gap: '6px', maxWidth: '420px' }}>
                    <div
                      style={{
                        color: 'var(--brand-blue-2)',
                        fontSize: '12px',
                        fontWeight: 800,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
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
                      }}
                    >
                      Move through the week with one clean path from league context into team action.
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                        gap: '10px',
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

                    {COMPETE_NAV_ITEMS.map((item) => (
                      <SubnavLink key={item.href} href={item.href} label={item.label} />
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
          letterSpacing: '-0.05em',
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
}: {
  title: string
  text: string
  href: string
  meta: string
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
      <div style={cardMetaStyle}>{meta}</div>
      <div style={cardTitleStyle}>{title}</div>
      <div style={cardTextStyle}>{text}</div>
      <div style={cardCtaStyle}>Open {'\u2192'}</div>
    </Link>
  )
}

export function CompeteGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
      }}
    >
      {children}
    </div>
  )
}

function SubnavLink({ href, label }: { href: string; label: string }) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minHeight: '58px',
        borderRadius: '20px',
        border: '1px solid rgba(116, 190, 255, 0.16)',
        background: hovered ? 'var(--shell-chip-bg-strong)' : 'rgba(8, 18, 35, 0.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 18px',
        color: 'var(--foreground-strong)',
        fontSize: '17px',
        fontWeight: 800,
        letterSpacing: '-0.03em',
        textDecoration: 'none',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <span>{label}</span>
      <span style={{ opacity: 0.58 }}>{'\u2192'}</span>
    </Link>
  )
}

const eyebrowChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  width: 'fit-content',
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
}

const workflowPulseTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '14px',
  fontWeight: 800,
  lineHeight: 1.3,
}

const workflowPulseText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  lineHeight: 1.6,
}

const cardStyle: CSSProperties = {
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

const cardMetaStyle: CSSProperties = {
  color: 'var(--muted)',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const cardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '22px',
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const cardTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.75,
  fontWeight: 600,
}

const cardCtaStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '13px',
  fontWeight: 800,
  letterSpacing: '0.02em',
}
