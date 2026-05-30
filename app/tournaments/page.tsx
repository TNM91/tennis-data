import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import JsonLd from '@/app/components/json-ld'
import {
  CommandHero,
  PublicPageShell,
  SectionHeader,
  TrustStrip,
  TwoColumnStory,
  pageWrapStyle,
} from '@/app/components/public-command-center'
import { TiqActionCard, TiqTournamentDrawCard, TiqWorkspacePreview } from '@/app/components/tiq-product-preview-cards'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Tournaments',
  description:
    'Tournament tennis without the chaos. Find tournaments, enter events, manage draws, schedule courts, collect results, and keep players informed.',
  path: '/tournaments',
})

const tournamentDeskHref = '/join?plan=full_court&next=%2Fleague-coordinator%2Ftournaments'

export default function TournamentsPage() {
  return (
    <PublicPageShell active="tournaments">
      <main style={pageWrapStyle}>
        <JsonLd id="tournaments-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Tournaments', '/tournaments')} />
        <CommandHero
          eyebrow="Tournaments"
          title="Tournament tennis without the chaos."
          body="Find tournaments, enter events, manage draws, schedule courts, collect results, and keep players informed."
          primary={{ href: '#find', label: 'Find Tournaments' }}
          secondary={{ href: '#desk', label: 'Run a Tournament' }}
          searchPlaceholder="Search tournaments, draws, divisions, round robins, court schedules, or results"
        />
        <section id="find" style={findSectionStyle} aria-labelledby="tournament-find-title">
          <SectionHeader
            eyebrow="Find tournaments"
            title="Search events, follow draws, or check results."
            body="Tournament discovery should answer the next practical question: where can I play, when do I play, and what happened?"
            titleId="tournament-find-title"
          />
          <div style={discoveryGridStyle}>
            {tournamentDiscoveryCards.map((card) => (
              <TiqActionCard
                key={card.title}
                eyebrow="Tournament discovery"
                title={card.title}
                body={card.body}
                metrics={[...card.metrics]}
                href={card.href}
                cta={card.cta}
                event={card.event}
                trust={[...card.trust]}
              />
            ))}
          </div>
        </section>
        <TwoColumnStory
          leftTitle="For players"
          leftBody="Find events, view divisions, see draws, know your schedule, and follow results."
          rightTitle="For organizers"
          rightBody="Create divisions, manage entries, build draws, schedule courts, collect scores, and publish results."
        />
        <section style={flowSectionStyle} aria-labelledby="tournament-flow-title">
          <SectionHeader
            eyebrow="Tournament flow"
            title="From entry to results, keep the event moving."
            body="Each tournament job has a clear next action so players know where to go and directors know what still needs attention."
            titleId="tournament-flow-title"
          />
          <ol style={flowGridStyle}>
            {tournamentFlow.map((step) => (
              <li key={step.title} style={flowStepStyle}>
                <span style={flowStepNumberStyle}>{step.step}</span>
                <div style={flowStepCopyStyle}>
                  <h2 style={flowStepTitleStyle}>{step.title}</h2>
                  <p style={flowStepBodyStyle}>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section id="desk" style={{ display: 'grid', gap: 14 }}>
          <SectionHeader
            eyebrow="Tournament Desk"
            title="Entries, draws, courts, results, winners."
            body="Tournament results should feed player profiles, My Lab, Matchup, Coach Hub, rankings, and team or league context where appropriate."
          />
          <div style={previewGridStyle}>
            <TiqTournamentDrawCard
              title="Summer Doubles Classic"
              body="Divisions are open, entries are reviewed, and court blocks are drafted."
              metrics={[
                { label: 'Entries', value: '28' },
                { label: 'Draws', value: 'Draft' },
                { label: 'Courts', value: '6' },
              ]}
              href={tournamentDeskHref}
              cta="Preview Draw"
              event={{
                eventName: 'draw_preview_clicked',
                surface: 'tournaments',
                metadata: {
                  location: 'tournaments_draw_preview',
                },
              }}
              trust={[
                { label: 'Source', value: 'Organizer draft', tone: 'info' },
                { label: 'Freshness', value: 'Updated today', tone: 'good' },
                { label: 'Confidence', value: 'Medium', tone: 'warn' },
                { label: 'Status', value: 'Draws reviewable', tone: 'good' },
              ]}
            />
            <TiqWorkspacePreview
              eyebrow="Results"
              title="Finals and awards"
              body="Publish outcomes, standings, winners, and award-ready recaps."
              metrics={[
                { label: 'Pending', value: 'Clear' },
                { label: 'Winners', value: 'Ready' },
                { label: 'Notify', value: 'Players' },
              ]}
              href={tournamentDeskHref}
              cta="Publish Results"
              event={{
                eventName: 'tournament_desk_clicked',
                surface: 'tournaments',
                metadata: {
                  location: 'tournaments_results_preview',
                },
              }}
              trust={[
                { label: 'Source', value: 'Director entry', tone: 'info' },
                { label: 'Freshness', value: 'Live event', tone: 'good' },
                { label: 'Confidence', value: 'High after review', tone: 'good' },
                { label: 'Status', value: 'Pending publish', tone: 'warn' },
              ]}
            />
          </div>
          <TrustStrip
            signals={[
              { label: 'Source', value: 'Tournament Desk', tone: 'info' },
              { label: 'Freshness', value: 'Schedule changes visible', tone: 'good' },
              { label: 'Confidence', value: 'Improves after score review', tone: 'warn' },
              { label: 'Status', value: 'Players can report issues', tone: 'good' },
            ]}
          />
        </section>
      </main>
    </PublicPageShell>
  )
}

const tournamentFlow = [
  {
    step: '01',
    title: 'Event setup',
    body: 'Name the event, set divisions, add entry rules, and publish the player-facing page.',
  },
  {
    step: '02',
    title: 'Entries',
    body: 'Collect players or teams, review duplicates, and keep the accepted list clean.',
  },
  {
    step: '03',
    title: 'Draws and courts',
    body: 'Build draws, assign courts, and make schedule changes visible before match time.',
  },
  {
    step: '04',
    title: 'Results',
    body: 'Collect scores, resolve corrections, and update standings, winners, and awards.',
  },
  {
    step: '05',
    title: 'Player notifications',
    body: 'Keep players informed about schedules, court moves, results, and event updates.',
  },
] as const

const tournamentDiscoveryCards = [
  {
    title: 'Find events',
    body: 'Search public event pages by tournament, division, format, schedule, or location.',
    metrics: [
      { label: 'Search', value: 'Events' },
      { label: 'Browse', value: 'Divisions' },
      { label: 'Next', value: 'Enter' },
    ],
    href: '/explore/search?q=tournament',
    cta: 'Search Events',
    event: {
      eventName: 'tournament_search_submitted',
      surface: 'tournaments',
      metadata: {
        location: 'tournaments_find_events',
      },
    },
    trust: [
      { label: 'Source', value: 'Public event pages', tone: 'info' },
      { label: 'Status', value: 'Discovery ready', tone: 'good' },
    ],
  },
  {
    title: 'Follow a draw',
    body: 'Scan divisions, match order, court blocks, and what players need before the next round.',
    metrics: [
      { label: 'Draws', value: 'Draft' },
      { label: 'Courts', value: 'Assigned' },
      { label: 'Watch', value: 'Next match' },
    ],
    href: '#desk',
    cta: 'Preview Draws',
    event: {
      eventName: 'draw_preview_clicked',
      surface: 'tournaments',
      metadata: {
        location: 'tournaments_follow_draw',
      },
    },
    trust: [
      { label: 'Freshness', value: 'Director updates', tone: 'good' },
      { label: 'Confidence', value: 'Medium until published', tone: 'warn' },
    ],
  },
  {
    title: 'Run an event',
    body: 'Open Tournament Desk when entries, draws, courts, results, and notifications need one place.',
    metrics: [
      { label: 'Desk', value: 'Full-Court' },
      { label: 'Results', value: 'Reviewable' },
      { label: 'Notify', value: 'Players' },
    ],
    href: tournamentDeskHref,
    cta: 'Open Desk',
    event: {
      eventName: 'run_tournament_clicked',
      surface: 'tournaments',
      metadata: {
        location: 'tournaments_run_event',
      },
    },
    trust: [
      { label: 'Status', value: 'Organizer workspace', tone: 'info' },
      { label: 'Source', value: 'Tournament Desk', tone: 'good' },
    ],
  },
] as const

const findSectionStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const discoveryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const previewGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const flowSectionStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const flowGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 10,
  minWidth: 0,
  margin: 0,
  padding: 0,
  listStyle: 'none',
}

const flowStepStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: 10,
  alignItems: 'start',
  minWidth: 0,
  padding: 14,
  borderRadius: 8,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
}

const flowStepNumberStyle: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 34,
  height: 34,
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 30%, var(--shell-panel-border) 70%)',
  background: 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-chip-bg) 88%)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  lineHeight: 1,
}

const flowStepCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
}

const flowStepTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.2,
  fontWeight: 900,
}

const flowStepBodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 650,
}
