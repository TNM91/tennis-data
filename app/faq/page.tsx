import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'
import TierPathway from '@/app/components/tier-pathway'

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Frequently asked questions about TenAceIQ, including Free, Player, Captain, and TIQ League Coordinator tools.',
}

export default function FaqPage() {
  return (
    <SiteShell active="/faq">
      <InfoPage
        kicker="FAQ"
        title="Common questions about the platform."
        intro="These answers explain what TenAceIQ is built to do and how the Free, Player, Captain, and TIQ League Coordinator layers fit together."
      >
        <TierPathway
          compact
          framed={false}
          title="The simple version"
          intro="Free explores, Player personalizes, Captain leads teams, and TIQ League Coordinator runs league operations."
        />

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Is TenAceIQ only for captains?</h2>
          <p>
            No. Free pages help anyone explore players, teams, leagues, and rankings. Player adds
            My Lab, follows, Matchup, and player-linked context. Captain adds team workflow. TIQ
            League Coordinator adds tools for running leagues of players or teams.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>What kind of tennis information appears here?</h2>
          <p>
            The site works with player, team, league, ranking, matchup, and scorecard-related
            context so users can understand performance, roster options, lineup tradeoffs, and
            season shape.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>What is Free versus upgraded?</h2>
          <p>
            Free centers on discovery and exploration. Player makes the site personal. Captain adds
            weekly team decisions. TIQ League Coordinator adds season operations for leagues. The
            upgrade path is meant to make life easier only when your needs grow.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>How should I report a data issue?</h2>
          <p>
            Use the contact page and include the affected league, team, date, player, or match
            reference. Exact examples help the platform trace import issues much faster.
          </p>
        </div>
      </InfoPage>
    </SiteShell>
  )
}
