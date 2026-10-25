'use client'

import TennisGuideLinks from '@/app/components/tennis-guide-links'
import { CSSProperties } from 'react'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import AdsenseSlot from '@/app/components/adsense-slot'
import UniversalSearch from '@/app/components/universal-search'
import { shouldShowSponsoredPlacements } from '@/lib/access-model'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'
import { useProductAccess } from '@/lib/use-product-access'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import ExploreContinueCard from '@/app/explore/_components/explore-continue-card'
import ContextualTennisVisual from '@/app/components/contextual-tennis-visual'
import FindCommandPanel from '@/components/explore/FindCommandPanel'

const EXPLORE_INLINE_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_EXPLORE_INLINE || null

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
          <ContextualTennisVisual visual="explore" />
          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <h1 style={dynamicHeroTitle}>
                Find players, teams, leagues.
              </h1>

              {!isMobile ? (
                <p style={dynamicHeroText}>
                  Search by name, team, league, city, rating, coach, or tournament.
                </p>
              ) : null}
              <UniversalSearch
                compact
                showResults={false}
                stackOnMobile
                placeholder="Search players, teams, leagues, and more"
              />
              <ExploreContinueCard />
            </div>

          </div>

          <FindCommandPanel compact={isTablet} mobile={isMobile} />
        </div>
      </section>
      <TennisGuideLinks />
      {shouldShowAds ? (
        <div style={{ marginTop: 12 }}>
          <AdsenseSlot slot={EXPLORE_INLINE_AD_SLOT} label="Sponsored" minHeight={250} />
        </div>
      ) : null}
    </SiteShell>
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
