import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'
import InfoActionGrid, { type InfoActionCard } from '@/app/components/info-action-grid'
import { DATA_ASSIST_STORY } from '@/lib/product-story'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'How It Works',
  description:
    'See how TenAceIQ connects free discovery, My Lab, Team Hub, League Office, Tournament Desk, and Full-Court into one tennis decision system.',
  path: '/how-it-works',
})

const workflowCards: InfoActionCard[] = [
  {
    title: 'Explore',
    text: 'Use public tennis intelligence to understand who, where, and what level.',
    href: '/explore',
    cta: 'Start free',
    icon: 'opponentScouting',
  },
  {
    title: 'Personalize',
    text: 'Open My Lab, improve data, prep matchups, and keep tennis messages together.',
    href: '/mylab',
    cta: 'Open My Lab',
    icon: 'myLab',
  },
  {
    title: 'Operate',
    text: 'Move team weeks, tournaments, and league seasons into repeatable workspaces when the work grows.',
    href: '/pricing',
    cta: 'Choose a tier',
    icon: 'teamRankings',
  },
]

export default function HowItWorksPage() {
  return (
    <SiteShell active="/how-it-works">
      <JsonLd id="how-it-works-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('How It Works', '/how-it-works')} />
      <InfoPage
        kicker="How It Works"
        title="Start with discovery. Upgrade when it saves time."
        intro="TenAceIQ is organized by need: Free helps people explore the tennis landscape, My Lab makes the site personal, Team Hub supports weekly decisions, League Office helps organizers run seasons, and Full-Court brings the operation together."
      >
        <InfoActionGrid cards={workflowCards} />

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>1. Free discovery</h2>
          <p>
            Public pages like <Link href="/explore/players">Players</Link>, <Link href="/explore/rankings">Rankings</Link>,{' '}
            <Link href="/explore/teams">Teams</Link>, and <Link href="/explore/leagues">Leagues</Link> help players,
            captains, and organizers understand the landscape before they need a personal workspace.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>2. Player context</h2>
          <p>
            Player unlocks <Link href="/mylab">My Lab</Link>, data refreshes, Matchup, and
            Messages. The point is to turn broad discovery into something personally useful and
            repeatable before the next match.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>3. Team Hub and Captain Tools</h2>
          <p>
            Team Hub is built around actual weekly operations: availability, lineup planning,
            scenario comparisons, messaging, and match preparation. That layer exists to reduce
            scramble and make lineup choices easier to explain and repeat.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>4. League Office</h2>
          <p>
            League Office is for organizers running leagues of players or teams. It brings
            setup, participants, schedules, standings, results, and communication closer together so
            the season takes less manual effort to manage.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>5. Improve data</h2>
          <p>
             When rosters, schedules, or scorecards need to be updated, players, captains, coordinators,
             and admins can start with <Link href={DATA_ASSIST_STORY.href}>{DATA_ASSIST_STORY.cta}</Link>.
             {DATA_ASSIST_STORY.shortCue} Uploads are reviewed before they shape ratings, standings,
             matchup context, team pages, or Team Hub.
          </p>
        </div>
      </InfoPage>
    </SiteShell>
  )
}
