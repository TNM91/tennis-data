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
import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Tournaments',
  description:
    'Tournament tennis without the chaos. Find events, manage entries and draws, schedule courts, collect scores, publish results, and keep players informed.',
  path: '/tournaments',
})

const tournamentDeskHref = '/join?plan=full_court&next=%2Fleague-coordinator%2Ftournaments'
const TOURNAMENT_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('pressure-closer-4-0')
const TOURNAMENT_PLAYER_IDENTITY_READ = getPlayerDevelopmentIdentityActionRead(TOURNAMENT_PLAYER_IDENTITY)
const TOURNAMENT_LEVEL_UP_HREF = `/level-up/${TOURNAMENT_PLAYER_IDENTITY.slug}`
const TOURNAMENT_PLAYER_DEVELOPMENT_HREF = `/player-development/${TOURNAMENT_PLAYER_IDENTITY.slug}`
const tournamentPlayerIdPrepItems = [
  { label: 'Draw read', value: TOURNAMENT_PLAYER_IDENTITY_READ.matchTrigger },
  { label: 'Pressure proof', value: TOURNAMENT_PLAYER_IDENTITY_READ.proofTarget },
  { label: 'Next cue', value: TOURNAMENT_PLAYER_IDENTITY_READ.nextCue },
] as const
const tournamentPlayerIdActions = [
  { href: TOURNAMENT_LEVEL_UP_HREF, label: 'Start Level Up' },
  { href: TOURNAMENT_PLAYER_DEVELOPMENT_HREF, label: 'Read Player ID' },
  { href: '/matchup', label: 'Prep matchup' },
] as const

