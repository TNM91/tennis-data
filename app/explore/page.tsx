'use client'

import Link from 'next/link'
import { CSSProperties, ReactNode, useState } from 'react'
import SiteShell from '@/app/components/site-shell'
import AdsenseSlot from '@/app/components/adsense-slot'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

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
    text: 'Browse USTA and TIQ league pages from one place.',
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

const GLOBAL_FEED = [
  {
    title: 'Biggest Movers',
    body: 'Track the players making the largest jumps in recent rating and ranking updates.',
    tag: 'Trending',
  },
  {
    title: 'League Activity',
    body: 'See which leagues and teams have posted recent results and new season movement.',
    tag: 'Live',
  },
  {
    title: 'Fresh Match Results',
    body: 'Follow newly posted results and shifts in competitive balance across flights.',
    tag: 'New',
  },
]

const DISCOVERY_STREAM = [
  {
    title: 'Players near your level',
    detail: 'Search by name, area, or flight to narrow the field before you compare.',
    badge: 'Players',
    accent: 'blue' as const,
  },
  {
    title: 'USTA leagues',
    detail: 'Find official league, flight, team, and match pages.',
    badge: 'USTA',
    accent: 'green' as const,
  },
  {
    title: 'TIQ leagues',
    detail: 'Explore TenAceIQ leagues for teams, rosters, schedules, and results.',
    badge: 'TIQ',
    accent: 'green' as const,
  },
]

const DISCOVERY_CHANNELS = [
  {
    title: 'Search first',
    text: 'Player names, teams, flights, and areas route into the right discovery surface fast.',
  },
  {
    title: 'Compare second',
    text: 'Use rankings and My Lab once you know who or what you want to pressure-test.',
  },
]

const DISCOVERY_GUIDES = [
  {
    title: 'Start with a player',
    text: 'Open the player directory when you know a name and want teams, ratings, and recent match history.',
    href: '/explore/players',
    cta: 'Open players',
  },
  {
    title: 'Scan the field first',
    text: 'Use rankings when you want a wider leaderboard view before drilling into a specific player, team, or flight.',
    href: '/explore/rankings',
    cta: 'View rankings',
  },
  {
    title: 'Prepare a comparison',
    text: 'Use Matchup when you want to compare players before you play.',
    href: '/matchup',
    cta: 'Open Matchup',
  },
]

const DISCOVERY_SIGNALS = [
  {
    label: 'Start here',
    value: 'Explore',
    text: 'Search players, teams, rankings, and leagues from one place.',
  },
  {
    label: 'Official truth',
    value: 'USTA',
    text: 'Use USTA pages for official leagues, flights, teams, and match results.',
  },
  {
    label: 'Player tools',
    value: 'Player',
    text: 'Use Matchup and My Lab when you want smarter prep before you play.',
  },
]

const EXPLORE_INLINE_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_EXPLORE_INLINE || null

export default function ExplorePage() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()

  const dynamicHeroWrap: CSSProperties = {
    ...heroWrap,
    padding: isMobile ? '14px 14px 24px' : '16px 16px 26px',
  }

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isSmallMobile ? '24px 18px 22px' : isMobile ? '28px 20px 24px' : '38px 30px 30px',
    borderRadius: isMobile ? '28px' : '30px',
    background: 'var(--shell-panel-bg-strong)',
    border: '1px solid var(--shell-panel-border)',
    boxShadow: 'var(--shadow-card)',
  }

  const dynamicHeroContent: CSSProperties = {
    ...heroContent,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1fr) minmax(0, 0.94fr)',
    gap: isMobile ? '20px' : '26px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '38px' : isMobile ? '50px' : '62px',
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
    minHeight: isSmallMobile ? '320px' : isMobile ? '360px' : isTablet ? '420px' : '440px',
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
    position: 'absolute',
    top: isMobile ? '16px' : '20px',
    left: isMobile ? '16px' : '20px',
    right: isMobile ? '16px' : '20px',
    bottom: isMobile ? '16px' : '20px',
    display: 'grid',
    gap: '12px',
    alignContent: 'start',
    zIndex: 2,
  }

  const dynamicActionGrid: CSSProperties = {
    ...actionGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(220px, 1fr))',
    gap: isMobile ? '14px' : '16px',
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
      <div style={{ marginTop: 12 }}>
        <AdsenseSlot slot={EXPLORE_INLINE_AD_SLOT} label="Sponsored" minHeight={250} />
      </div>
    </SiteShell>
  )
}

