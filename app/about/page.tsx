import type { Metadata } from 'next'
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'
import InfoActionGrid, { type InfoActionCard } from '@/app/components/info-action-grid'
import TierPathway from '@/app/components/tier-pathway'
import { DATA_ASSIST_STORY, PRODUCT_NORTH_STAR, PRODUCT_UPGRADE_MESSAGE } from '@/lib/product-story'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'About',
  description:
    'Learn how TenAceIQ helps players, captains, coaches, tournament directors, and organizers make clearer tennis decisions.',
  path: '/about',
})

const aboutActions: InfoActionCard[] = [
  {
    title: 'Find context',
    text: 'Search players, teams, leagues, rankings, flights, and areas before choosing paid tools.',
    href: '/explore',
    cta: 'Open Explore',
    icon: 'opponentScouting',
  },
  {
    title: 'Make it personal',
    text: 'Open My Lab, refresh your data, prep Matchup, and keep messages tied to your player record.',
    href: '/mylab',
    cta: 'Open My Lab',
    icon: 'myLab',
  },
  {
    title: 'Run the week',
    text: 'Team Hub and League Office reduce scattered work for match weeks and seasons.',
    href: '/pricing',
    cta: 'Compare tiers',
    icon: 'lineupBuilder',
  },
]

export default function AboutPage() {
  return (
    <SiteShell active="/about">
      <JsonLd id="about-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('About', '/about')} />
      <InfoPage
        kicker="About"
        title="Less guessing. More playing."
        intro={PRODUCT_NORTH_STAR}
      >
        <InfoActionGrid cards={aboutActions} />

        <AboutDetailsSection eyebrow="Plan path" title="Choose the right layer" cue="View tiers">
          <TierPathway compact framed={false} />
        </AboutDetailsSection>

        <AboutDetailsSection eyebrow="How it helps" title="What TenAceIQ does" cue="Read more">
          <div>
            <h2 className="section-title" style={aboutSectionTitleStyle}>What TenAceIQ does</h2>
            <p>
              TenAceIQ brings player profiles, rankings, teams, leagues, matchup context, Team Hub,
              and League Office into one place so you can move from search
              to the next useful decision. {DATA_ASSIST_STORY.shortCue}
            </p>
          </div>

          <div>
            <h2 className="section-title" style={aboutSectionTitleStyle}>Who it is for</h2>
            <p>
              Use Free to explore the tennis landscape. Use Player to personalize it with My Lab,
              data refreshes, Matchup, and messages. Captains lead teams. League coordinators
              run leagues of players or teams.
            </p>
          </div>

          <div>
            <h2 className="section-title" style={aboutSectionTitleStyle}>How TenAceIQ adds value</h2>
            <p>
              {PRODUCT_UPGRADE_MESSAGE}
            </p>
            <p>
              TenAceIQ turns tennis records into useful context so you spend less time guessing and
              more time understanding what to do next.
            </p>
          </div>

          <div>
            <h2 className="section-title" style={aboutSectionTitleStyle}>How content is approached</h2>
            <p>
              TenAceIQ keeps tennis information clear, useful, and easy to act on. Policies and{' '}
              <Link href="/messages?compose=support">support threads</Link> are available when
              you need them.
            </p>
          </div>
        </AboutDetailsSection>
      </InfoPage>
    </SiteShell>
  )
}

function AboutDetailsSection({
  eyebrow,
  title,
  cue,
  children,
}: {
  eyebrow: string
  title: string
  cue: string
  children: ReactNode
}) {
  return (
    <details className="publicInfoDetailsSection" style={aboutDetailsSectionStyle}>
      <summary style={aboutDetailsSummaryStyle}>
        <span style={aboutDetailsSummaryCopyStyle}>
          <span style={aboutDetailsEyebrowStyle}>{eyebrow}</span>
          <strong style={aboutDetailsTitleStyle}>{title}</strong>
        </span>
        <span style={aboutDetailsCueStyle}>{cue}</span>
      </summary>
      <div style={aboutDetailsContentStyle}>{children}</div>
    </details>
  )
}

const aboutSectionTitleStyle: CSSProperties = {
  fontSize: '1.2rem',
}

const aboutDetailsSectionStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const aboutDetailsSummaryStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minWidth: 0,
  padding: '10px 12px',
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  cursor: 'pointer',
  listStyle: 'none',
  overflowWrap: 'anywhere',
}

const aboutDetailsSummaryCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const aboutDetailsEyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const aboutDetailsTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const aboutDetailsCueStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 1 auto',
  minHeight: 30,
  padding: '0 9px',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--brand-green) 12%, transparent)',
  color: 'var(--brand-green)',
  fontSize: 11,
  fontWeight: 950,
  textAlign: 'right',
  overflowWrap: 'anywhere',
}

const aboutDetailsContentStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  paddingTop: 8,
  overflowWrap: 'anywhere',
}
