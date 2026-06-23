import type { Metadata } from 'next'
import Link from 'next/link'
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

        <section style={organizerQuickPathStyle} aria-labelledby="organizer-quick-path-title">
          <div style={organizerQuickPathHeaderStyle}>
            <p style={organizerQuickPathEyebrowStyle}>Organizer quick path</p>
            <h2 id="organizer-quick-path-title" style={organizerQuickPathTitleStyle}>
              What needs organizing first?
            </h2>
            <p style={organizerQuickPathTextStyle}>
              Pick the tennis need in front of you, then open the path for schedules, players, scores, events, or source review.
            </p>
          </div>
          <div style={organizerQuickPathGridStyle}>
            {organizerQuickPaths.map((path) => (
              <Link
                key={path.job}
                href={path.href}
                style={organizerQuickPathCardStyle}
                aria-label={`${path.cta}: ${path.question}`}
                data-organizer-path-job={path.job}
              >
                <span style={organizerQuickPathQuestionStyle}>{path.question}</span>
                <strong style={organizerQuickPathCtaStyle}>{path.cta}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section style={sectionStyle} aria-labelledby="organizer-paths-title">
          <SectionHeader
            eyebrow="Organizer work path"
            title="Set up, schedule, score, publish."
            body="Start with the organizer need in front of you: organize schedules, manage players or teams, track scores, publish updates, and reduce admin work."
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
              >
                <p style={organizerQuestionStyle}>{action.question}</p>
              </TiqActionCard>
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
              event={{
                eventName: 'league_office_clicked',
                surface: 'leagues',
                metadata: { location: 'leagues_tournaments_preview', job: 'organize_season' },
              }}
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
              event={{
                eventName: 'tournament_desk_clicked',
                surface: 'tournaments',
                metadata: { location: 'leagues_tournaments_preview', job: 'run_event_day' },
              }}
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
              event={{
                eventName: 'data_assist_opened',
                surface: 'data_assist',
                metadata: { location: 'leagues_tournaments_preview', job: 'review_source_data' },
              }}
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

const organizerQuickPaths = [
  {
    question: 'How do I organize schedules?',
    cta: 'Open Schedule Setup',
    href: '/league-coordinator',
    job: 'organize_schedules',
  },
  {
    question: 'How do I manage players or teams?',
    cta: 'Open League Office',
    href: '/league-coordinator',
    job: 'manage_players_teams',
  },
  {
    question: 'How do I track scores?',
    cta: 'Open Results',
    href: '/league-coordinator/results',
    job: 'track_scores',
  },
  {
    question: 'How do I run the event desk?',
    cta: 'Open Tournament Desk',
    href: '/league-coordinator/tournaments',
    job: 'run_event_desk',
  },
  {
    question: 'What needs source review?',
    cta: 'Open Data Assist',
    href: '/data-assist?intent=upload-source&context=Leagues%20and%20Tournaments%20quick%20path',
    job: 'review_source_data',
  },
] as const

const organizerActions = [
  {
    eyebrow: 'Setup',
    title: 'Set up a league',
    question: 'How do I organize the season before players start asking where everything lives?',
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
      metadata: { location: 'leagues_tournaments_hub', job: 'organize_season' },
    },
    trust: [
      { label: 'Status', value: 'Organizer path', tone: 'good' },
      { label: 'Admin', value: 'Less cleanup', tone: 'info' },
    ],
  },
  {
    eyebrow: 'Event',
    title: 'Set up a tournament',
    question: 'How do I manage entries, draws, courts, and event-day movement?',
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
      metadata: { location: 'leagues_tournaments_hub', job: 'run_event_day' },
    },
    trust: [
      { label: 'Status', value: 'Event path', tone: 'good' },
      { label: 'Desk', value: 'Tournament', tone: 'info' },
    ],
  },
  {
    eyebrow: 'Scores',
    title: 'Track scores',
    question: 'Where do scores go, and what needs review before standings move?',
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
      metadata: { location: 'leagues_tournaments_hub', job: 'track_scores' },
    },
    trust: [
      { label: 'Freshness', value: 'Results path', tone: 'info' },
      { label: 'Status', value: 'Ready to post', tone: 'good' },
    ],
  },
  {
    eyebrow: 'Publish',
    title: 'Publish updates',
    question: 'How do I give everyone one place to check schedules, results, and corrections?',
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
      metadata: { location: 'leagues_tournaments_hub', job: 'publish_updates' },
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

const organizerQuickPathStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
  gap: 14,
  alignItems: 'stretch',
  minWidth: 0,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  borderRadius: 8,
  padding: 'clamp(14px, 3vw, 20px)',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--brand-green) 10%, var(--shell-panel-bg) 90%), color-mix(in srgb, var(--brand-blue-2) 8%, var(--shell-panel-bg) 92%))',
}

const organizerQuickPathHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  alignContent: 'center',
  minWidth: 0,
}

const organizerQuickPathEyebrowStyle: CSSProperties = {
  margin: 0,
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const organizerQuickPathTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(21px, 3vw, 30px)',
  lineHeight: 1.08,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const organizerQuickPathTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const organizerQuickPathGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 175px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const organizerQuickPathCardStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minHeight: 104,
  minWidth: 0,
  alignContent: 'space-between',
  padding: 13,
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 78%, var(--brand-blue-2) 22%)',
  color: 'inherit',
  textDecoration: 'none',
}

const organizerQuickPathQuestionStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.25,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const organizerQuickPathCtaStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  lineHeight: 1.25,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const organizerQuestionStyle: CSSProperties = {
  margin: 0,
  borderTop: '1px solid var(--shell-panel-border)',
  paddingTop: 10,
  color: 'var(--brand-green)',
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}
