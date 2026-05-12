'use client'

import Link from 'next/link'
import { CSSProperties, ReactNode, useState } from 'react'
import SiteShell from '@/app/components/site-shell'
import AdsenseSlot from '@/app/components/adsense-slot'
import { shouldShowSponsoredPlacements } from '@/lib/access-model'
import { DATA_ASSIST_STORY, MEMBERSHIP_TIERS } from '@/lib/product-story'
import { useProductAccess } from '@/lib/use-product-access'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'

const FEATURE_CARDS = [
  {
    href: '/explore/players',
    eyebrow: 'Find',
    title: 'Find a player',
    text: 'Search names, ratings, teams, and match history.',
    cta: 'Find players',
    accent: 'blue' as const,
    icon: 'player',
  },
  {
    href: '/explore/teams',
    eyebrow: 'Find',
    title: 'Find a team',
    text: 'Open rosters, flights, and recent team results.',
    cta: 'Find teams',
    accent: 'green' as const,
    icon: 'team',
  },
  {
    href: '/explore/leagues',
    eyebrow: 'Find',
    title: 'Find a league',
    text: 'Browse USTA-style and TIQ league context from one place.',
    cta: 'Find leagues',
    accent: 'blue' as const,
    icon: 'trophy',
  },
  {
    href: '/explore/rankings',
    eyebrow: 'Check',
    title: 'Check rankings',
    text: 'Scan the field before drilling into a player or flight.',
    cta: 'View rankings',
    accent: 'green' as const,
    icon: 'chart',
  },
]

const START_STEPS = [
  {
    label: 'Start free',
    title: 'Explore tennis context',
    text: 'Look up players, teams, leagues, and rankings without setting anything up.',
  },
  {
    label: 'Go deeper',
    title: 'Open the right page',
    text: 'Use a profile, team page, league page, or rankings view once you know what you need.',
  },
  {
    label: 'Save effort',
    title: 'Upgrade when it helps',
    text: 'Use My Lab and Matchup when you want follows, prep, and a personal tennis home.',
  },
]

const DISCOVERY_PATHS = [
  {
    label: 'I know a name',
    title: 'Search players',
    text: 'Start from a player record, then open teams, leagues, or match history.',
    href: '/explore/search?scope=players',
  },
  {
    label: 'I know the team',
    title: 'Find team context',
    text: 'Use a team page to check roster shape, flight, league, and recent results.',
    href: '/explore/search?scope=teams',
  },
  {
    label: 'I know the league',
    title: 'Browse leagues',
    text: 'Separate imported TennisLink context from TIQ league play before drilling into teams or players.',
    href: '/explore/leagues',
  },
  {
    label: 'I have exports',
    title: 'Refresh with Data Assist',
    text: DATA_ASSIST_STORY.shortCue,
    href: DATA_ASSIST_STORY.href,
  },
  {
    label: 'I need the field',
    title: 'Check rankings',
    text: 'Scan ratings and rankings before choosing who or what to inspect.',
    href: '/explore/rankings',
  },
]

const EXPLORE_INLINE_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_EXPLORE_INLINE || null

