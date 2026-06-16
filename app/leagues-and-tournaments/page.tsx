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
            eyebrow="Organizer work path"
            title="Set up, schedule, score, publish."
            body="Start with the job you need to finish: organize schedules, manage players or teams, track scores, publish updates, and reduce admin work."
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
    eyebrow: 'Setup',
    title: 'Set up a league',
    body: 'Create the season structure, add players or teams, organize flights, and make the next admin step clear.',
    metrics: [
      { label: 'Players', value: 'Managed' },
      { label: 'Teams', value: 'Ready' },
      { label: 'Flights', value: 'Clear' },
    ],
    href: '/league-coordinator',
    cta: 'Set Up League',
    event: {
      eventName: 'league_office_clicked',
      surface: 'leagues',
      metadata: { location: 'leagues_tournaments_hub' },
    },
    trust: [
      { label: 'Status', value: 'Organizer path', tone: 'good' },
      { label: 'Admin', value: 'Less cleanup', tone: 'info' },
    ],
  },
  {
    eyebrow: 'Event',
    title: 'Set up a tournament',
    body: 'Manage entries, divisions, seeds, draws, courts, and the decisions that keep event day moving.',
    metrics: [
      { label: 'Entries', value: 'Open' },
      { label: 'Draws', value: 'Built' },
      { label: 'Courts', value: 'Assigned' },
    ],
    href: '/league-coordinator/tournaments',
    cta: 'Set Up Tournament',
    event: {
      eventName: 'tournament_desk_clicked',
      surface: 'tournaments',
      metadata: { location: 'leagues_tournaments_hub' },
    },
    trust: [
      { label: 'Status', value: 'Event path', tone: 'good' },
      { label: 'Desk', value: 'Tournament', tone: 'info' },
    ],
  },
  {
    eyebrow: 'Scores',
    title: 'Track scores',
    body: 'Enter team results, review scorecards, keep standings current, and cut down on text-thread follow-ups.',
    metrics: [
      { label: 'Scores', value: 'Tracked' },
      { label: 'Review', value: 'Clear' },
      { label: 'Standings', value: 'Current' },
    ],
    href: '/league-coordinator/results',
    cta: 'Track Scores',
    event: {
      eventName: 'standings_preview_clicked',
      surface: 'leagues',
      metadata: { location: 'leagues_tournaments_hub' },
    },
    trust: [
      { label: 'Freshness', value: 'Results path', tone: 'info' },
      { label: 'Status', value: 'Ready to post', tone: 'good' },
    ],
  },
  {
    eyebrow: 'Publish',
    title: 'Publish updates',
    body: 'Send players to one public home for schedules, scores, standings, results, and corrections they can trust.',
    metrics: [
      { label: 'Schedules', value: 'Visible' },
      { label: 'Results', value: 'Posted' },
      { label: 'Questions', value: 'Fewer' },
    ],
    href: '/leagues',
    cta: 'Publish Updates',
    event: {
      eventName: 'league_search_submitted',
      surface: 'leagues',
      metadata: { location: 'leagues_tournaments_hub' },
    },
    trust: [
      { label: 'Source', value: 'Public pages', tone: 'info' },
      { label: 'Confidence', value: 'Shared view', tone: 'good' },
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
