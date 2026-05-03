import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'
import TierPathway from '@/app/components/tier-pathway'
import { PRODUCT_NORTH_STAR, PRODUCT_UPGRADE_MESSAGE } from '@/lib/product-story'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Learn how TenAceIQ helps players, captains, and organizers make clearer tennis decisions.',
}

export default function AboutPage() {
  return (
    <SiteShell active="/about">
      <InfoPage
        kicker="About"
        title="Less guessing. More playing."
        intro={PRODUCT_NORTH_STAR}
      >
        <TierPathway compact framed={false} />

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>What TenAceIQ does</h2>
          <p>
            TenAceIQ brings player profiles, rankings, teams, leagues, matchup context, Captain
            tools, and League Coordinator tools into one place so each user can move from search
            to the next useful decision.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Who it is for</h2>
          <p>
            Free users explore the tennis landscape. Player users personalize it with My Lab,
            follows, Matchup, and player-linked context. Captains lead teams. TIQ League
            Coordinators run leagues of players or teams.
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
            TenAceIQ keeps tennis information clear, useful, and easy to act on. Policies and
            contact details are available for anyone who needs them.
          </p>
        </div>
      </InfoPage>
    </SiteShell>
  )
}