export default function ExplorePage() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const { access } = useProductAccess()
  const shouldShowAds = shouldShowSponsoredPlacements(access)

  const dynamicHeroWrap: CSSProperties = {
    ...heroWrap,
    padding: isMobile ? '14px 14px 24px' : '16px 16px 26px',
  }

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isSmallMobile ? '24px 18px 22px' : isMobile ? '28px 20px 24px' : '30px',
    borderRadius: isMobile ? '28px' : '30px',
    background: 'var(--shell-panel-bg-strong)',
    border: '1px solid var(--shell-panel-border)',
    boxShadow: 'var(--shadow-card)',
  }

  const dynamicHeroContent: CSSProperties = {
    ...heroContent,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 0.94fr) minmax(min(100%, 420px), 1fr)',
    gap: isMobile ? '20px' : '30px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '38px' : isMobile ? '50px' : '58px',
    lineHeight: isMobile ? 1.02 : 0.98,
    maxWidth: '760px',
  }

  const dynamicHeroText: CSSProperties = {
    ...heroText,
    fontSize: isMobile ? '15px' : '18px',
    maxWidth: '640px',
  }

  const dynamicArtPanelStyle: CSSProperties = {
    ...featurePanel,
    position: 'relative',
    minHeight: isMobile ? 'auto' : isTablet ? '420px' : '342px',
    padding: 0,
    overflow: 'hidden',
    background: 'var(--shell-panel-bg)',
    border: '1px solid var(--shell-panel-border)',
    boxShadow: 'var(--shadow-soft)',
  }

  const dynamicArtMaskStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: isTablet
      ? 'var(--shell-hero-mask-mobile)'
      : 'var(--shell-hero-mask)',
    pointerEvents: 'none',
    zIndex: 1,
  }

  const dynamicArtOverlayStyle: CSSProperties = {
    position: isMobile ? 'relative' : 'absolute',
    top: isMobile ? 'auto' : '16px',
    left: isMobile ? 'auto' : '20px',
    right: isMobile ? 'auto' : '20px',
    bottom: isMobile ? 'auto' : '16px',
    display: 'grid',
    gap: '12px',
    alignContent: 'start',
    zIndex: 2,
    padding: isMobile ? '16px' : 0,
    boxSizing: 'border-box',
  }

  const dynamicActionGrid: CSSProperties = {
    ...actionGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
    gap: isMobile ? '14px' : '16px',
  }

  const dynamicDiscoveryPathGrid: CSSProperties = {
    ...discoveryPathGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  }

  const dynamicDiscoveryPathHeader: CSSProperties = {
    ...discoveryPathHeader,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 0.72fr) minmax(min(100%, 260px), 0.55fr)',
  }

  return (
    <SiteShell active="explore">
      <section style={dynamicHeroWrap}>
        <div style={dynamicHeroShell}>
          <div style={heroNoise} />
          <div style={heroMesh} />

          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <div style={eyebrow}>Free exploration</div>

              <h1 style={dynamicHeroTitle}>
                Find tennis context fast.
              </h1>

              <p style={dynamicHeroText}>
                Start with a player, team, league, or ranking. Get oriented first, then decide if you need My Lab, Matchup, or Captain tools.
              </p>

              <div style={explorePills}>
                <span style={pillBlue}>Players</span>
                <span style={pillBlue}>Teams</span>
                <span style={pillGreen}>Leagues</span>
                <span style={pillGreen}>Rankings</span>
              </div>
            </div>

            <div style={dynamicArtPanelStyle}>
              <div style={discoveryBoardGlow} />
              <div style={discoveryBoardGrid} />
              <div style={dynamicArtMaskStyle} />

              <div style={dynamicArtOverlayStyle}>
                <div style={featurePanelHeader}>
                  <div style={featurePanelLabel}>Start here</div>
                  <div style={featurePanelHint}>Free tier</div>
                </div>

                <div style={startStepStack}>
                  {START_STEPS.map((item, index) => (
                    <div key={item.title} style={startStepCard}>
                      <div style={startStepNumber}>{index + 1}</div>
                      <div>
                        <div style={startStepLabel}>{item.label}</div>
                        <div style={startStepTitle}>{item.title}</div>
                        <div style={startStepText}>{item.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={discoveryPathPanel}>
            <div style={dynamicDiscoveryPathHeader}>
              <div>
                <div style={discoveryPathKicker}>{MEMBERSHIP_TIERS.free.name}</div>
                <h2 style={discoveryPathTitle}>Start with what you know.</h2>
              </div>
              <p style={discoveryPathCopy}>{MEMBERSHIP_TIERS.free.description}</p>
            </div>

            <div style={dynamicDiscoveryPathGrid}>
              {DISCOVERY_PATHS.map((path) => (
                <Link key={path.href} href={path.href} style={discoveryPathCard}>
                  <span style={discoveryPathLabel}>{path.label}</span>
                  <span style={discoveryPathCardTitle}>{path.title}</span>
                  <span style={discoveryPathCardText}>{path.text}</span>
                </Link>
              ))}
            </div>
          </div>

          <div style={dynamicActionGrid}>
            {FEATURE_CARDS.map((card) => (
              <ActionCard
                key={card.href}
                href={card.href}
                eyebrow={card.eyebrow}
                title={card.title}
                text={card.text}
                cta={card.cta}
                icon={getCardIcon(card.icon)}
                hovered={hoveredCard === card.href}
                onEnter={() => setHoveredCard(card.href)}
                onLeave={() => setHoveredCard(null)}
                accent={card.accent}
              />
            ))}
          </div>
        </div>
      </section>
      {shouldShowAds ? (
        <div style={{ marginTop: 12 }}>
          <AdsenseSlot slot={EXPLORE_INLINE_AD_SLOT} label="Sponsored" minHeight={250} />
        </div>
      ) : null}
    </SiteShell>
  )
}

function getCardIcon(icon: string) {
  const iconMap: Record<string, TiqFeatureIconName> = {
    player: 'opponentScouting',
    team: 'teamRankings',
    chart: 'playerRatings',
    trophy: 'reports',
    matchup: 'matchupAnalysis',
  }

  return <TiqFeatureIcon name={iconMap[icon] || 'opponentScouting'} size="lg" variant="ghost" />
}

function ActionCard({
  href,
  eyebrow,
  title,
  text,
  cta,
  icon,
  hovered,
  onEnter,
  onLeave,
  accent = 'blue',
}: {
  href: string
  eyebrow?: string
  title: string
  text: string
  cta: string
  icon: ReactNode
  hovered: boolean
  onEnter: () => void
  onLeave: () => void
  accent?: 'blue' | 'green'
}) {
  const iconStyle = accent === 'green' ? actionCardIconGreen : actionCardIconBlue
  const ctaStyle = accent === 'green' ? actionFooterCtaGreen : actionFooterCtaBlue

  return (
    <Link
      href={href}
      style={{
        ...actionCard,
        ...(hovered ? actionCardHover : {}),
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div style={actionCardTop}>
        <div
          style={{
            ...actionCardIcon,
            ...iconStyle,
            ...(hovered ? actionCardIconHover : {}),
          }}
        >
          {icon}
        </div>
      </div>

      <div style={actionBody}>
        {eyebrow ? <div style={actionEyebrow}>{eyebrow}</div> : null}
        <div style={actionTitle}>{title}</div>
        <div style={actionText}>{text}</div>
      </div>

      <div style={actionFooterRow}>
        <span style={ctaStyle}>{cta}</span>
        <span style={actionFooterArrow}>{'->'}</span>
      </div>
    </Link>
  )
}

const heroWrap: CSSProperties = {
  position: 'relative',
  zIndex: 1,
}

const heroShell: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  borderRadius: '30px',
  background: 'var(--shell-panel-bg-strong)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-card)',
  overflow: 'hidden',
  position: 'relative',
  minWidth: 0,
}

const heroNoise: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: `
    radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--brand-blue-2) 20%, transparent) 0%, transparent 30%),
    radial-gradient(circle at 72% 8%, color-mix(in srgb, var(--brand-blue-2) 12%, transparent) 0%, transparent 26%),
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--brand-lime) 9%, transparent) 0%, transparent 28%),
    linear-gradient(180deg, color-mix(in srgb, var(--foreground-strong) 3%, transparent) 0%, transparent 26%)
  `,
  pointerEvents: 'none',
}

const heroMesh: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  background: `
    linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 22%),
    radial-gradient(circle at 18% 100%, rgba(155,225,29,0.10) 0%, transparent 24%)
  `,
}

const heroContent: CSSProperties = {
  display: 'grid',
  alignItems: 'start',
  marginBottom: '18px',
  position: 'relative',
  zIndex: 1,
  minWidth: 0,
}

const heroLeft: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-start',
  gap: '16px',
  minWidth: 0,
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  alignItems: 'center',
  padding: '8px 14px',
  borderRadius: '999px',
  color: 'var(--foreground-strong)',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--home-control-shadow)',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const heroTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const heroText: CSSProperties = {
  margin: 0,
  color: 'var(--foreground)',
  lineHeight: 1.7,
  fontWeight: 500,
}

