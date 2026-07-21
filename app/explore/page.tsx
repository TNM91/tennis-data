'use client'

import Link from 'next/link'
import { CSSProperties } from 'react'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import AdsenseSlot from '@/app/components/adsense-slot'
import TrackedProductLink, { type ProductLinkEvent } from '@/app/components/tracked-product-link'
import UniversalSearch from '@/app/components/universal-search'
import { shouldShowSponsoredPlacements } from '@/lib/access-model'
import { DATA_ASSIST_STORY, getMembershipTier } from '@/lib/product-story'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'
import { useProductAccess } from '@/lib/use-product-access'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'

const FIND_COMMAND_STEPS: Array<{
  href: string
  label: string
  title: string
  body: string
  icon: TiqFeatureIconName
  event: ProductLinkEvent
}> = [
  {
    href: '/explore/players',
    label: 'Find a player',
    title: 'Open the profile',
    body: 'See ratings, teams, and recent public tennis context.',
    icon: 'playerRatings',
    event: { eventName: 'search_result_clicked', surface: 'public_site', metadata: { location: 'explore_path', job: 'find_player' } },
  },
  {
    href: '/explore/teams',
    label: 'Browse teams',
    title: 'Check the roster',
    body: 'Review team, flight, league, and opponent context.',
    icon: 'lineupBuilder',
    event: { eventName: 'team_search_submitted', surface: 'teams', metadata: { location: 'explore_path', job: 'browse_teams' } },
  },
  {
    href: '/explore/leagues',
    label: 'Check standings',
    title: 'Open the league table',
    body: 'Find schedules, results, and where the season stands.',
    icon: 'schedule',
    event: { eventName: 'league_search_submitted', surface: 'leagues', metadata: { location: 'explore_path', job: 'check_standings' } },
  },
  {
    href: '/explore/rankings',
    label: 'Check rankings',
    title: 'Scan the field',
    body: 'Compare rating, area, and player shape before you choose.',
    icon: 'reports',
    event: { eventName: 'search_category_selected', surface: 'public_site', metadata: { location: 'explore_path', job: 'check_rankings' } },
  },
]

const EXPLORE_PRIMARY_COMMAND: {
  href: string
  label: string
  title: string
  body: string
  icon: TiqFeatureIconName
  event: ProductLinkEvent
} = {
  href: '/explore/search',
  label: 'Search first',
  title: 'Start with one tennis question.',
  body: 'Search a player, team, league, city, rating, or court need, then open the clearest public result.',
  icon: 'opponentScouting',
  event: { eventName: 'search_category_selected', surface: 'public_site', metadata: { location: 'explore_primary_command', job: 'search_first' } },
}

const EXPLORE_INLINE_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_EXPLORE_INLINE || null
const FREE_TIER_STORY = getMembershipTier('free')
const PUBLIC_DISCOVERY_PROOF_STEPS: Array<{
  label: string
  title: string
  body: string
  href: string
  event: ProductLinkEvent
}> = [
  {
    label: 'Find first',
    title: FREE_TIER_STORY.shortPromise,
    body: FREE_TIER_STORY.valueProps[0],
    href: '/explore/search',
    event: { eventName: 'search_category_selected', surface: 'public_site', metadata: { location: 'public_discovery_proof', job: 'find_first' } },
  },
  {
    label: 'Public detail',
    title: 'Open reviewed context',
    body: 'Open player, team, league, and ranking pages before you upgrade.',
    href: '/explore/players',
    event: { eventName: 'search_result_clicked', surface: 'public_site', metadata: { location: 'public_discovery_proof', job: 'open_public_detail' } },
  },
  {
    label: DATA_ASSIST_STORY.eyebrow,
    title: DATA_ASSIST_STORY.cta,
    body: DATA_ASSIST_STORY.shortCue,
    href: DATA_ASSIST_STORY.href,
    event: { eventName: 'data_assist_opened', surface: 'data_assist', metadata: { location: 'public_discovery_proof', job: 'improve_context' } },
  },
  {
    label: 'Next tier',
    title: 'Know what unlocks',
    body: 'Pricing explains when My Lab, Coach Hub, Team Hub, League Office, or Full-Court fits the need.',
    href: '/pricing',
    event: { eventName: 'search_category_selected', surface: 'public_site', metadata: { location: 'public_discovery_proof', job: 'compare_tiers' } },
  },
]

