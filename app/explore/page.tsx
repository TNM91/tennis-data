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

const FIND_COMMAND_STEPS: Array<{
  href: string
  label: string
  title: string
  body: string
  icon: TiqFeatureIconName
}> = [
  {
    href: '/explore/search',
    label: 'Search',
    title: 'Type what you know',
    body: 'Names, teams, leagues, or flights.',
    icon: 'opponentScouting',
  },
  {
    href: '/explore/players',
    label: 'Players',
    title: 'Open a player record',
    body: 'Ratings, teams, and match context.',
    icon: 'playerRatings',
  },
  {
    href: '/explore/teams',
    label: 'Teams',
    title: 'Check the team shape',
    body: 'Roster, league, and recent results.',
    icon: 'teamRankings',
  },
  {
    href: '/explore/leagues',
    label: 'Leagues',
    title: 'See the competition layer',
    body: 'USTA-style history and TIQ seasons.',
    icon: 'reports',
  },
  {
    href: '/explore/rankings',
    label: 'Rankings',
    title: 'Scan the field',
    body: 'Start broad, then drill in.',
    icon: 'matchupAnalysis',
  },
]

const EXPLORE_INLINE_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_EXPLORE_INLINE || null

export default function ExplorePage() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const { access, authResolved } = useProductAccess()
  const shouldShowAds = authResolved && shouldShowSponsoredPlacements(access)

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
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: isMobile ? '18px' : '22px',
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

  const dynamicActionGrid: CSSProperties = {
    ...actionGrid,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
    gap: isMobile ? '14px' : '16px',
  }

  const dynamicDiscoveryPathGrid: CSSProperties = {
    ...discoveryPathGrid,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  }

  const dynamicDiscoveryPathHeader: CSSProperties = {
    ...discoveryPathHeader,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 0.72fr) minmax(min(100%, 260px), 0.55fr)',
  }

  return (
    <SiteShell active="explore">
      <section style={dynamicHeroWrap}>
        <div style={dynamicHeroShell}>
          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <div style={eyebrow}>Free exploration</div>

              <h1 style={dynamicHeroTitle}>
                More Tennis. Less Chaos.
              </h1>

              <p style={dynamicHeroText}>
                Start with a player, team, league, or ranking. Get oriented fast, then open the tool that helps you play, captain, or run the season.
              </p>

              <div style={explorePills}>
                <span style={pillBlue}>Players</span>
                <span style={pillBlue}>Teams</span>
                <span style={pillGreen}>Leagues</span>
                <span style={pillGreen}>Rankings</span>
              </div>
            </div>

          </div>

          <FindCommandPanel />

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

function FindCommandPanel() {
  return (
    <section style={findCommandPanel} aria-label="Find mode paths">
      <div style={findCommandHeader}>
        <TiqFeatureIcon name="opponentScouting" size="md" variant="surface" />
        <div style={findCommandCopy}>
          <div style={findCommandEyebrow}>Find mode</div>
          <h2 style={findCommandTitle}>Everything starts with one tennis clue.</h2>
          <p style={findCommandText}>
            Search first, then move into the right public record. Upgrade only when saving, comparing, or acting on the context makes life easier.
          </p>
        </div>
        <Link href="/pricing#free" style={findCommandPill}>Free to start</Link>
      </div>

      <div style={findCommandGrid}>
        {FIND_COMMAND_STEPS.map((step, index) => (
          <Link key={step.href} href={step.href} style={findCommandCard}>
            <span style={findCommandNumber}>{index + 1}</span>
            <TiqFeatureIcon name={step.icon} size="sm" variant="ghost" />
            <span style={findCommandCardCopy}>
              <span style={findCommandLabel}>{step.label}</span>
              <strong style={findCommandCardTitle}>{step.title}</strong>
              <span style={findCommandCardText}>{step.body}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
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

const heroWrap: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  minWidth: 0,
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
  maxWidth: '100%',
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
  overflowWrap: 'anywhere',
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
  overflowWrap: 'anywhere',
}

const explorePills: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  minWidth: 0,
  marginTop: '4px',
}

const pillBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  minWidth: 0,
  minHeight: '32px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.04em',
  whiteSpace: 'normal',
  textAlign: 'center',
  overflowWrap: 'anywhere',
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

const findCommandPanel: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: '14px',
  marginBottom: '18px',
  padding: '16px',
  borderRadius: '22px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const findCommandHeader: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '48px minmax(0, 1fr) minmax(0, auto)',
  gap: '12px',
  alignItems: 'center',
  minWidth: 0,
}

const findCommandCopy: CSSProperties = {
  display: 'grid',
  gap: '4px',
  minWidth: 0,
}

const findCommandEyebrow: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '10px',
  fontWeight: 950,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const findCommandTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.2rem, 2vw, 1.6rem)',
  lineHeight: 1.05,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const findCommandText: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const findCommandPill: CSSProperties = {
  justifySelf: 'end',
  minHeight: 34,
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 10%, var(--shell-chip-bg) 90%)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 900,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}

const findCommandGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: '10px',
  minWidth: 0,
}

const findCommandCard: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28px 32px minmax(0, 1fr)',
  gap: '9px',
  alignItems: 'center',
  minHeight: 74,
  padding: '10px',
  borderRadius: '15px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  textDecoration: 'none',
  minWidth: 0,
}

const findCommandNumber: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  background: 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-panel-bg) 88%)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  fontWeight: 950,
}

const findCommandCardCopy: CSSProperties = {
  display: 'grid',
  gap: '2px',
  minWidth: 0,
}

const findCommandLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '10px',
  fontWeight: 900,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

const findCommandCardTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
}

const findCommandCardText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '11px',
  lineHeight: 1.3,
  fontWeight: 750,
  overflowWrap: 'anywhere',
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
  minWidth: 0,
  alignItems: 'end',
}

const discoveryPathKicker: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const discoveryPathTitle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: '28px',
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const discoveryPathCopy: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.6,
  fontWeight: 600,
  overflowWrap: 'anywhere',
}

const discoveryPathGrid: CSSProperties = {
  display: 'grid',
  gap: '12px',
  minWidth: 0,
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
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'none',
  minWidth: 0,
  boxSizing: 'border-box',
}

const discoveryPathLabel: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
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
  overflowWrap: 'anywhere',
}

const actionGrid: CSSProperties = {
  display: 'grid',
  position: 'relative',
  zIndex: 1,
  minWidth: 0,
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
  background: 'var(--shell-panel-bg)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
  transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const actionCardHover: CSSProperties = {
  transform: 'translateY(-4px)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 30%, var(--shell-panel-border) 70%)',
  boxShadow: 'var(--shadow-card)',
}

const actionCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  minWidth: 0,
}

const actionCardIcon: CSSProperties = {
  width: '66px',
  height: '66px',
  borderRadius: '20px',
  display: 'grid',
  placeItems: 'center',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
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
  overflowWrap: 'anywhere',
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
  overflowWrap: 'anywhere',
}

const actionFooterCtaGreen: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '13px',
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const actionFooterArrow: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: '18px',
  fontWeight: 800,
  flex: '0 0 auto',
}
