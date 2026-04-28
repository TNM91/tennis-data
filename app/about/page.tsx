import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'

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
        title="Clearer tennis decisions."
        intro="TenAceIQ helps players, captains, and organizers search faster, compare better, and prepare with more confidence."
      >
        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>What TenAceIQ does</h2>
          <p>
            TenAceIQ brings player profiles, rankings, leagues, matchup context, and captain tools
            into one place so you can see who is trending, how teams compare, and what to do next.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Who it is for</h2>
          <p>
            TenAceIQ is for adult league players, captains, and organizers who manage rosters,
            availability, player comparisons, weekly prep, and season tracking.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>How the platform adds value</h2>
          <p>
            Explore players, rankings, teams, and leagues. Add member and captain tools for
            lineups, scenarios, messaging, and match prep.
          </p>
          <p>
            TenAceIQ turns tennis records into useful context so the next decision is easier to make.
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
