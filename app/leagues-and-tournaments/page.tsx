import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import JsonLd from '@/app/components/json-ld'
import {
  CommandHero,
  PublicPageShell,
  SectionHeader,
  TrustStrip,
  pageWrapStyle,
} from '@/app/components/public-command-center'
import { TiqActionCard, TiqWorkspacePreview } from '@/app/components/tiq-product-preview-cards'
import { PRODUCT_MOTTO } from '@/lib/product-story'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Leagues & Tournaments',
  description:
    'Organize tennis leagues, tournaments, schedules, players, teams, scores, standings, entries, draws, courts, and results with less admin work.',
  path: '/leagues-and-tournaments',
})

export default function LeaguesAndTournamentsPage() {
  return (
    <PublicPageShell active="leagues-and-tournaments">
      <main style={pageWrapStyle}>
        <JsonLd
          id="leagues-tournaments-breadcrumb-jsonld"
          data={buildPublicSectionBreadcrumbJsonLd('Leagues & Tournaments', '/leagues-and-tournaments')}
        />
        <CommandHero
          eyebrow="Leagues & Tournaments"
          title="Run competition with less admin work."
          body={`${PRODUCT_MOTTO} means organizers, captains, players, and guests can find schedules, entries, scores, standings, draws, and next actions without chasing spreadsheets or scattered texts.`}
          primary={{ href: '/leagues', label: 'Find Leagues' }}
          secondary={{ href: '/tournaments', label: 'Find Tournaments' }}
          searchPlaceholder="Search leagues, tournaments, schedules, draws, standings, scores, or organizer tools"
        />

        <section style={sectionStyle} aria-labelledby="organizer-paths-title">
          <SectionHeader
            eyebrow="Organizer paths"
            title="Choose the job before the tool."
            body="Whether the competition is a season, ladder, round robin, or event weekend, the first step should be obvious from a phone."
            titleId="organizer-paths-title"
          />
          <div style={gridStyle}>
            {organizerActions.map((action) => (
              <TiqActionCard
                key={action.title}
                eyebrow={action.eyebrow}
                title={action.title}
                body={action.body}
                metrics={[...action.metrics]}
                href={action.href}
                cta={action.cta}
                event={action.event}
                trust={[...action.trust]}
              />
            ))}
          </div>
        </section>

        <section style={sectionStyle} aria-labelledby="organizer-preview-title">
          <SectionHeader
            eyebrow="What gets simpler"
            title="One competition home, clear next actions."
            body="League and tournament pages should quickly answer who is playing, when they play, where scores go, and what needs review."
            titleId="organizer-preview-title"
          />
          <div style={gridStyle}>
            <TiqWorkspacePreview
              eyebrow="League Office"
              title="Season schedule and standings"
              body="Keep players or teams, match dates, score tracking, standings, and corrections moving together."
              metrics={[
                { label: 'Schedule', value: 'Visible' },
                { label: 'Scores', value: 'Tracked' },
                { label: 'Standings', value: 'Current' },
              ]}
              href="/league-coordinator"
              cta="Open League Office"
            />
            <TiqWorkspacePreview
              eyebrow="Tournament Desk"
              title="Entries, draws, courts, results"
              body="Move from setup to draw building, court assignments, score entry, winner publishing, and alerts."
              metrics={[
                { label: 'Entries', value: 'Managed' },
                { label: 'Draws', value: 'Built' },
                { label: 'Results', value: 'Publish' },
              ]}
              href="/tournaments#desk"
              cta="Open Tournament Desk"
            />
            <TiqWorkspacePreview
              eyebrow="Data Assist"
              title="Source review before public changes"
              body="Use uploads and corrections when schedules, scorecards, rosters, teams, players, or standings need a trusted source."
              metrics={[
                { label: 'Upload', value: 'Source' },
                { label: 'Review', value: 'Required' },
                { label: 'Status', value: 'Clear' },
              ]}
              href="/data-assist?intent=upload-source&context=Leagues%20and%20Tournaments"
              cta="Open Data Assist"
            />
          </div>
        </section>

        <TrustStrip
          context="Leagues and tournaments hub trust strip"
          signals={[
            { label: 'Source', value: 'Organizer updates', tone: 'info' },
            { label: 'Freshness', value: 'Changes stay visible', tone: 'info' },
            { label: 'Confidence', value: 'Review before standings move', tone: 'warn' },
            { label: 'Status', value: 'Next action clear', tone: 'good' },
          ]}
        />
      </main>
    </PublicPageShell>
  )
}

const organizerActions = [
  {
    eyebrow: 'Find',
    title: 'Find league context',
    body: 'Search seasons, flights, standings, schedules, results, and public league pages before opening admin tools.',
    metrics: [
      { label: 'Use', value: 'Explore' },
      { label: 'Context', value: 'Public' },
      { label: 'Next', value: 'Follow' },
    ],
    href: '/leagues',
    cta: 'Find Leagues',
    event: {
      eventName: 'league_search_submitted',
      surface: 'leagues',
      metadata: { location: 'leagues_tournaments_hub' },
    },
    trust: [
      { label: 'Source', value: 'League pages', tone: 'info' },
      { label: 'Status', value: 'Public path', tone: 'good' },
    ],
  },
  {
    eyebrow: 'Run',
    title: 'Run a league season',
    body: 'Set up players or teams, organize schedules, collect scores, update standings, and reduce spreadsheet cleanup.',
    metrics: [
      { label: 'Office', value: 'League' },
      { label: 'Admin', value: 'Less' },
      { label: 'Scores', value: 'Tracked' },
    ],
    href: '/league-coordinator',
    cta: 'Open League Office',
    event: {
      eventName: 'league_office_clicked',
      surface: 'leagues',
      metadata: { location: 'leagues_tournaments_hub' },
    },
    trust: [
      { label: 'Status', value: 'Organizer path', tone: 'good' },
      { label: 'Freshness', value: 'Season updates', tone: 'info' },
    ],
  },
  {
    eyebrow: 'Event',
    title: 'Run a tournament',
    body: 'Manage entries, divisions, draws, court assignments, scores, results, winners, and participant updates.',
    metrics: [
      { label: 'Desk', value: 'Tournament' },
      { label: 'Draws', value: 'Build' },
      { label: 'Courts', value: 'Assign' },
    ],
    href: '/tournaments',
    cta: 'Find Tournaments',
    event: {
      eventName: 'tournament_search_submitted',
      surface: 'tournaments',
      metadata: { location: 'leagues_tournaments_hub' },
    },
    trust: [
      { label: 'Status', value: 'Event path', tone: 'good' },
      { label: 'Source', value: 'Tournament Desk', tone: 'info' },
    ],
  },
  {
    eyebrow: 'Fix',
    title: 'Fix schedules, rosters, or scores',
    body: 'Upload source material or request review when competition context needs a correction before users rely on it.',
    metrics: [
      { label: 'Upload', value: 'Source' },
      { label: 'Review', value: 'Needed' },
      { label: 'Trust', value: 'Clear' },
    ],
    href: '/data-assist?intent=request-review&context=Leagues%20and%20Tournaments',
    cta: 'Request Review',
    event: {
      eventName: 'data_assist_opened',
      surface: 'data_assist',
      metadata: { location: 'leagues_tournaments_hub' },
    },
    trust: [
      { label: 'Confidence', value: 'Review first', tone: 'warn' },
      { label: 'Status', value: 'Data Assist', tone: 'good' },
    ],
  },
] as const

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))',
  gap: 14,
  minWidth: 0,
}