function DiscoverySignal({
  label,
  value,
  text,
}: {
  label: string
  value: string
  text: string
}) {
  return (
    <div style={signalCard}>
      <div style={signalLabel}>{label}</div>
      <div style={signalValue}>{value}</div>
      <div style={signalText}>{text}</div>
    </div>
  )
}

function getCardIcon(icon: string) {
  if (icon === 'player') return <PlayerIcon />
  if (icon === 'team') return <TeamIcon />
  if (icon === 'chart') return <ChartIcon />
  if (icon === 'trophy') return <TrophyIcon />
  return <MatchupIcon />
}

function GuideCard({ href, title, text, cta }: { href: string; title: string; text: string; cta: string }) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...guideCard,
        border: hovered
          ? '1px solid color-mix(in srgb, var(--brand-blue-2) 28%, var(--shell-panel-border) 72%)'
          : '1px solid var(--shell-panel-border)',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? 'var(--shadow-card)' : 'var(--shadow-soft)',
        transition: 'transform 160ms ease, box-shadow 160ms ease, border 160ms ease',
      }}
    >
      <div style={guideCardTitle}>{title}</div>
      <div style={guideCardText}>{text}</div>
      <div
        style={{
          ...guideCardCta,
          color: hovered ? 'var(--brand-lime)' : 'var(--foreground)',
          transition: 'color 160ms ease',
        }}
      >
        {cta} {'->'}
      </div>
    </Link>
  )
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

function TeamIcon() {
  return (
    <IconBase>
      <circle cx="8" cy="8" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="8" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.5 18c.9-2.6 2.2-3.9 3.5-3.9s2.6 1.3 3.5 3.9M12.5 18c.9-2.6 2.2-3.9 3.5-3.9s2.6 1.3 3.5 3.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </IconBase>
  )
}

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" style={iconSvgStyle} aria-hidden="true">
      {children}
    </svg>
  )
}

function PlayerIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M6.5 19c1.3-3.1 3.4-4.7 5.5-4.7S16.2 15.9 17.5 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </IconBase>
  )
}

function ChartIcon() {
  return (
    <IconBase>
      <path
        d="M5 18.5h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7.5 15V11M12 15V8M16.5 15V5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </IconBase>
  )
}

function TrophyIcon() {
  return (
    <IconBase>
      <path
        d="M8 5h8v2.3c0 2.5-1.8 4.7-4 5.2-2.2-.5-4-2.7-4-5.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 7H5.8c0 2 1 3.4 2.8 3.9M16 7h2.2c0 2-1 3.4-2.8 3.9M12 12.5v3.2M9.2 19h5.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  )
}

function MatchupIcon() {
  return (
    <IconBase>
      <path
        d="M4 17.5V6.8c0-.7.6-1.3 1.3-1.3H12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M20 6.5v10.7c0 .7-.6 1.3-1.3 1.3H12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M9 8.8h5.5M9 12h6.6M9 15.2h4.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </IconBase>
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
  alignItems: 'stretch',
  marginBottom: '20px',
  position: 'relative',
  zIndex: 1,
}

const heroLeft: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '18px',
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
  letterSpacing: '-0.05em',
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

const signalGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
  marginBottom: '18px',
  position: 'relative',
  zIndex: 1,
}

const signalCard: CSSProperties = {
  display: 'grid',
  gap: '8px',
  padding: '18px',
  borderRadius: '22px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
}

const signalLabel: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const signalValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '24px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const signalText: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: '13px',
  lineHeight: 1.65,
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
  marginBottom: '14px',
}

