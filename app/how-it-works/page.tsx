import type { Metadata } from 'next'
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'
import InfoActionGrid, { type InfoActionCard } from '@/app/components/info-action-grid'
import { DATA_ASSIST_STORY } from '@/lib/product-story'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'How It Works',
  description:
    'See how TenAceIQ helps players, coaches, captains, and organizers start free and add the right tools when needed.',
  path: '/how-it-works',
})

const toolCards: InfoActionCard[] = [
  {
    title: 'Explore',
    text: 'Search players, teams, leagues, rankings, and tournaments for free.',
    href: '/explore',
    cta: 'Start free',
    icon: 'opponentScouting',
  },
  {
    title: 'Improve',
    text: 'Use My Lab for goals, practice, matchup prep, and your tennis profile.',
    href: '/mylab',
    cta: 'Open My Lab',
    icon: 'myLab',
  },
  {
    title: 'Lead',
    text: 'Add Coach, Captain, or League tools when you support other players or competition.',
    href: '/pricing',
    cta: 'Choose a tier',
    icon: 'teamRankings',
  },
]

export default function HowItWorksPage() {
  return (
    <SiteShell active="/how-it-works">
      <JsonLd id="how-it-works-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('How It Works', '/how-it-works')} />
      <InfoPage
        kicker="How It Works"
        title="Start free. Add tools when you need them."
        intro="Explore tennis for free. Upgrade only when you want help with your game, players, team, league, or tournament."
      >
        <InfoActionGrid cards={toolCards} />

        <HowItWorksDetails summary="Show the full path" title="How the tools fit together">
          <HowItWorksStep title="1. Explore for free">
            Public pages like <Link href="/explore/players">Players</Link>, <Link href="/explore/rankings">Rankings</Link>,{' '}
            <Link href="/explore/teams">Teams</Link>, and <Link href="/explore/leagues">Leagues</Link> help players,
            captains, and organizers find the tennis information they need.
          </HowItWorksStep>

          <HowItWorksStep title="2. Set up your game">
            Player unlocks <Link href="/mylab">My Lab</Link>, matchup prep, goals, follows, and
            messages tied to your tennis profile.
          </HowItWorksStep>

          <HowItWorksStep title="3. Captain your team">
            Team Hub keeps availability, lineup planning, scouting, messages, and match preparation together.
          </HowItWorksStep>

          <HowItWorksStep title="4. Organize competition">
            League Office keeps participants, schedules, standings, results, and messages in one place.
          </HowItWorksStep>

          <HowItWorksStep title="5. Fix tennis info">
            When rosters, schedules, or scorecards need updates, start with{' '}
            <Link href={DATA_ASSIST_STORY.href}>{DATA_ASSIST_STORY.cta}</Link>. {DATA_ASSIST_STORY.shortCue}
            Uploads are reviewed before they shape ratings, standings, matchup context, team pages, or Team Hub.
          </HowItWorksStep>
        </HowItWorksDetails>
      </InfoPage>
    </SiteShell>
  )
}

function HowItWorksDetails({
  summary,
  title,
  children,
}: {
  summary: string
  title: string
  children: ReactNode
}) {
  return (
    <details className="publicInfoDetailsSection" style={detailsStyle}>
      <summary style={summaryStyle}>
        <span style={summaryCopyStyle}>
          <span style={summaryKickerStyle}>Path details</span>
          <strong>{title}</strong>
        </span>
        <span style={summaryActionStyle}>{summary}</span>
      </summary>
      <div style={detailsBodyStyle}>{children}</div>
    </details>
  )
}

function HowItWorksStep({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={stepStyle}>
      <h2 className="section-title" style={stepTitleStyle}>{title}</h2>
      <p style={stepTextStyle}>{children}</p>
    </section>
  )
}

const detailsStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.58)',
  overflow: 'hidden',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const summaryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minHeight: 54,
  padding: '10px 12px',
  color: 'var(--foreground-strong)',
  cursor: 'pointer',
  listStyle: 'none',
}

const summaryCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
}

const summaryKickerStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const summaryActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 30,
  padding: '0 9px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(155,225,29,0.08)',
  color: 'var(--brand-green)',
  fontSize: 11,
  fontWeight: 900,
  textAlign: 'center',
  whiteSpace: 'normal',
}

const detailsBodyStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  padding: '0 12px 12px',
}

const stepStyle: CSSProperties = {
  minWidth: 0,
  padding: '10px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.035)',
}

const stepTitleStyle: CSSProperties = {
  fontSize: '1.05rem',
  marginBottom: 6,
}

const stepTextStyle: CSSProperties = {
  margin: 0,
}
