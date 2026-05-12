import type { Metadata } from 'next'
import Link from 'next/link'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'
import { SUPPORT_THREAD_ASSURANCE, buildSupportMessageHref } from '@/lib/message-links'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact TenAceIQ for support, data quality questions, account issues, and partnership inquiries.',
}

const generalSupportHref = buildSupportMessageHref({
  category: 'general',
  subject: 'TenAceIQ support question',
  body: 'I need help with TenAceIQ.',
})

const dataSupportHref = buildSupportMessageHref({
  category: 'data',
  subject: 'Data Assist or data quality question',
  body: [
    'I need help with a TenAceIQ data issue.',
    'Page or workspace:',
    'League/team/player:',
    'What looks wrong:',
  ].join('\n'),
  entityType: 'data-assist',
})

const partnershipSupportHref = buildSupportMessageHref({
  category: 'general',
  subject: 'Partnership or league rollout question',
  body: [
    'I want to discuss a TenAceIQ partnership, club rollout, or league rollout.',
    'Organization:',
    'Role:',
    'Goal:',
  ].join('\n'),
})

export default function ContactPage() {
  return (
    <SiteShell active="/contact">
      <InfoPage
        kicker="Contact"
        title="Questions, support, or data issues."
        intro={`If you need help with an account, want to report a data problem, or have a partnership or product question, this page is the best place to start. ${SUPPORT_THREAD_ASSURANCE}`}
      >
        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>General support</h2>
          <p>
            Open a <Link href={generalSupportHref}>TenAceIQ support thread</Link> for
            membership questions, billing questions, account issues, or general help using the platform.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Data quality and import help</h2>
          <p>
            If a schedule, league, team, or scorecard looks wrong, include the league name, date,
            match identifier when available, and a short description of the issue. That makes it
            much easier to trace Data Assist upload or review problems and correct the affected records.
            <br />
            <Link href={dataSupportHref}>Open a data support thread</Link>.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Business and partnership inquiries</h2>
          <p>
            For partnerships, club or league rollouts, or product collaboration, open a{' '}
            <Link href={partnershipSupportHref}>TenAceIQ support thread</Link>{' '}
            so the conversation stays inside the platform.
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