const explorePills: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '4px',
}

const pillBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '32px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.04em',
}

const pillBlue: CSSProperties = {
  ...pillBase,
  color: 'var(--foreground-strong)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 12%, var(--shell-chip-bg) 88%)',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-panel-border) 78%)',
}

const pillGreen: CSSProperties = {
  ...pillBase,
  color: 'var(--foreground-strong)',
  background: 'color-mix(in srgb, var(--brand-lime) 11%, var(--shell-chip-bg) 89%)',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 24%, var(--shell-panel-border) 76%)',
}

const featurePanel: CSSProperties = {
  borderRadius: '24px',
  background: 'var(--shell-panel-bg)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
  padding: '20px',
}

const featurePanelHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '8px',
  minWidth: 0,
  flexWrap: 'wrap',
}

const featurePanelLabel: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  fontWeight: 800,
  letterSpacing: 0,
}

const featurePanelHint: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: '13px',
  fontWeight: 700,
}

const startStepStack: CSSProperties = {
  display: 'grid',
  gap: '8px',
}

const startStepCard: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: '12px',
  alignItems: 'start',
  padding: '12px 16px',
  borderRadius: '16px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
  boxSizing: 'border-box',
  overflow: 'hidden',
}

const startStepNumber: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-dark)',
  background: 'linear-gradient(135deg, var(--brand-green) 0%, #4ade80 100%)',
  fontSize: 13,
  fontWeight: 900,
}

