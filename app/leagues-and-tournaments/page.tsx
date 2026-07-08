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
import TrackedProductLink from '@/app/components/tracked-product-link'
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
            eyebrow="Organizer command path"
            title="Choose the lane, then move the season."
            body="Use one path for the work behind play: setup, event desk, score review, and public updates."
            titleId="organizer-paths-title"
          />
          <div style={organizerCommandBoardStyle}>
            <article style={organizerCommandDeskStyle}>
              <div style={organizerCommandDeskTopStyle}>
                <span style={organizerCommandBadgeStyle}>Competition desk</span>
                <TrackedProductLink
                  href="/league-coordinator"
                  style={organizerCommandTopLinkStyle}
                  event={{
                    eventName: 'league_office_clicked',
                    surface: 'leagues',
                    metadata: { location: 'leagues_tournaments_command', job: 'organize_season' },
                  }}
                >
                  Open League Office
                </TrackedProductLink>
              </div>
              <h3 style={organizerCommandDeskTitleStyle}>A cleaner path for the work behind play.</h3>
              <p style={organizerCommandDeskTextStyle}>
                Set up the competition, keep the desk moving, review scores, and send players to one public place for what changed.
              </p>
              <div style={organizerCommandMetricGridStyle}>
                <MetricTile label="Setup" value="Players + teams" />
                <MetricTile label="Desk" value="Draws + courts" />
                <MetricTile label="Publish" value="Scores + updates" accent />
              </div>
              <div style={organizerCommandActionRowStyle}>
                <TrackedProductLink
                  href="/league-coordinator/tournaments"
                  style={organizerCommandGhostLinkStyle}
                  event={{
                    eventName: 'tournament_desk_clicked',
                    surface: 'tournaments',
                    metadata: { location: 'leagues_tournaments_command', job: 'run_event_day' },
                  }}
                >
                  Open Tournament Desk
                </TrackedProductLink>
                <TrackedProductLink
                  href="/data-assist?intent=upload-source&context=Leagues%20and%20Tournaments"
                  style={organizerCommandGhostLinkStyle}
                  event={{
                    eventName: 'data_assist_opened',
                    surface: 'data_assist',
                    metadata: { location: 'leagues_tournaments_command', job: 'review_source_data' },
                  }}
                >
                  Open Data Assist
                </TrackedProductLink>
              </div>
            </article>
            <div style={organizerCommandStepListStyle}>
              {organizerActions.map((action, index) => (
                <OrganizerCommandStep key={action.title} action={action} step={index + 1} />
              ))}
            </div>
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

type OrganizerAction = (typeof organizerActions)[number]

function OrganizerCommandStep({ action, step }: { action: OrganizerAction; step: number }) {
  return (
    <article style={organizerCommandStepStyle}>
      <span style={organizerCommandStepNumberStyle}>{step}</span>
      <div style={organizerCommandStepCopyStyle}>
        <div style={organizerCommandStepTopStyle}>
          <span style={organizerCommandStepEyebrowStyle}>{action.eyebrow}</span>
          <TrackedProductLink href={action.href} style={organizerCommandStepLinkStyle} event={action.event}>
            {action.cta}
          </TrackedProductLink>
        </div>
        <h3 style={organizerCommandStepTitleStyle}>{action.title}</h3>
        <p style={organizerCommandStepBodyStyle}>{action.body}</p>
        <p style={organizerQuestionStyle}>{action.question}</p>
        <div style={organizerCommandStepMetricRowStyle}>
          {action.metrics.map((metric) => (
            <span key={metric.label} style={organizerCommandMetricPillStyle}>
              {metric.label}: {metric.value}
            </span>
          ))}
        </div>
      </div>
    </article>
  )
}

function MetricTile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ ...organizerCommandMetricTileStyle, ...(accent ? organizerCommandMetricTileAccentStyle : null) }}>
      <span style={organizerCommandMetricLabelStyle}>{label}</span>
      <strong style={organizerCommandMetricValueStyle}>{value}</strong>
    </div>
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

const organizerCommandBoardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 370px), 1fr))',
  gap: 12,
  alignItems: 'stretch',
  minWidth: 0,
  padding: 'clamp(14px, 2.4vw, 18px)',
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, var(--brand-green) 18%, var(--shell-panel-border) 82%)',
  background:
    'linear-gradient(145deg, color-mix(in srgb, var(--brand-green) 8%, var(--shell-panel-bg) 92%), rgba(8,16,34,0.78))',
  boxShadow: '0 18px 48px rgba(2,10,24,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const organizerCommandDeskStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 15,
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background:
    'linear-gradient(150deg, color-mix(in srgb, var(--brand-green) 11%, transparent), rgba(7,17,33,0.84) 48%, rgba(8,16,34,0.92))',
  overflow: 'hidden',
}

const organizerCommandDeskTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const organizerCommandBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 26,
  padding: '0 9px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-green) 11%, var(--shell-chip-bg) 89%)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const organizerCommandTopLinkStyle: CSSProperties = {
  ...organizerQuickPathCtaStyle,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 34,
  padding: '0 11px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 30%, var(--shell-panel-border) 70%)',
  background: 'rgba(7,17,33,0.66)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
}

const organizerCommandDeskTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.45rem, 2.4vw, 2rem)',
  lineHeight: 1.05,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const organizerCommandDeskTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.52,
  fontWeight: 740,
  overflowWrap: 'anywhere',
}

const organizerCommandMetricGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 118px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const organizerCommandMetricTileStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  alignContent: 'start',
  minWidth: 0,
  padding: 10,
  borderRadius: 8,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.62)',
}

const organizerCommandMetricTileAccentStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-green) 10%, rgba(7,17,33,0.62) 90%)',
}

const organizerCommandMetricLabelStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 11,
  lineHeight: 1.15,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const organizerCommandMetricValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.15,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const organizerCommandActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const organizerCommandGhostLinkStyle: CSSProperties = {
  ...organizerCommandTopLinkStyle,
  color: 'var(--brand-green)',
}

const organizerCommandStepListStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const organizerCommandStepStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '32px minmax(0, 1fr)',
  gap: 10,
  alignItems: 'start',
  minWidth: 0,
  padding: 11,
  borderRadius: 8,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.58)',
}

const organizerCommandStepNumberStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 11%, var(--shell-chip-bg) 89%)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
}

const organizerCommandStepCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
}

const organizerCommandStepTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const organizerCommandStepEyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const organizerCommandStepLinkStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
  textDecoration: 'none',
  borderBottom: '1px solid color-mix(in srgb, var(--brand-green) 46%, transparent)',
}

const organizerCommandStepTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 17,
  lineHeight: 1.12,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const organizerCommandStepBodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.42,
  fontWeight: 730,
  overflowWrap: 'anywhere',
}

const organizerCommandStepMetricRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  minWidth: 0,
}

const organizerCommandMetricPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 24,
  padding: '0 8px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(8,16,34,0.66)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 800,
  overflowWrap: 'anywhere',
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
