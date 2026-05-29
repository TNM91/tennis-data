'use client'

import Link from 'next/link'
import { CSSProperties } from 'react'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import AdsenseSlot from '@/app/components/adsense-slot'
import UniversalSearch from '@/app/components/universal-search'
import { shouldShowSponsoredPlacements } from '@/lib/access-model'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'
import { useProductAccess } from '@/lib/use-product-access'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'

const FIND_COMMAND_STEPS: Array<{
  href: string
  label: string
  title: string
  icon: TiqFeatureIconName
}> = [
  {
    href: '/explore/players',
    label: 'Find a player',
    title: 'Open the profile',
    icon: 'playerRatings',
  },
  {
    href: '/explore/teams',
    label: 'Browse teams',
    title: 'Check the roster',
    icon: 'lineupBuilder',
  },
  {
    href: '/explore/leagues',
    label: 'Check standings',
    title: 'Open the league table',
    icon: 'schedule',
  },
  {
    href: '/explore/rankings',
    label: 'Check rankings',
    title: 'Scan the field',
    icon: 'reports',
  },
]

const EXPLORE_INLINE_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_EXPLORE_INLINE || null

export default function ExplorePage() {
  const { isMobile, isSmallMobile } = useViewportBreakpoints()
  const { access, authResolved } = useProductAccess()
  const shouldShowAds = authResolved && shouldShowSponsoredPlacements(access)

  const dynamicHeroWrap: CSSProperties = {
    ...heroWrap,
    padding: isMobile ? '16px 0 48px' : '20px 0 64px',
    overflowX: 'clip',
    boxSizing: 'border-box',
  }

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isSmallMobile ? '24px 18px 22px' : isMobile ? '28px 20px 24px' : '30px',
    borderRadius: isMobile ? '28px' : '30px',
    background: 'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(4,10,24,0.9))',
    border: '1px solid rgba(116,190,255,0.15)',
    boxShadow: '0 30px 86px rgba(2, 8, 23, 0.46), inset 0 1px 0 rgba(255,255,255,0.05)',
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

  return (
    <SiteShell active="explore">
      <JsonLd id="explore-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Find', '/explore')} />
      <section style={dynamicHeroWrap}>
        <div style={dynamicHeroShell}>
          <div aria-hidden="true" style={watermarkStyle} />
          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <h1 style={dynamicHeroTitle}>
                More Tennis. Less Chaos.
              </h1>

              <p style={dynamicHeroText}>
                Search a player, team, league, coach, tournament, city, court, resource, or tennis action.
              </p>
              <UniversalSearch compact />
            </div>

          </div>

          <FindCommandPanel />
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

function FindCommandPanel() {
  return (
    <section style={findCommandPanel} aria-label="Find mode paths">
      <div style={findCommandHeader}>
        <TiqFeatureIcon name="opponentScouting" size="md" variant="surface" />
        <div style={findCommandCopy}>
          <div style={findCommandEyebrow}>Find mode</div>
          <h2 style={findCommandTitle}>Choose a path.</h2>
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
              </span>
            </Link>
          ))}
      </div>
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
  gap: '16px',
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
  gap: '14px',
  marginBottom: '18px',
  padding: '16px',
  borderRadius: '22px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.7)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
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
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
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
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const findCommandCardTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: '-86px',
  top: '-108px',
  width: '340px',
  aspectRatio: '1',
  borderRadius: '50%',
  border: '34px solid rgba(155,225,29,0.07)',
  boxShadow: 'inset 0 0 0 2px rgba(125,211,252,0.05), 0 0 76px rgba(125,211,252,0.08)',
  opacity: 0.72,
  pointerEvents: 'none',
}