const startStepLabel: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

const startStepTitle: CSSProperties = {
  marginTop: '4px',
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const startStepText: CSSProperties = {
  marginTop: '5px',
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
}

const discoveryBoardGlow: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(circle at 78% 22%, rgba(155,225,29,0.18) 0%, rgba(155,225,29,0.07) 22%, rgba(155,225,29,0) 52%), radial-gradient(circle at 20% 72%, rgba(116,190,255,0.16) 0%, rgba(116,190,255,0.07) 20%, rgba(116,190,255,0) 48%)',
  pointerEvents: 'none',
}

const discoveryBoardGrid: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(var(--page-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--page-grid-line) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
  opacity: 0.18,
  pointerEvents: 'none',
}

const discoveryPathPanel: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: '16px',
  marginBottom: '18px',
  padding: '18px',
  borderRadius: '24px',
  background: 'color-mix(in srgb, var(--surface-strong) 82%, transparent)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const discoveryPathHeader: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.72fr) minmax(min(100%, 260px), 0.55fr)',
  gap: '16px',
  alignItems: 'end',
}

const discoveryPathKicker: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const discoveryPathTitle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: '28px',
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: 0,
}

const discoveryPathCopy: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.6,
  fontWeight: 600,
}

const discoveryPathGrid: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const discoveryPathCard: CSSProperties = {
  display: 'grid',
  gap: '8px',
  minHeight: '142px',
  padding: '16px',
  borderRadius: '18px',
  textDecoration: 'none',
  color: 'var(--foreground)',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--card-border-soft)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
  minWidth: 0,
  boxSizing: 'border-box',
}

const discoveryPathLabel: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const discoveryPathCardTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '19px',
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const discoveryPathCardText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.55,
  fontWeight: 600,
}

const actionGrid: CSSProperties = {
  display: 'grid',
  position: 'relative',
  zIndex: 1,
}

const actionCard: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: '18px',
  minHeight: '220px',
  borderRadius: '24px',
  padding: '22px',
  textDecoration: 'none',
  color: 'var(--foreground)',
  background: 'var(--surface-strong)',
  border: '1px solid var(--card-border-soft)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.10), inset 0 1px 0 rgba(255,255,255,0.03)',
  transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
  minWidth: 0,
}

const actionCardHover: CSSProperties = {
  transform: 'translateY(-4px)',
  border: '1px solid rgba(116,190,255,0.30)',
  boxShadow: '0 22px 52px rgba(7,18,40,0.26), inset 0 0 32px rgba(116,190,255,0.05)',
}

const actionCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
}

const actionCardIcon: CSSProperties = {
  width: '66px',
  height: '66px',
  borderRadius: '20px',
  display: 'grid',
  placeItems: 'center',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), var(--shadow-soft)',
  flexShrink: 0,
  transition: 'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
}

const actionCardIconBlue: CSSProperties = {
  background: 'color-mix(in srgb, var(--brand-blue-2) 14%, var(--shell-chip-bg) 86%)',
  color: 'var(--foreground-strong)',
}

const actionCardIconGreen: CSSProperties = {
  background: 'color-mix(in srgb, var(--brand-lime) 14%, var(--shell-chip-bg) 86%)',
  color: 'var(--foreground-strong)',
}

const actionCardIconHover: CSSProperties = {
  transform: 'scale(1.04)',
  borderColor: 'color-mix(in srgb, var(--brand-blue-2) 30%, var(--shell-panel-border) 70%)',
}

const actionBody: CSSProperties = {
  display: 'grid',
  gap: '10px',
  minWidth: 0,
}

const actionEyebrow: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
}

const actionTitle: CSSProperties = {
  fontSize: '27px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: 0,
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const actionText: CSSProperties = {
  fontSize: '14px',
  lineHeight: 1.7,
  color: 'var(--foreground)',
  overflowWrap: 'anywhere',
}

const actionFooterRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  minWidth: 0,
  flexWrap: 'wrap',
  marginTop: 'auto',
}

const actionFooterCtaBlue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '13px',
  fontWeight: 800,
}

const actionFooterCtaGreen: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '13px',
  fontWeight: 800,
}

const actionFooterArrow: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: '18px',
  fontWeight: 800,
}
