import type { Metadata } from 'next'
import type { CSSProperties, ReactNode } from 'react'
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
    'Tennis need or page:',
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
        intro={`Choose the support path that matches what you need. ${SUPPORT_THREAD_ASSURANCE}`}
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

        <ContactDetails title="What to include" summary="Show support tips">
          <ContactHelpItem title="General support">
            Open a <Link href={generalSupportHref}>TenAceIQ support thread</Link> for
            membership questions, billing questions, account issues, or help choosing where your tennis need belongs.
          </ContactHelpItem>

          <ContactHelpItem title="Data quality and import help">
            If a schedule, league, team, or scorecard looks wrong, include the league name, date,
            match identifier when available, and a short description of the issue. That helps us
            trace Data Assist upload or review problems and correct the affected records.{' '}
            <Link href={dataSupportHref}>Open a data support thread</Link>.
          </ContactHelpItem>

          <ContactHelpItem title="Business and partnership inquiries">
            For partnerships, club or league rollouts, or product collaboration, open a{' '}
            <Link href={partnershipSupportHref}>TenAceIQ support thread</Link>{' '}
            so the conversation stays inside TenAceIQ Messages.
          </ContactHelpItem>

          <ContactHelpItem title="What helps us respond faster">
            Include the page you were on, the tennis tool you were using, what you expected to happen,
            and what happened instead. Screenshots and exact match or player references help when the
            issue involves imported tennis data.
          </ContactHelpItem>
        </ContactDetails>
      </InfoPage>
    </SiteShell>
  )
}

function ContactDetails({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  return (
    <details className="publicInfoDetailsSection" style={contactDetailsStyle}>
      <summary style={contactSummaryStyle}>
        <span style={contactSummaryCopyStyle}>
          <span style={contactSummaryKickerStyle}>Support details</span>
          <strong>{title}</strong>
        </span>
        <span style={contactSummaryActionStyle}>{summary}</span>
      </summary>
      <div style={contactDetailsBodyStyle}>{children}</div>
    </details>
  )
}

function ContactHelpItem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={contactHelpItemStyle}>
      <h2 className="section-title" style={contactHelpTitleStyle}>{title}</h2>
      <p style={contactHelpTextStyle}>{children}</p>
    </section>
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

const contactDetailsStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.58)',
  overflow: 'hidden',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const contactSummaryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minHeight: 62,
  padding: '12px 14px',
  color: 'var(--foreground-strong)',
  cursor: 'pointer',
  listStyle: 'none',
}

const contactSummaryCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
}

const contactSummaryKickerStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const contactSummaryActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(155,225,29,0.08)',
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 900,
  textAlign: 'center',
  whiteSpace: 'normal',
}

const contactDetailsBodyStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  padding: '0 14px 14px',
}

const contactHelpItemStyle: CSSProperties = {
  minWidth: 0,
  padding: '12px',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.035)',
}

const contactHelpTitleStyle: CSSProperties = {
  fontSize: '1.05rem',
  marginBottom: 6,
}

const contactHelpTextStyle: CSSProperties = {
  margin: 0,
}
