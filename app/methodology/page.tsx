import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'

export const metadata: Metadata = {
  title: 'Methodology',
  description:
    'A high-level explanation of how TenAceIQ uses tennis data, workflow context, and platform structure to add value beyond raw records.',
}

export default function MethodologyPage() {
  return (
    <SiteShell active="/methodology">
      <InfoPage
        kicker="Methodology"
        title="How TenAceIQ turns raw tennis records into usable context."
        intro="The platform is designed to do more than display records. It organizes data into player, team, league, matchup, and captain workflows so visitors can interpret what matters instead of manually stitching everything together."
      >
        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Normalization first</h2>
          <p>
            Imported schedule and scorecard data often arrive in uneven shapes. TenAceIQ normalizes
            those inputs into a more consistent structure so they can support league summaries,
            player views, matchup context, and captain tools.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Context over raw listing</h2>
          <p>
            Pages are built to add interpretation: player movement, league structure, matchup
            readiness, team trends, scorecard completion state, and weekly decision support. The
            goal is to present useful context, not simply duplicate source records.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Workflow matters</h2>
          <p>
            The captain and admin layers are organized around real operational tasks like
            availability, scenario planning, missing scorecards, and lineup comparisons. That
            workflow structure is part of the product value.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Continuous improvement</h2>
          <p>
            As more season data flows in, the platform can improve league completeness, player
            profiles, scorecard tracking, and team-level visibility. The system is meant to become
            more useful as the underlying tennis data gets cleaner and more complete.
          </p>
        </div>
      </InfoPage>
    </SiteShell>
  )
}
