import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Learn what TenAceIQ is, who it is built for, and how the platform approaches tennis ratings, lineup decisions, and league intelligence.',
}

export default function AboutPage() {
  return (
    <SiteShell active="/about">
      <InfoPage
        kicker="About"
        title="Built to make tennis decisions easier to trust."
        intro="TenAceIQ is a tennis intelligence platform focused on turning messy league, player, lineup, and match context into something captains and competitive players can actually use. The goal is simple: less guessing, faster prep, and clearer decisions before and after match day."
      >
        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>What TenAceIQ does</h2>
          <p>
            The platform combines player profiles, rankings, league structure, matchup context,
            and captain workflow tools in one place. Instead of bouncing between scorecards,
            spreadsheets, league pages, and lineup notes, you get a clearer operating picture of
            who is trending, what a team looks like, and where the real decisions live.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Who it is for</h2>
          <p>
            TenAceIQ is designed for adult league players, captains, and tennis organizers who
            need better structure around roster planning, availability, player comparison, weekly
            prep, and season-level tracking.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>How the platform adds value</h2>
          <p>
            The public side helps people explore players, rankings, teams, and leagues without
            friction. The member and captain layers go further by organizing weekly decisions such
            as lineup construction, scenario planning, messaging, and match-readiness work.
          </p>
          <p>
            That value comes from curation, normalization, context, and workflow design rather than
            simply repeating raw tennis records. The platform is built to help users interpret data,
            not just look at it.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>How content is approached</h2>
          <p>
            TenAceIQ aims to present tennis information with useful context, responsible handling,
            and clear ownership of the site experience. Legal policies, contact information, and
            product explanations are published so visitors can understand what the platform is, what
            it does, and how to reach the team behind it.
          </p>
        </div>
      </InfoPage>
    </SiteShell>
  )
}
