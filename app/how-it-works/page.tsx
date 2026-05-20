import type { Metadata } from 'next'
import Link from 'next/link'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'
import InfoActionGrid, { type InfoActionCard } from '@/app/components/info-action-grid'
import { DATA_ASSIST_STORY } from '@/lib/product-story'

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'See how TenAceIQ connects free discovery, Player personalization, Captain tools, and league coordination into one tennis decision system.',
}

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
    text: 'Connect your player record so My Lab and Matchup start from your game.',
    href: '/profile',
    cta: 'Connect profile',
    icon: 'myLab',
  },
  {
    title: 'Operate',
    text: 'Move team weeks and league seasons into repeatable tools when the work grows.',
    href: '/pricing',
    cta: 'Choose a tier',
    icon: 'teamRankings',
  },
]

export default function HowItWorksPage() {
  return (
    <SiteShell active="/how-it-works">
      <InfoPage
        kicker="How It Works"
        title="Start with discovery. Upgrade when it saves time."
        intro="TenAceIQ is organized by need: Free helps people explore the tennis landscape, Player makes the site personal, Captain supports weekly team decisions, and TIQ League Coordinator helps organizers run leagues of players or teams."
      >
        <InfoActionGrid cards={workflowCards} />

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>1. Free discovery</h2>
          <p>
            Public pages like <Link href="/explore/players">Players</Link>, <Link href="/explore/rankings">Rankings</Link>,{' '}
            <Link href="/explore/teams">Teams</Link>, and <Link href="/explore/leagues">Leagues</Link> help players,
            captains, and organizers understand the landscape before they need personal tools.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>2. Player context</h2>
          <p>
            Player unlocks <Link href="/mylab">My Lab</Link>, follows, Matchup, and player-linked
            context. The point is to turn broad discovery into something personally useful and
            repeatable before the next match.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>3. Captain workflow</h2>
          <p>
            Captain tools are built around actual weekly operations: availability, lineup planning,
            scenario comparisons, messaging, and match preparation. That layer exists to reduce
            scramble and make lineup choices easier to explain and repeat.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>4. League coordination</h2>
          <p>
            TIQ League Coordinator is for organizers running leagues of players or teams. It brings
            setup, participants, schedules, standings, results, and communication closer together so
            the season takes less manual effort to manage.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>5. Data Assist refreshes records</h2>
          <p>
            When rosters, schedules, or scorecards need to be updated, players, captains, coordinators,
            and admins can start with <Link href="/data-assist">{DATA_ASSIST_STORY.cta}</Link>.
            Uploads are reviewed before they shape ratings, standings, matchup context, or team tools.
          </p>
        </div>
      </InfoPage>
    </SiteShell>
  )
}