const featurePanelLabel: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  fontWeight: 800,
  letterSpacing: '-0.02em',
}

const featurePanelHint: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: '13px',
  fontWeight: 700,
}

const startStepStack: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const startStepCard: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: '12px',
  alignItems: 'start',
  padding: '16px',
  borderRadius: '20px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
}

const startStepNumber: CSSProperties = {
  width: 34,
  height: 34,
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
  marginTop: '5px',
  color: 'var(--foreground-strong)',
  fontSize: '18px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const startStepText: CSSProperties = {
  marginTop: '7px',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.6,
}

const feedGrid: CSSProperties = {
  display: 'grid',
}

const feedCard: CSSProperties = {
  borderRadius: '20px',
  padding: '16px 15px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  minHeight: '150px',
}

const feedTag: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  marginBottom: '10px',
  color: 'var(--foreground-strong)',
  background: 'color-mix(in srgb, var(--brand-lime) 11%, var(--shell-chip-bg) 89%)',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 24%, var(--shell-panel-border) 76%)',
  borderRadius: '999px',
  padding: '5px 10px',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const feedTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '18px',
  fontWeight: 800,
  letterSpacing: '-0.02em',
  marginBottom: '8px',
}

const feedText: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: '14px',
  lineHeight: 1.65,
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

const discoveryStreamStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '12px',
}

const discoveryStreamCard: CSSProperties = {
  borderRadius: '20px',
  padding: '16px 16px 15px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  boxShadow: 'var(--shadow-soft)',
  display: 'grid',
  gap: '10px',
}

const discoveryStreamTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  fontWeight: 800,
  lineHeight: 1.25,
}

const discoveryStreamText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.65,
}

const discoveryChannelGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '12px',
}

const discoveryChannelCard: CSSProperties = {
  borderRadius: '20px',
  padding: '16px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
  minHeight: '112px',
  alignContent: 'start',
}

const discoveryChannelTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '14px',
  fontWeight: 800,
  lineHeight: 1.3,
}

const discoveryChannelText: CSSProperties = {
  marginTop: '8px',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.65,
}

const actionGrid: CSSProperties = {
  display: 'grid',
  position: 'relative',
  zIndex: 1,
}

const guidePanel: CSSProperties = {
  marginTop: '20px',
  position: 'relative',
  zIndex: 1,
  borderRadius: '26px',
  padding: '22px',
  background: 'var(--shell-panel-bg)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-card)',
}

const guideHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  flexWrap: 'wrap',
  marginBottom: '16px',
}

const guideEyebrow: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontWeight: 800,
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  marginBottom: '8px',
}

const guideTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: '28px',
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const guideIntro: CSSProperties = {
  margin: 0,
  maxWidth: '520px',
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.7,
}

const guideGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
}

const guideCard: CSSProperties = {
  display: 'grid',
  gap: '10px',
  minHeight: '180px',
  padding: '18px',
  borderRadius: '22px',
  textDecoration: 'none',
  background: 'var(--shell-panel-bg)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
}

const guideCardTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '22px',
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const guideCardText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.7,
}

const guideCardCta: CSSProperties = {
  marginTop: 'auto',
  color: 'var(--foreground)',
  fontSize: '13px',
  fontWeight: 800,
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
  width: '58px',
  height: '58px',
  borderRadius: '18px',
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
  letterSpacing: '-0.04em',
  color: 'var(--foreground-strong)',
}

const actionText: CSSProperties = {
  fontSize: '14px',
  lineHeight: 1.7,
  color: 'var(--foreground)',
}

const actionFooterRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
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

const iconSvgStyle: CSSProperties = {
  width: '24px',
  height: '24px',
  display: 'block',
  color: 'currentColor',
  flexShrink: 0,
  overflow: 'visible',
}