export default function ExplorePage() {
  const { isMobile, isSmallMobile, isTablet } = useViewportBreakpoints()
  const { access, authResolved } = useProductAccess()
  const shouldShowAds = authResolved && shouldShowSponsoredPlacements(access)

  const dynamicHeroWrap: CSSProperties = {
    ...heroWrap,
    padding: isMobile ? '6px 0 12px' : '12px 0 36px',
    overflowX: 'clip',
    boxSizing: 'border-box',
  }

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isSmallMobile ? '10px' : isMobile ? '12px' : '24px',
    borderRadius: isMobile ? '16px' : '24px',
    background: 'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(4,10,24,0.9))',
    border: '1px solid rgba(116,190,255,0.15)',
    boxShadow: '0 30px 86px rgba(2, 8, 23, 0.46), inset 0 1px 0 rgba(255,255,255,0.05)',
  }

  const dynamicHeroContent: CSSProperties = {
    ...heroContent,
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: isMobile ? '8px' : '14px',
    marginBottom: isMobile ? '8px' : '14px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '26px' : isMobile ? '30px' : '48px',
    lineHeight: isMobile ? 1.05 : 1,
    maxWidth: '760px',
  }

  const dynamicHeroText: CSSProperties = {
    ...heroText,
    fontSize: isMobile ? '14px' : '17px',
    lineHeight: isMobile ? 1.5 : heroText.lineHeight,
    maxWidth: '640px',
  }

  return (
    <SiteShell active="explore">
      <JsonLd id="explore-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Explore', '/explore')} />
      <section style={dynamicHeroWrap}>
        <div style={dynamicHeroShell}>
          <div aria-hidden="true" style={watermarkStyle} />
          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <h1 style={dynamicHeroTitle}>
                Find players, teams, leagues.
              </h1>

              {!isMobile ? (
                <p style={dynamicHeroText}>
                  Search by name, team, league, city, rating, court, coach, or tournament.
                </p>
              ) : null}
              <UniversalSearch compact />
            </div>

          </div>

          <FindCommandPanel compact={isTablet} mobile={isMobile} />
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

function FindCommandPanel({ compact, mobile }: { compact: boolean; mobile: boolean }) {
  const panelStyle = compact
    ? { ...findCommandPanel, gap: mobile ? '6px' : '10px', marginBottom: 0, padding: mobile ? '7px' : '12px', borderRadius: mobile ? '12px' : '14px' }
    : findCommandPanel
  const workspaceStyle = compact
    ? { ...findCommandWorkspace, gridTemplateColumns: 'minmax(0, 1fr)' }
    : findCommandWorkspace
  const shortcutGridStyle = compact
    ? {
        ...findCommandGrid,
        gridTemplateColumns: mobile
          ? 'repeat(2, minmax(0, 1fr))'
          : 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
        gap: mobile ? '5px' : findCommandGrid.gap,
      }
    : findCommandGrid
  const proofStyle = compact
    ? { ...publicDiscoveryProofStyle, display: 'block', padding: mobile ? '8px' : '12px', borderRadius: '12px' }
    : publicDiscoveryProofStyle
  const proofGridStyle = compact
    ? { ...publicDiscoveryProofGridStyle, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))' }
    : publicDiscoveryProofGridStyle
  const primaryCardStyle = compact
    ? {
        ...findCommandPrimaryCard,
        minHeight: mobile ? 62 : 152,
        gridTemplateRows: mobile ? 'auto auto' : findCommandPrimaryCard.gridTemplateRows,
        gap: mobile ? '4px' : '10px',
        padding: mobile ? '7px' : '12px',
        borderRadius: mobile ? '12px' : '14px',
      }
    : findCommandPrimaryCard
  const primaryTitleStyle = mobile
    ? { ...findCommandPrimaryTitleStyle, fontSize: '0.95rem', lineHeight: 1.06 }
    : findCommandPrimaryTitleStyle
  const primaryCtaStyle = mobile
    ? { ...findCommandPrimaryCtaStyle, padding: '5px 7px', fontSize: '10px' }
    : findCommandPrimaryCtaStyle
  const shortcutCardStyle = mobile
    ? {
        ...findCommandCard,
        gridTemplateColumns: 'minmax(0, 1fr)',
        minHeight: 48,
        padding: '6px',
        gap: '3px',
      }
    : findCommandCard
  const shortcutTitleStyle = mobile
    ? { ...findCommandCardTitle, fontSize: '10px', lineHeight: 1.1 }
    : findCommandCardTitle
  const headerStyle = mobile
    ? compactFindCommandHeader
    : findCommandHeader
  const titleStyle = mobile
    ? compactFindCommandTitle
    : findCommandTitle
  const pillStyle = mobile
    ? compactFindCommandPill
    : findCommandPill
  const proofSummaryStyle = mobile
    ? compactPublicDiscoveryProofSummaryStyle
    : publicDiscoveryProofSummaryStyle
  const proofTitleStyle = mobile
    ? compactPublicDiscoveryProofTitleStyle
    : publicDiscoveryProofTitleStyle
  const proofActionStyle = mobile
    ? compactPublicDiscoveryProofSummaryActionStyle
    : publicDiscoveryProofSummaryActionStyle

  return (
    <section style={panelStyle} aria-label="Explore tennis search tools">
      <div style={headerStyle}>
        <TiqFeatureIcon name="opponentScouting" size="md" variant="surface" />
        <div style={findCommandCopy}>
          <div style={findCommandEyebrow}>Explore</div>
          <h2 style={titleStyle}>Start with one tennis question.</h2>
        </div>
        <Link href="/pricing#free" style={pillStyle}>Free to start</Link>
      </div>

      <div style={workspaceStyle}>
        <TrackedProductLink
          href={EXPLORE_PRIMARY_COMMAND.href}
          className="explore-primary-command"
          style={primaryCardStyle}
          ariaLabel={`${EXPLORE_PRIMARY_COMMAND.label}: ${EXPLORE_PRIMARY_COMMAND.title} ${EXPLORE_PRIMARY_COMMAND.body}`}
          event={EXPLORE_PRIMARY_COMMAND.event}
        >
          {!mobile ? (
            <span style={findCommandPrimaryIconStyle}>
              <TiqFeatureIcon name={EXPLORE_PRIMARY_COMMAND.icon} size="md" variant="surface" />
            </span>
          ) : null}
          <span style={findCommandCardCopy}>
            <span style={findCommandLabel}>{EXPLORE_PRIMARY_COMMAND.label}</span>
            <strong style={primaryTitleStyle}>{EXPLORE_PRIMARY_COMMAND.title}</strong>
            {!mobile ? <span style={findCommandPrimaryBodyStyle}>{EXPLORE_PRIMARY_COMMAND.body}</span> : null}
          </span>
          <span style={primaryCtaStyle}>Open search</span>
        </TrackedProductLink>

        <div style={shortcutGridStyle} aria-label="Explore shortcuts">
          {FIND_COMMAND_STEPS.map((step) => (
            <TrackedProductLink
              key={step.href}
              href={step.href}
              style={shortcutCardStyle}
              ariaLabel={`${step.label}: ${step.title}. ${step.body}`}
              event={step.event}
            >
              {!mobile ? <TiqFeatureIcon name={step.icon} size="sm" variant="ghost" /> : null}
              <span style={findCommandCardCopy}>
                <span style={findCommandLabel}>{step.label}</span>
                <strong style={shortcutTitleStyle}>{step.title}</strong>
              </span>
            </TrackedProductLink>
          ))}
        </div>
      </div>

      <details className="exploreDetailsSection" style={proofStyle} aria-label="What you can check free">
        <summary style={proofSummaryStyle}>
          <span style={publicDiscoveryProofHeaderStyle}>
            <span style={findCommandEyebrow}>What you can check free</span>
            <strong style={proofTitleStyle}>Useful before upgrade.</strong>
          </span>
          <span style={proofActionStyle}>Show free checks</span>
        </summary>
        <div style={{ ...proofGridStyle, gridColumn: '1 / -1' }}>
          {PUBLIC_DISCOVERY_PROOF_STEPS.map((step) => (
            <TrackedProductLink key={step.label} href={step.href} style={publicDiscoveryProofItemStyle} event={step.event}>
              <span style={publicDiscoveryProofLabelStyle}>{step.label}</span>
              <strong>{step.title}</strong>
            </TrackedProductLink>
          ))}
        </div>
      </details>
    </section>
  )
}

