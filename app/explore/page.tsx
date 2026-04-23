'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CSSProperties, ReactNode, useState } from 'react'
import SiteShell from '@/app/components/site-shell'
import AdsenseSlot from '@/app/components/adsense-slot'
import { useTheme } from '@/app/components/theme-provider'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const FEATURE_CARDS = [
  {
    href: '/explore/players',
    eyebrow: 'Discover',
    title: 'Players',
    text: 'Search player profiles, ratings, and performance context across the platform.',
    accent: 'blue' as const,
    icon: 'player',
  },
  {
    href: '/explore/rankings',
    eyebrow: 'Track',
    title: 'Rankings',
    text: 'See leaderboard movement, compare tiers, and monitor top performers.',
    accent: 'green' as const,
    icon: 'chart',
  },
  {
    href: '/explore/leagues',
    eyebrow: 'Browse',
    title: 'Leagues',
    text: 'Separate official USTA context from TIQ competition surfaces without losing discovery speed.',
    accent: 'blue' as const,
    icon: 'trophy',
  },
  {
    href: '/explore/matchups',
    eyebrow: 'Prepare',
    title: 'Matchups',
    text: 'Run quick public matchup analysis and compare projected edges before the week gets tactical.',
    accent: 'green' as const,
    icon: 'matchup',
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

const DISCOVERY_GUIDES = [
  {
    title: 'Start with a player',
    text: 'Open the player directory when you already know a name and want profile context, rating movement, and recent match history.',
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
    text: 'Jump into matchup prep once you have two players or doubles teams in mind and want a quick prediction readout.',
    href: '/explore/matchups',
    cta: 'Compare now',
  },
]

const DISCOVERY_SIGNALS = [
  {
    label: 'Public layer',
    value: 'Explore',
    text: 'This is the fastest way into discovery when you are not yet in execution mode.',
  },
  {
    label: 'Official truth',
    value: 'USTA',
    text: 'Use official-style league and rating context to understand status, movement, and comparison.',
  },
  {
    label: 'Internal edge',
    value: 'TIQ',
    text: 'Move from browse to strategy without blending TIQ decision support into official USTA meaning.',
  },
]

const EXPLORE_INLINE_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_EXPLORE_INLINE || null

export default function ExplorePage() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const { theme } = useTheme()
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const heroArtworkSrc = theme === 'dark'
    ? '/df190aef-4a8e-4587-bce8-7e2e22655646.png'
    : '/151c73b4-3ea5-4ef5-82df-470da3b99f27.png'

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
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 0.98fr) minmax(420px, 1.02fr)',
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

  const dynamicSignalGrid: CSSProperties = {
    ...signalGrid,
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }

  const dynamicFeedGrid: CSSProperties = {
    ...feedGrid,
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
    gap: isMobile ? '12px' : '14px',
  }

  const dynamicArtPanelStyle: CSSProperties = {
    ...featurePanel,
    position: 'relative',
    minHeight: isSmallMobile ? '240px' : isMobile ? '300px' : '420px',
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
    left: isMobile ? '16px' : '20px',
    right: isMobile ? '16px' : '20px',
    bottom: isMobile ? '16px' : '20px',
    display: 'grid',
    gap: '10px',
    zIndex: 2,
  }

  const dynamicActionGrid: CSSProperties = {
    ...actionGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(220px, 1fr))',
    gap: isMobile ? '14px' : '16px',
  }

  const dynamicGuideGrid: CSSProperties = {
    ...guideGrid,
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }

  return (
    <SiteShell active="explore">
      <section style={dynamicHeroWrap}>
        <div style={dynamicHeroShell}>
          <div style={heroNoise} />
          <div style={heroMesh} />

          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <div style={eyebrow}>Public discovery</div>

              <h1 style={dynamicHeroTitle}>
                Explore the tennis landscape with cleaner separation between status, competition, and strategy.
              </h1>

              <p style={dynamicHeroText}>
                Browse players, teams, rankings, matchups, and league context from one premium public layer.
                Start with broad discovery, then move into USTA truth or TIQ competition surfaces without losing clarity.
              </p>

              <div style={explorePills}>
                <span style={pillBlue}>Players</span>
                <span style={pillBlue}>Teams</span>
                <span style={pillGreen}>USTA Leagues</span>
                <span style={pillGreen}>TIQ Leagues</span>
                <span style={pillGreen}>Matchups</span>
              </div>
            </div>

            <div style={dynamicArtPanelStyle}>
              <Image
                src={heroArtworkSrc}
                alt="TenAceIQ explore concept art"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 44vw"
                style={{
                  objectFit: 'cover',
                  objectPosition: isTablet ? 'center center' : '72% center',
                  opacity: theme === 'dark' ? 0.94 : 0.82,
                }}
              />
              <div style={dynamicArtMaskStyle} />

              <div style={dynamicArtOverlayStyle}>
                <div style={featurePanelHeader}>
                  <div style={featurePanelLabel}>Global activity</div>
                  <div style={featurePanelHint}>Public feed</div>
                </div>

                <div style={dynamicFeedGrid}>
                  {GLOBAL_FEED.map((item) => (
                    <div key={item.title} style={feedCard}>
                      <div style={feedTag}>{item.tag}</div>
                      <div style={feedTitle}>{item.title}</div>
                      <div style={feedText}>{item.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={dynamicSignalGrid}>
            {DISCOVERY_SIGNALS.map((signal) => (
              <DiscoverySignal key={signal.label} label={signal.label} value={signal.value} text={signal.text} />
            ))}
          </div>

          <div style={dynamicActionGrid}>
            {FEATURE_CARDS.map((card) => (
              <ActionCard
                key={card.href}
                href={card.href}
                eyebrow={card.eyebrow}
                title={card.title}
                text={card.text}
                icon={getCardIcon(card.icon)}
                hovered={hoveredCard === card.href}
                onEnter={() => setHoveredCard(card.href)}
                onLeave={() => setHoveredCard(null)}
                accent={card.accent}
              />
            ))}
          </div>

          <div style={guidePanel}>
            <div style={guideHeader}>
              <div>
                <div style={guideEyebrow}>Where to start</div>
                <h2 style={guideTitle}>Choose the shortest path for the question you have.</h2>
              </div>
              <p style={guideIntro}>
                Explore works best when the first click is obvious. These entry points keep the public side clean,
                efficient, and mobile-friendly before you move deeper into the product.
              </p>
            </div>

            <div style={dynamicGuideGrid}>
              {DISCOVERY_GUIDES.map((guide) => (
                <GuideCard key={guide.href} href={guide.href} title={guide.title} text={guide.text} cta={guide.cta} />
              ))}
            </div>
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
        borderColor: hovered ? 'rgba(116,190,255,0.28)' : 'rgba(116,190,255,0.14)',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered
          ? '0 22px 50px rgba(7,18,40,0.24), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 16px 36px rgba(7,18,40,0.16), inset 0 1px 0 rgba(255,255,255,0.03)',
        transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
      }}
    >
      <div style={guideCardTitle}>{title}</div>
      <div style={guideCardText}>{text}</div>
      <div
        style={{
          ...guideCardCta,
          color: hovered ? '#9be11d' : '#d5e8ff',
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
        <span style={ctaStyle}>Open</span>
        <span style={actionFooterArrow}>{'->'}</span>
      </div>
    </Link>
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
    radial-gradient(circle at 12% 0%, rgba(116,190,255,0.26), transparent 28%),
    radial-gradient(circle at 72% 8%, rgba(88,170,255,0.18), transparent 24%),
    radial-gradient(circle at 100% 0%, rgba(155,225,29,0.10), transparent 26%),
    linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 26%)
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
  color: 'var(--foreground)',
  background: 'rgba(37,91,227,0.12)',
  border: '1px solid var(--card-border-soft)',
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
  color: '#dcebff',
  background: 'rgba(37,91,227,0.16)',
  border: '1px solid rgba(74,163,255,0.18)',
}

const pillGreen: CSSProperties = {
  ...pillBase,
  color: '#e7ffd0',
  background: 'rgba(155,225,29,0.14)',
  border: '1px solid rgba(155,225,29,0.24)',
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
  color: '#e7ffd0',
  background: 'rgba(155,225,29,0.14)',
  border: '1px solid rgba(155,225,29,0.24)',
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
  background:
    'linear-gradient(180deg, rgba(20,40,76,0.88) 0%, rgba(12,26,49,0.94) 100%)',
  border: '1px solid rgba(116,190,255,0.18)',
  boxShadow: '0 20px 48px rgba(7,18,40,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
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
  color: '#8fb7ff',
  fontWeight: 800,
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  marginBottom: '8px',
}

const guideTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontSize: '28px',
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const guideIntro: CSSProperties = {
  margin: 0,
  maxWidth: '520px',
  color: 'rgba(215,229,247,0.78)',
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
  background: 'linear-gradient(180deg, rgba(26,48,90,0.88) 0%, rgba(15,30,57,0.94) 100%)',
  border: '1px solid rgba(116,190,255,0.14)',
  boxShadow: '0 16px 36px rgba(7,18,40,0.16), inset 0 1px 0 rgba(255,255,255,0.03)',
}

const guideCardTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '22px',
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const guideCardText: CSSProperties = {
  color: 'rgba(215,229,247,0.78)',
  fontSize: '14px',
  lineHeight: 1.7,
}

const guideCardCta: CSSProperties = {
  marginTop: 'auto',
  color: '#d5e8ff',
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
  transition: 'transform 180ms ease',
}

const actionCardIconBlue: CSSProperties = {
  background: 'rgba(37,91,227,0.16)',
  color: '#cfe4ff',
}

const actionCardIconGreen: CSSProperties = {
  background: 'rgba(155,225,29,0.14)',
  color: '#efffd5',
}

const actionCardIconHover: CSSProperties = {
  transform: 'scale(1.04)',
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
}
