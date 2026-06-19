import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { SUPPORT_THREAD_ASSURANCE, buildSupportMessageHref } from '@/lib/message-links'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Contact',
  description:
    'Contact TenAceIQ for support, data quality questions, account issues, and partnership inquiries.',
  path: '/contact',
})

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
    'Tennis job or page:',
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

const contactCards: Array<{
  title: string
  text: string
  href: string
  cta: string
  icon: TiqFeatureIconName
}> = [
  {
    title: 'General support',
    text: 'Membership, billing, account access, or help choosing the right tennis path.',
    href: generalSupportHref,
    cta: 'Open support',
    icon: 'accountSecurity',
  },
  {
    title: 'Data quality',
    text: 'Schedules, leagues, teams, scorecards, imports, or records that need review.',
    href: dataSupportHref,
    cta: 'Report data issue',
    icon: 'reports',
  },
  {
    title: 'Partnerships',
    text: 'Club, team, or league rollout conversations that should stay inside TenAceIQ.',
    href: partnershipSupportHref,
    cta: 'Start conversation',
    icon: 'teamRankings',
  },
]

export default function ContactPage() {
  return (
    <SiteShell active="/contact">
      <JsonLd id="contact-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Contact', '/contact')} />
      <InfoPage
        kicker="Contact"
        title="Questions, support, or data issues."
        intro={`If you need help with an account, want to report a data problem, or have a partnership or product question, this page is the best place to start. ${SUPPORT_THREAD_ASSURANCE}`}
      >
        <div style={contactGridStyle}>
          {contactCards.map((card) => (
            <Link key={card.title} href={card.href} style={contactCardStyle}>
              <TiqFeatureIcon name={card.icon} size="md" variant="surface" />
              <span style={contactCardCopyStyle}>
                <strong>{card.title}</strong>
                <small>{card.text}</small>
                <em>{card.cta}</em>
              </span>
            </Link>
          ))}
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>General support</h2>
          <p>
            Open a <Link href={generalSupportHref}>TenAceIQ support thread</Link> for
            membership questions, billing questions, account issues, or help choosing where your tennis job belongs.
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

const contactGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
  gap: 12,
}

const contactCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '48px minmax(0, 1fr)',
  gap: 12,
  alignItems: 'start',
  minWidth: 0,
  minHeight: 150,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground)',
  textDecoration: 'none',
}

const contactCardCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  color: 'var(--foreground-strong)',
  lineHeight: 1.25,
  overflowWrap: 'anywhere',
}
