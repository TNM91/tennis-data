'use client'

import Link from 'next/link'
import { CSSProperties, ReactNode, useEffect, useState } from 'react'
import SiteShell from '@/app/components/site-shell'

const FEATURE_CARDS = [
  {
    href: '/players',
    eyebrow: 'Discover',
    title: 'Players',
    text: 'Search player profiles, ratings, and performance context across the platform.',
    accent: 'blue' as const,
    icon: 'player',
  },
  {
    href: '/rankings',
    eyebrow: 'Track',
    title: 'Rankings',
    text: 'See leaderboard movement, compare tiers, and monitor top performers.',
    accent: 'green' as const,
    icon: 'chart',
  },
  {
    href: '/leagues',
    eyebrow: 'Browse',
    title: 'Leagues',
    text: 'Navigate leagues, teams, and seasonal structure with better context.',
    accent: 'blue' as const,
    icon: 'trophy',
  },
  {
    href: '/matchup',
    eyebrow: 'Prepare',
    title: 'Matchups',
    text: 'Run quick public matchup analysis and compare projected edges.',
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
    href: '/players',
    cta: 'Open players',
  },
  {
    title: 'Scan the field first',
    text: 'Use rankings when you want a wider leaderboard view before drilling into a specific player, team, or flight.',
    href: '/rankings',
    cta: 'View rankings',
  },
  {
    title: 'Prepare a comparison',
    text: 'Jump into matchup prep once you have two players or doubles teams in mind and want a quick prediction readout.',
    href: '/matchup',
    cta: 'Compare now',
  },
]

export default function ExplorePage() {
  const [screenWidth, setScreenWidth] = useState(1280)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  const isTablet = screenWidth < 1080
  const isMobile = screenWidth < 820
  const isSmallMobile = screenWidth < 560

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const dynamicHeroWrap: CSSProperties = {
    ...heroWrap,
    padding: isMobile ? '18px 16px 24px' : '14px 22px 28px',
  }

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '28px 18px 24px' : '38px 30px 28px',
  }

  const dynamicHeroContent: CSSProperties = {
    ...heroContent,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.05fr) minmax(360px, 0.95fr)',
    gap: isMobile ? '20px' : '26px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '48px' : '62px',
    lineHeight: isMobile ? 1.04 : 0.98,
    maxWidth: '760px',
  }

  const dynamicHeroText: CSSProperties = {
    ...heroText,
    fontSize: isMobile ? '16px' : '18px',
    maxWidth: '640px',
  }

  const dynamicFeedGrid: CSSProperties = {
    ...feedGrid,
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
    gap: isMobile ? '12px' : '14px',
  }

  const dynamicActionGrid: CSSProperties = {
    ...actionGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(4, minmax(220px, 1fr))',
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

          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <div style={eyebrow}>Explore the tennis landscape</div>

              <h1 style={dynamicHeroTitle}>
                Public discovery for players, rankings, leagues, teams, and matchups.
              </h1>

              <p style={dynamicHeroText}>
                This is the open layer of TA-IQ. Browse player intelligence, monitor
                movement, explore leagues, and jump into matchup prep without friction.
              </p>

              <div style={explorePills}>
                <span style={pillBlue}>Players</span>
                <span style={pillBlue}>Rankings</span>
                <span style={pillGreen}>Leagues</span>
                <span style={pillGreen}>Matchups</span>
              </div>
            </div>

            <div style={featurePanel}>
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
                The public side is strongest when you move from broad discovery into a focused profile
                or comparison. These are the fastest starting points.
              </p>
            </div>

            <div style={dynamicGuideGrid}>
              {DISCOVERY_GUIDES.map((guide) => (
                <Link key={guide.href} href={guide.href} style={guideCard}>
                  <div style={guideCardTitle}>{guide.title}</div>
                  <div style={guideCardText}>{guide.text}</div>
                  <div style={guideCardCta}>{guide.cta} -&gt;</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}

function getCardIcon(icon: string) {
  if (icon === 'player') return <PlayerIcon />
  if (icon === 'chart') return <ChartIcon />
  if (icon === 'trophy') return <TrophyIcon />
  return <MatchupIcon />
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
        <span style={actionFooterArrow}>→</span>
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
  background: `
    linear-gradient(180deg, rgba(26, 54, 104, 0.52) 0%, rgba(17, 36, 72, 0.72) 22%, rgba(12, 27, 52, 0.82) 100%)
  `,
  border: '1px solid rgba(116,190,255,0.22)',
  boxShadow:
    '0 26px 80px rgba(7,18,42,0.24), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 0 80px rgba(88,170,255,0.06)',
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
  color: '#d6e9ff',
  background: 'rgba(37,91,227,0.18)',
  border: '1px solid rgba(116,190,255,0.22)',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const heroTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontWeight: 900,
  letterSpacing: '-0.05em',
}

const heroText: CSSProperties = {
  margin: 0,
  color: 'rgba(224,236,249,0.86)',
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

const featurePanel: CSSProperties = {
  borderRadius: '24px',
  background:
    'linear-gradient(180deg, rgba(68, 132, 229, 0.20) 0%, rgba(40, 83, 158, 0.18) 28%, rgba(16, 36, 70, 0.72) 100%)',
  border: '1px solid rgba(116,190,255,0.24)',
  boxShadow:
    '0 18px 44px rgba(9,25,54,0.16), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 40px rgba(116,190,255,0.05)',
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
  color: '#f6fbff',
  fontSize: '16px',
  fontWeight: 800,
  letterSpacing: '-0.02em',
}

const featurePanelHint: CSSProperties = {
  color: 'rgba(204,220,241,0.76)',
  fontSize: '13px',
  fontWeight: 700,
}

const feedGrid: CSSProperties = {
  display: 'grid',
}

const feedCard: CSSProperties = {
  borderRadius: '20px',
  padding: '16px 15px',
  background: 'linear-gradient(180deg, rgba(22,46,88,0.74) 0%, rgba(13,27,52,0.84) 100%)',
  border: '1px solid rgba(116,190,255,0.16)',
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
  color: '#f8fbff',
  fontSize: '18px',
  fontWeight: 800,
  letterSpacing: '-0.02em',
  marginBottom: '8px',
}

const feedText: CSSProperties = {
  color: 'rgba(224,236,249,0.78)',
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
  color: '#eff6ff',
  background:
    'linear-gradient(180deg, rgba(26,48,90,0.88) 0%, rgba(15,30,57,0.94) 100%)',
  border: '1px solid rgba(116,190,255,0.16)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.18), inset 0 1px 0 rgba(255,255,255,0.03)',
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
  color: 'rgba(188,208,232,0.8)',
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
  color: '#f8fbff',
}

const actionText: CSSProperties = {
  fontSize: '14px',
  lineHeight: 1.7,
  color: 'rgba(215,229,247,0.78)',
}

const actionFooterRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 'auto',
}

const actionFooterCtaBlue: CSSProperties = {
  color: '#d5e8ff',
  fontSize: '13px',
  fontWeight: 800,
}

const actionFooterCtaGreen: CSSProperties = {
  color: '#e7ffd0',
  fontSize: '13px',
  fontWeight: 800,
}

const actionFooterArrow: CSSProperties = {
  color: 'rgba(216,230,246,0.78)',
  fontSize: '18px',
  fontWeight: 800,
}

const iconSvgStyle: CSSProperties = {
  width: '24px',
  height: '24px',
  display: 'block',
}