const heroWrap: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  minWidth: 0,
}

const heroShell: CSSProperties = {
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '0 auto',
  borderRadius: '30px',
  background: 'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(4,10,24,0.9))',
  border: '1px solid rgba(116,190,255,0.15)',
  boxShadow: '0 30px 86px rgba(2, 8, 23, 0.46), inset 0 1px 0 rgba(255,255,255,0.05)',
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
  gap: '12px',
  minWidth: 0,
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

const findCommandPanel: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: '12px',
  marginBottom: '14px',
  padding: '14px',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.7)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
}

const findCommandWorkspace: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(min(100%, 360px), 0.9fr) minmax(0, 1.1fr)',
  gap: '12px',
  minWidth: 0,
}

const findCommandHeader: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '48px minmax(0, 1fr) minmax(0, auto)',
  gap: '12px',
  alignItems: 'center',
  minWidth: 0,
}

const compactFindCommandHeader: CSSProperties = {
  ...findCommandHeader,
  gridTemplateColumns: '32px minmax(0, 1fr) minmax(0, auto)',
  gap: '7px',
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
  letterSpacing: 0,
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

const compactFindCommandTitle: CSSProperties = {
  ...findCommandTitle,
  fontSize: '1rem',
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

const compactFindCommandPill: CSSProperties = {
  ...findCommandPill,
  minHeight: 28,
  padding: '0 8px',
  fontSize: '10px',
}

const findCommandGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  alignContent: 'start',
  gap: '8px',
  minWidth: 0,
}

const findCommandPrimaryCard: CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr) auto',
  gap: '12px',
  minHeight: 220,
  padding: '14px',
  borderRadius: '16px',
  border: '1px solid rgba(155,225,29,0.24)',
  background:
    'radial-gradient(circle at 92% 8%, rgba(155,225,29,0.18), transparent 34%), linear-gradient(135deg, rgba(116,190,255,0.1), transparent 44%), rgba(7,17,33,0.76)',
  color: 'var(--foreground)',
  textDecoration: 'none',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const findCommandPrimaryIconStyle: CSSProperties = {
  display: 'inline-grid',
  width: 'fit-content',
}

const findCommandPrimaryTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.35rem, 2.3vw, 2rem)',
  lineHeight: 1.04,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const findCommandPrimaryBodyStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.45,
  fontWeight: 760,
  overflowWrap: 'anywhere',
}

const findCommandPrimaryCtaStyle: CSSProperties = {
  width: 'fit-content',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.3)',
  background: 'rgba(155,225,29,0.12)',
  color: '#d8f7a4',
  padding: '8px 10px',
  fontSize: '12px',
  fontWeight: 950,
}

const findCommandCard: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '32px minmax(0, 1fr)',
  gap: '9px',
  alignItems: 'start',
  minHeight: 64,
  padding: '9px',
  borderRadius: '12px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground)',
  textDecoration: 'none',
  minWidth: 0,
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
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const findCommandCardTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
}

const publicDiscoveryProofStyle: CSSProperties = {
  display: 'block',
  alignItems: 'start',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'rgba(5,11,22,0.34)',
  minWidth: 0,
}

const publicDiscoveryProofHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  minWidth: 0,
}

const publicDiscoveryProofSummaryStyle: CSSProperties = {
  gridColumn: '1 / -1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  flexWrap: 'wrap',
  minWidth: 0,
  cursor: 'pointer',
  listStyle: 'none',
}

const compactPublicDiscoveryProofSummaryStyle: CSSProperties = {
  ...publicDiscoveryProofSummaryStyle,
  gap: '6px',
}

const publicDiscoveryProofSummaryActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 30,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(155,225,29,0.08)',
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 900,
  textAlign: 'center',
  whiteSpace: 'normal',
}

const compactPublicDiscoveryProofSummaryActionStyle: CSSProperties = {
  ...publicDiscoveryProofSummaryActionStyle,
  minHeight: 26,
  padding: '0 8px',
  fontSize: 10,
}

const publicDiscoveryProofTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1rem',
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
}

const compactPublicDiscoveryProofTitleStyle: CSSProperties = {
  ...publicDiscoveryProofTitleStyle,
  fontSize: '0.86rem',
}

const publicDiscoveryProofGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
  marginTop: '10px',
  minWidth: 0,
}

const publicDiscoveryProofItemStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: '5px',
  padding: '9px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(7,17,33,0.62)',
  color: 'var(--foreground)',
  textDecoration: 'none',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const publicDiscoveryProofLabelStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '10px',
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: 0,
  top: '-72px',
  width: 'min(280px, 58vw)',
  aspectRatio: '1045 / 490',
  background: 'url("/tiq/logo/tiq-mark-light.png") center / contain no-repeat',
  opacity: 0.14,
  pointerEvents: 'none',
}