export default function TournamentsPage() {
  return (
    <PublicPageShell active="tournaments">
      <main style={pageWrapStyle}>
        <JsonLd id="tournaments-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Tournaments', '/tournaments')} />
        <CommandHero
          eyebrow="Tournaments"
          title="Tournament tennis without the chaos."
          body="Find events, manage entries and draws, schedule courts, collect scores, publish results, and keep players informed."
          primary={{ href: '#find', label: 'Find Tournaments' }}
          secondary={{ href: '#desk', label: 'Run a Tournament' }}
          searchPlaceholder="Search tournaments, draws, divisions, round robins, court schedules, or results"
        />
        <section style={nextActionSectionStyle} aria-labelledby="tournament-next-actions-title">
          <SectionHeader
            eyebrow="Tournament next actions"
            title="Pick the event need, then open the right tournament path."
            body="Tournaments need clear paths for players, directors, court scheduling, scores, and corrections. Start with the area that needs attention now."
            titleId="tournament-next-actions-title"
          />
          <div style={nextActionGridStyle}>
            {tournamentNextActions.map((action) => (
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
        <section style={tournamentPlayerIdPrepStyle} aria-label="Tournament Player ID prep bridge">
          <div style={tournamentPlayerIdPrepCopyStyle}>
            <span style={tournamentPlayerIdPrepEyebrowStyle}>Tournament to Player ID</span>
            <h2 style={tournamentPlayerIdPrepTitleStyle}>Turn the draw into one pressure cue.</h2>
            <p style={tournamentPlayerIdPrepTextStyle}>
              {TOURNAMENT_PLAYER_IDENTITY_READ.levelUpNudge} Use Player ID when the event question shifts from where to play into how to handle the next score moment.
            </p>
          </div>
          <div style={tournamentPlayerIdPrepGridStyle} aria-label="Tournament Player ID starter read">
            {tournamentPlayerIdPrepItems.map((item) => (
              <div key={item.label} style={tournamentPlayerIdPrepCardStyle}>
                <span style={tournamentPlayerIdPrepLabelStyle}>{item.label}</span>
                <strong style={tournamentPlayerIdPrepValueStyle}>{item.value}</strong>
              </div>
            ))}
          </div>
          <div style={tournamentPlayerIdActionRowStyle}>
            {tournamentPlayerIdActions.map((action, index) => (
              <a
                key={action.href}
                href={action.href}
                style={index === 0 ? { ...tournamentPlayerIdActionStyle, ...tournamentPlayerIdPrimaryActionStyle } : tournamentPlayerIdActionStyle}
              >
                {action.label}
              </a>
            ))}
          </div>
        </section>
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
          rightBody="Create divisions, manage entries, build draws, schedule courts, track scores, publish results, and reduce event admin."
        />
        <section style={flowSectionStyle} aria-labelledby="tournament-flow-title">
          <SectionHeader
            eyebrow="Tournament flow"
            title="From entry to results, keep the event moving."
            body="Each tournament path has a clear next action so players know where to go and directors know what still needs attention."
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
            body="Tournament Desk keeps entries, schedules, scores, player updates, results, and awards together so event work does not sprawl."
          />
          <div style={previewGridStyle}>
            <TiqTournamentDrawCard
              title="Summer Doubles Classic"
              body="Divisions are open, entries are reviewed, and court blocks are ready for schedule decisions."
              metrics={[
                { label: 'Entries', value: '28' },
                { label: 'Draws', value: 'Draft' },
                { label: 'Courts', value: '6' },
              ]}
              href={tournamentDeskHref}
              cta="Open Tournament Desk"
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
              body="Publish scores, winners, awards, and player-facing recaps after the final result is clear."
              metrics={[
                { label: 'Pending', value: 'Clear' },
                { label: 'Winners', value: 'Ready' },
                { label: 'Notify', value: 'Players' },
              ]}
              href={tournamentDeskHref}
              cta="Open Tournament Desk"
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
            context="Tournaments trust strip"
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

const tournamentNextActions = [
  {
    eyebrow: 'Find',
    title: 'Find an event to play',
    body: 'Search event pages by tournament, division, format, schedule, or location before entering.',
    metrics: [
      { label: 'Search', value: 'Events' },
      { label: 'Browse', value: 'Divisions' },
      { label: 'Next', value: 'Enter' },
    ],
    href: '#find',
    cta: 'Find Tournaments',
    event: {
      eventName: 'tournament_search_submitted',
      surface: 'tournaments',
      metadata: {
        location: 'tournament_next_actions',
      },
    },
    trust: [
      { label: 'Source', value: 'Public event pages', tone: 'info' },
      { label: 'Status', value: 'Discovery ready', tone: 'good' },
    ],
  },
  {
    eyebrow: 'Draws',
    title: 'Follow a draw or court',
    body: 'See divisions, court blocks, match order, and what players need before the next round.',
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
        location: 'tournament_next_actions',
      },
    },
    trust: [
      { label: 'Freshness', value: 'Director updates', tone: 'good' },
      { label: 'Confidence', value: 'Medium until published', tone: 'warn' },
    ],
  },
  {
    eyebrow: 'Run',
    title: 'Run the event desk',
    body: 'Open Tournament Desk when entries, draws, court times, scores, results, and player updates need one tournament run sheet.',
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
        location: 'tournament_next_actions',
      },
    },
    trust: [
      { label: 'Status', value: 'Organizer Hub', tone: 'info' },
      { label: 'Source', value: 'Tournament Desk', tone: 'good' },
    ],
  },
  {
    eyebrow: 'Organize',
    title: 'Plan the full competition',
    body: 'Use the Leagues & Tournaments hub when schedules, standings, draws, teams, players, and score workflows need one organizer path.',
    metrics: [
      { label: 'Hub', value: 'Leagues + events' },
      { label: 'Work', value: 'Organize' },
      { label: 'Next', value: 'Choose path' },
    ],
    href: '/leagues-and-tournaments',
    cta: 'Open Organizer Hub',
    event: {
      eventName: 'league_office_clicked',
      surface: 'leagues',
      metadata: {
        location: 'tournament_next_actions',
        job: 'organize_competition',
      },
    },
    trust: [
      { label: 'Status', value: 'Public organizer path', tone: 'good' },
      { label: 'Source', value: 'TenAceIQ hub', tone: 'info' },
    ],
  },
  {
    eyebrow: 'Fix data',
    title: 'Report a draw or result issue',
    body: 'Use Data Assist when entries, draws, court times, scores, winners, or awards need a reviewed source.',
    metrics: [
      { label: 'Upload', value: 'Source' },
      { label: 'Review', value: 'Required' },
      { label: 'Feeds', value: 'Results' },
    ],
    href: '/data-assist?intent=request-review&context=Tournament%20Desk',
    cta: 'Open Data Assist',
    event: {
      eventName: 'data_assist_opened',
      surface: 'data_assist',
      metadata: {
        location: 'tournament_next_actions',
      },
    },
    trust: [
      { label: 'Source', value: 'User upload', tone: 'info' },
      { label: 'Status', value: 'Review before publish', tone: 'warn' },
    ],
  },
] as const

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
    body: 'Collect scores, resolve corrections, and update winners, standings, and awards.',
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
    body: 'Open Tournament Desk when entries, draws, courts, results, and notifications need one tournament run sheet.',
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
      { label: 'Status', value: 'Organizer Hub', tone: 'info' },
      { label: 'Source', value: 'Tournament Desk', tone: 'good' },
    ],
  },
] as const

const findSectionStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const nextActionSectionStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const nextActionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const tournamentPlayerIdPrepStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: 14,
  alignItems: 'center',
  padding: 16,
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, var(--brand-green) 20%, var(--shell-panel-border) 80%)',
  background: 'color-mix(in srgb, var(--brand-green) 7%, var(--shell-panel-bg) 93%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
  overflow: 'hidden',
  overflowWrap: 'anywhere',
}

const tournamentPlayerIdPrepCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
}

const tournamentPlayerIdPrepEyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const tournamentPlayerIdPrepTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(20px, 5vw, 28px)',
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const tournamentPlayerIdPrepTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const tournamentPlayerIdPrepGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const tournamentPlayerIdPrepCardStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  minHeight: 78,
  padding: 10,
  borderRadius: 8,
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 74%, transparent 26%)',
  overflowWrap: 'anywhere',
}

const tournamentPlayerIdPrepLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const tournamentPlayerIdPrepValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const tournamentPlayerIdActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-start',
  gap: 9,
  minWidth: 0,
}

const tournamentPlayerIdActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  minHeight: 38,
  minWidth: 0,
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 76%, transparent 24%)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 950,
  textAlign: 'center',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const tournamentPlayerIdPrimaryActionStyle: CSSProperties = {
  borderColor: 'color-mix(in srgb, var(--brand-green) 36%, var(--shell-panel-border) 64%)',
  background: 'color-mix(in srgb, var(--brand-green) 14%, var(--shell-chip-bg) 86%)',
  color: 'var(--foreground-strong)',
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
