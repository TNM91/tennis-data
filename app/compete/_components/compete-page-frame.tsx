'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import SiteShell from '@/app/components/site-shell'
import TrackedProductLink, { type ProductLinkEvent } from '@/app/components/tracked-product-link'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'
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
    text: 'Prepare the next match',
  },
  {
    label: 'Focus',
    value: 'Scouting',
    text: 'Players, teams, matchups',
  },
  {
    label: 'Handoff',
    value: 'Captain',
    text: 'Lineup decisions',
  },
]

const CAPTAIN_HANDOFF_STEPS = [
  'Start with matchup, player, team, and schedule context.',
  'Turn the read into availability, lineup, scenario, and message decisions.',
  'Keep Team Hub pointed at the same match-week reality.',
]

const CAPTAIN_HANDOFF_ACTIONS = [
  { href: '/captain', label: 'Open Team Hub' },
  { href: '/captain/lineup-builder', label: 'Build lineup' },
  { href: '/captain/team-brief', label: 'Team brief' },
]

const COMPETE_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('relentless-competitor-4-0')
const COMPETE_PLAYER_IDENTITY_READ = getPlayerDevelopmentIdentityActionRead(COMPETE_PLAYER_IDENTITY)
const COMPETE_LEVEL_UP_HREF = `/level-up/${COMPETE_PLAYER_IDENTITY.slug}#level-up-flow`
const COMPETE_PLAYER_DEVELOPMENT_HREF = `/player-development/${COMPETE_PLAYER_IDENTITY.slug}`
const COMPETE_PLAYER_ID_ACTIONS = [
  { href: COMPETE_LEVEL_UP_HREF, label: 'Start Level Up' },
  { href: COMPETE_PLAYER_DEVELOPMENT_HREF, label: 'Read Player ID' },
  { href: '/matchup', label: 'Prep matchup' },
]
const COMPETE_PLAYER_ID_READ = [
  { label: 'Match priority', value: COMPETE_PLAYER_IDENTITY_READ.trainingPriority },
  { label: 'Proof target', value: COMPETE_PLAYER_IDENTITY_READ.proofTarget },
  { label: 'Pressure trigger', value: COMPETE_PLAYER_IDENTITY_READ.matchTrigger },
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

                  <details className="competeDetailsSection" style={heroSignalsDisclosureStyle}>
                    <summary style={heroSignalsSummaryStyle}>Need a quick read?</summary>
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
                  </details>
                </div>

              </div>
            </div>
          </div>

          {children}

          <details className="competeDetailsSection" style={competeSupportDisclosureStyle}>
            <summary style={competeSupportSummaryStyle}>
              <span style={competeSupportSummaryTextStyle}>Use your Player ID before match prep</span>
              <span>Open</span>
            </summary>
            <div style={competeSupportBodyStyle}>
              <section
                aria-label="Compete Player ID match prep"
                style={{
                  ...competePlayerIdStyle,
                  gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : competePlayerIdStyle.gridTemplateColumns,
                }}
              >
                <div style={competePlayerIdCopyStyle}>
                  <div style={competePlayerIdEyebrowStyle}>Player ID match prep</div>
                  <h2 style={competePlayerIdTitleStyle}>Compete from a clear player read.</h2>
                  <p style={competePlayerIdTextStyle}>
                    {COMPETE_PLAYER_IDENTITY_READ.levelUpNudge} Use that read before matchup prep, scouting, or captain handoff.
                  </p>
                </div>
                <div
                  aria-label="Compete Player ID starter read"
                  style={{
                    ...competePlayerIdReadStyle,
                    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : competePlayerIdReadStyle.gridTemplateColumns,
                  }}
                >
                  {COMPETE_PLAYER_ID_READ.map((item) => (
                    <div key={item.label} style={competePlayerIdReadCardStyle}>
                      <span style={competePlayerIdReadLabelStyle}>{item.label}</span>
                      <strong style={competePlayerIdReadValueStyle}>{item.value}</strong>
                    </div>
                  ))}
                </div>
                <div style={competePlayerIdActionsStyle}>
                  {COMPETE_PLAYER_ID_ACTIONS.map((action, index) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      style={{
                        ...competePlayerIdActionStyle,
                        ...(index === 0 ? competePlayerIdPrimaryActionStyle : {}),
                      }}
                    >
                      {action.label}
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          </details>

          <details className="competeDetailsSection" style={competeSupportDisclosureStyle}>
            <summary style={competeSupportSummaryStyle}>
              <span style={competeSupportSummaryTextStyle}>Turn this into a captain move</span>
              <span>Open</span>
            </summary>
            <div style={competeSupportBodyStyle}>
              <section
                aria-label="Captain match-week bridge cue"
                style={{
                  ...captainBridgeStyle,
                  gridTemplateColumns: isTablet
                    ? 'minmax(0, 1fr)'
                    : captainBridgeStyle.gridTemplateColumns,
                }}
              >
                <div style={captainBridgeCopyStyle}>
                  <div style={captainBridgeEyebrowStyle}>Captain match-week bridge</div>
                  <h2 style={captainBridgeTitleStyle}>Turn Compete context into Team Hub decisions.</h2>
                  <p style={captainBridgeTextStyle}>
                    Use matchup, scouting, schedule, and team context here to feed the captain week: availability, lineup, scenario, and team message.
                  </p>
                </div>
                <div style={captainBridgeStepsStyle}>
                  {CAPTAIN_HANDOFF_STEPS.map((step, index) => (
                    <div key={step} style={captainBridgeStepStyle}>
                      <span style={captainBridgeStepNumberStyle}>{index + 1}</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
                <div style={captainBridgeActionsStyle}>
                  {CAPTAIN_HANDOFF_ACTIONS.map((action) => (
                    <Link key={action.href} href={action.href} style={captainBridgeActionStyle}>
                      {action.label}
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          </details>
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
  question,
  icon = 'teamRankings',
  action = 'Open',
  event,
}: {
  title: string
  text: string
  href: string
  meta: string
  question?: string
  icon?: TiqFeatureIconName
  action?: string
  event?: ProductLinkEvent
}) {
  const [hovered, setHovered] = useState(false)
  const { isMobile } = useViewportBreakpoints()

  return (
    <TrackedProductLink
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      ariaLabel={`${action}: ${title}. ${question || text}`}
      event={event}
      style={{
        ...cardStyle,
        ...(isMobile ? compactCardStyle : {}),
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        borderColor: hovered
          ? 'color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)'
          : 'var(--shell-panel-border)',
      }}
    >
      <div style={cardTopStyle}>
        <TiqFeatureIcon name={icon} size="sm" variant="ghost" />
        <div style={{ ...cardMetaStyle, ...(isMobile ? compactCardMetaStyle : {}) }}>{meta}</div>
      </div>
      <div style={{ ...cardTitleStyle, ...(isMobile ? compactCardTitleStyle : {}) }}>{title}</div>
      {!isMobile && question ? <div style={cardQuestionStyle}>{question}</div> : null}
      {!isMobile ? <div style={cardTextStyle}>{text}</div> : null}
      <div style={{ ...cardCtaStyle, ...(isMobile ? compactCardCtaStyle : {}) }}>{action} {'\u2192'}</div>
    </TrackedProductLink>
  )
}

export function CompeteGrid({ children }: { children: ReactNode }) {
  const { isMobile } = useViewportBreakpoints()

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
        gap: isMobile ? '10px' : '16px',
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

const heroSignalsDisclosureStyle: CSSProperties = {
  minWidth: 0,
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8, 16, 34, 0.58)',
  overflow: 'hidden',
}

const heroSignalsSummaryStyle: CSSProperties = {
  cursor: 'pointer',
  minHeight: 42,
  padding: '0 14px',
  color: 'var(--foreground-strong)',
  fontSize: '13px',
  fontWeight: 900,
  display: 'flex',
  alignItems: 'center',
  overflowWrap: 'anywhere',
}

const signalGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
  minWidth: 0,
  padding: 10,
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
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8, 16, 34, 0.74)',
  boxShadow: '0 18px 48px rgba(2, 10, 24, 0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
  padding: '16px',
  display: 'grid',
  gap: '8px',
  textDecoration: 'none',
  transition: 'transform 160ms ease, border-color 160ms ease',
}

const compactCardStyle: CSSProperties = {
  minHeight: 108,
  alignContent: 'space-between',
  borderRadius: 13,
  padding: '10px',
  gap: '5px',
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

const compactCardMetaStyle: CSSProperties = {
  fontSize: 9,
  lineHeight: 1.1,
}

const cardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '22px',
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const compactCardTitleStyle: CSSProperties = {
  fontSize: 16,
  lineHeight: 1.08,
}

const cardQuestionStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '12px',
  lineHeight: 1.35,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const cardTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.5,
  fontWeight: 600,
  overflowWrap: 'anywhere',
}

const competeSupportDisclosureStyle: CSSProperties = {
  minWidth: 0,
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8, 16, 34, 0.62)',
  boxShadow: '0 14px 36px rgba(2, 10, 24, 0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
  overflow: 'hidden',
}

const competeSupportSummaryStyle: CSSProperties = {
  cursor: 'pointer',
  minHeight: 48,
  padding: '0 14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  color: 'var(--foreground-strong)',
  fontSize: '13px',
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const competeSupportSummaryTextStyle: CSSProperties = {
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const competeSupportBodyStyle: CSSProperties = {
  minWidth: 0,
  padding: '0 10px 10px',
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

const compactCardCtaStyle: CSSProperties = {
  marginTop: 0,
  fontSize: 12,
}

const captainBridgeStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, auto)',
  gap: '14px',
  alignItems: 'center',
  padding: '16px',
  borderRadius: '20px',
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(12, 29, 34, 0.82), rgba(8, 16, 34, 0.76))',
  boxShadow: '0 18px 48px rgba(2, 10, 24, 0.22), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
}

const competePlayerIdStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.2fr) minmax(0, auto)',
  gap: '14px',
  alignItems: 'stretch',
  padding: '16px',
  borderRadius: '20px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(135deg, rgba(8, 16, 34, 0.82), rgba(10, 28, 36, 0.74))',
  boxShadow: '0 18px 48px rgba(2, 10, 24, 0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
}

const competePlayerIdCopyStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'center',
  gap: '6px',
  minWidth: 0,
}

const competePlayerIdEyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '11px',
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const competePlayerIdTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: '22px',
  lineHeight: 1.12,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const competePlayerIdTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.58,
  fontWeight: 650,
  overflowWrap: 'anywhere',
}

const competePlayerIdReadStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '8px',
  minWidth: 0,
}

const competePlayerIdReadCardStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: '5px',
  minWidth: 0,
  minHeight: 98,
  padding: '11px',
  borderRadius: '15px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(4, 10, 24, 0.42)',
}

const competePlayerIdReadLabelStyle: CSSProperties = {
  color: 'var(--muted)',
  fontSize: '10px',
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const competePlayerIdReadValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  lineHeight: 1.45,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const competePlayerIdActionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  alignContent: 'center',
  gap: '8px',
  minWidth: 0,
}

const competePlayerIdActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  minHeight: 36,
  padding: '8px 11px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.2)',
  background: 'rgba(255,255,255,0.05)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: '12px',
  fontWeight: 900,
  textAlign: 'center',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const competePlayerIdPrimaryActionStyle: CSSProperties = {
  borderColor: 'rgba(155,225,29,0.32)',
  background: 'rgba(155,225,29,0.12)',
  color: '#f5ffe2',
}

const captainBridgeCopyStyle: CSSProperties = {
  display: 'grid',
  gap: '6px',
  minWidth: 0,
}

const captainBridgeEyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '11px',
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const captainBridgeTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: '20px',
  lineHeight: 1.15,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainBridgeTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.6,
  fontWeight: 650,
  overflowWrap: 'anywhere',
}

const captainBridgeStepsStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
  minWidth: 0,
}

const captainBridgeStepStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 24px) minmax(0, 1fr)',
  gap: '8px',
  alignItems: 'center',
  minWidth: 0,
  color: 'rgba(223,238,255,0.86)',
  fontSize: '12px',
  lineHeight: 1.45,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainBridgeStepNumberStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: 'rgba(155,225,29,0.14)',
  color: '#f5ffe2',
  fontSize: '11px',
  fontWeight: 950,
}

const captainBridgeActionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: '8px',
  minWidth: 0,
}

const captainBridgeActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  minHeight: 34,
  padding: '8px 11px',
  borderRadius: '999px',
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.11)',
  color: '#f5ffe2',
  textDecoration: 'none',
  fontSize: '12px',
  fontWeight: 900,
  textAlign: 'center',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: 0,
  top: '-108px',
  width: 'min(100%, 340px)',
  aspectRatio: '1045 / 490',
  background: 'url("/tiq/logo/tiq-mark-light.png") center / contain no-repeat',
  opacity: 0.14,
  pointerEvents: 'none',
}
