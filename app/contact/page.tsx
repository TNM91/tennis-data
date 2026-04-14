import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact TenAceIQ for support, data quality questions, account issues, and partnership inquiries.',
}

export default function ContactPage() {
  return (
    <SiteShell active="/contact">
      <InfoPage
        kicker="Contact"
        title="Questions, support, or data issues."
        intro="If you need help with an account, want to report a data problem, or have a partnership or product question, this page is the best place to start. Clear support paths help both users and platform reviewers understand who runs the site and how to reach them."
      >
        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>General support</h2>
          <p>
            Email <a href="mailto:support@tenaceiq.com">support@tenaceiq.com</a> for login issues,
            membership questions, account recovery, or general help using the platform.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Data quality and import help</h2>
          <p>
            If a schedule, league, team, or scorecard looks wrong, include the league name, date,
            match identifier when available, and a short description of the issue. That makes it
            much easier to trace import problems and correct the affected records.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Business and partnership inquiries</h2>
          <p>
            For partnerships, club or league rollouts, or product collaboration, email{' '}
            <a href="mailto:hello@tenaceiq.com">hello@tenaceiq.com</a>.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>What helps the team respond faster</h2>
          <p>
            Include the page you were on, the feature you were using, what you expected to happen,
            and what happened instead. Screenshots and exact match or player references are also
            helpful when the issue involves imported tennis data.
          </p>
        </div>
      </InfoPage>
    </SiteShell>
  )
}
