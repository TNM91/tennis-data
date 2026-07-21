import type { Metadata } from 'next'
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'
import InfoActionGrid, { type InfoActionCard } from '@/app/components/info-action-grid'
import TierPathway from '@/app/components/tier-pathway'
import { DATA_ASSIST_STORY } from '@/lib/product-story'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildFaqJsonLd, buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'FAQ',
  description:
    'Frequently asked questions about TenAceIQ, including Free, Player, Coach Hub, Team Hub, League Office, Tournament Desk, and Full-Court.',
  path: '/faq',
})

const faqActions: InfoActionCard[] = [
  {
    title: 'Pick a plan',
    text: 'Compare Free, My Lab, Team Hub, League Office, and Full-Court.',
    href: '/pricing',
    cta: 'Compare tiers',
    icon: 'accountSecurity',
  },
  {
    title: 'Fix data',
    text: DATA_ASSIST_STORY.shortCue,
    href: DATA_ASSIST_STORY.href,
    cta: DATA_ASSIST_STORY.cta,
    icon: 'reports',
  },
  {
    title: 'Ask support',
    text: 'Start with the tennis need, account, and data context together.',
    href: '/messages?compose=support',
    cta: 'Open support',
    icon: 'messagingCenter',
  },
]

const faqSchemaItems = [
  {
    question: 'Is TenAceIQ only for captains?',
    answer:
      'No. Free pages help anyone explore players, teams, leagues, and rankings. Player adds My Lab, data refreshes, Matchup, and Messages. Team Hub adds weekly team decisions. League Office gives leagues, ladders, and tournaments organized competition tools.',
  },
  {
    question: 'What kind of tennis information appears here?',
    answer:
      'TenAceIQ works with player, team, league, ranking, matchup, and scorecard-related context so users can understand performance, roster options, lineup tradeoffs, and season shape.',
  },
  {
    question: 'What is Free versus upgraded?',
    answer:
      'Free centers on discovery and exploration. My Lab makes the site personal. Team Hub adds weekly team decisions. League Office adds season operations. The upgrade path is meant to make life easier only when your needs grow.',
  },
  {
    question: 'How should I report a data issue?',
    answer:
      'Open a TenAceIQ support thread and include the affected league, team, date, player, or match reference. If you have the source record, start with Data Assist so the fix can be reviewed before it changes tennis context.',
  },
] as const

export default function FaqPage() {
  return (
    <SiteShell active="/faq">
      <JsonLd id="faq-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('FAQ', '/faq')} />
      <JsonLd id="faq-page-jsonld" data={buildFaqJsonLd(faqSchemaItems)} />
      <InfoPage
        kicker="FAQ"
        title="Common questions about TenAceIQ."
        intro="Start with the tool you need. Open the details only when you want the longer answer."
      >
        <InfoActionGrid cards={faqActions} />

        <FaqDetailsSection eyebrow="Tier path" title="The simple version" cue="View tiers">
          <TierPathway
            compact
            framed={false}
            title="The simple version"
            intro="Free explores, My Lab personalizes, Team Hub leads teams, League Office runs seasons, and Full-Court brings it together."
          />
        </FaqDetailsSection>

        <FaqDetailsSection eyebrow="Access" title="Is TenAceIQ only for captains?" cue="Answer">
          <p>
            No. Free pages help anyone explore players, teams, leagues, and rankings. Player adds
            My Lab, data refreshes, Matchup, and Messages. Team Hub adds weekly team decisions.
            League Office gives leagues, ladders, and tournaments organized competition tools.
          </p>
        </FaqDetailsSection>

        <FaqDetailsSection eyebrow="Tennis context" title="What info appears here?" cue="Open">
          <p>
            The site works with player, team, league, ranking, matchup, and scorecard-related
            context so you can understand performance, roster options, lineup tradeoffs, and
            season shape. {DATA_ASSIST_STORY.shortCue}
          </p>
        </FaqDetailsSection>

        <FaqDetailsSection eyebrow="Plans" title="What is Free versus upgraded?" cue="Answer">
          <p>
            Free centers on discovery and exploration. My Lab makes the site personal. Team Hub adds
            weekly team decisions. League Office adds season operations. The
            upgrade path is meant to make life easier only when your needs grow.
          </p>
        </FaqDetailsSection>

        <FaqDetailsSection eyebrow="Data review" title="How do I report data?" cue="Open">
          <p>
            Open a <Link href="/messages?compose=support&category=data">TenAceIQ support thread</Link>{' '}
            and include the affected league, team, date, player, or match reference. If you have the
            source record, start with <Link href={DATA_ASSIST_STORY.href}>{DATA_ASSIST_STORY.cta}</Link> so the
            fix can be reviewed before it changes tennis context.
          </p>
        </FaqDetailsSection>
      </InfoPage>
    </SiteShell>
  )
}

function FaqDetailsSection({
  eyebrow,
  title,
  cue,
  children,
}: {
  eyebrow: string
  title: string
  cue: string
  children: ReactNode
}) {
  return (
    <details className="publicInfoDetailsSection" style={faqDetailsSectionStyle}>
      <summary style={faqDetailsSummaryStyle}>
        <span style={faqDetailsSummaryCopyStyle}>
          <span style={faqDetailsEyebrowStyle}>{eyebrow}</span>
          <strong style={faqDetailsTitleStyle}>{title}</strong>
        </span>
        <span style={faqDetailsCueStyle}>{cue}</span>
      </summary>
      <div style={faqDetailsContentStyle}>{children}</div>
    </details>
  )
}

const faqDetailsSectionStyle: CSSProperties = {
  display: 'block',
  gap: 10,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const faqDetailsSummaryStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minWidth: 0,
  padding: '12px 14px',
  borderRadius: 8,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  cursor: 'pointer',
  listStyle: 'none',
  overflowWrap: 'anywhere',
}

const faqDetailsSummaryCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const faqDetailsEyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const faqDetailsTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const faqDetailsCueStyle: CSSProperties = {
  flex: '0 1 auto',
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  textAlign: 'right',
  overflowWrap: 'anywhere',
}

const faqDetailsContentStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
  paddingTop: 10,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.6,
  overflowWrap: 'anywhere',
}
