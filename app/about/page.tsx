import type { Metadata } from 'next'
import Link from 'next/link'
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
    text: 'Search players, teams, leagues, rankings, flights, and areas before you need a paid workspace.',
    href: '/explore',
    cta: 'Open Explore',
    icon: 'opponentScouting',
  },
  {
    title: 'Make it personal',
    text: 'Player turns broad discovery into My Lab, data refreshes, matchup prep, and messages.',
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

        <TierPathway compact framed={false} />

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>What TenAceIQ does</h2>
          <p>
            TenAceIQ brings player profiles, rankings, teams, leagues, matchup context, Team Hub,
            and League Office into one place so each user can move from search
            to the next useful decision. {DATA_ASSIST_STORY.shortCue}
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Who it is for</h2>
          <p>
            Free users explore the tennis landscape. Player users personalize it with My Lab,
            data refreshes, Matchup, and messages. Captains lead teams. League coordinators
            run leagues of players or teams.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>How the platform adds value</h2>
          <p>
            {PRODUCT_UPGRADE_MESSAGE}
          </p>
          <p>
            TenAceIQ turns tennis records into useful context so users spend less time guessing and
            more time understanding what to do next.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>How content is approached</h2>
          <p>
            TenAceIQ keeps tennis information clear, useful, and easy to act on. Policies and{' '}
            <Link href="/messages?compose=support">support threads</Link> are available for anyone
            who needs them.
          </p>
        </div>
      </InfoPage>
    </SiteShell>
  )
}
