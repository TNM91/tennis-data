import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Frequently asked questions about TenAceIQ, including who it is for, what data it uses, and how the public and captain tools differ.',
}

export default function FaqPage() {
  return (
    <SiteShell active="/faq">
      <InfoPage
        kicker="FAQ"
        title="Common questions about the platform."
        intro="These answers explain what TenAceIQ is built to do, where the public experience ends, and where the deeper member and captain tools begin."
      >
        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Is TenAceIQ only for captains?</h2>
          <p>
            No. The platform is useful for individual players, team leaders, and league-focused
            users. Public pages help with discovery and comparison, while the captain layer goes
            deeper on weekly team workflow.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>What kind of tennis information appears here?</h2>
          <p>
            The site works with player, team, league, matchup, and scorecard-related context so
            users can understand performance, roster options, lineup tradeoffs, and season shape.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>What is public versus member-only?</h2>
          <p>
            Public pages center on discovery, exploration, and lightweight comparison. Member and
            captain tools add more workflow, personalization, and operational context around actual
            weekly tennis decisions.
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
