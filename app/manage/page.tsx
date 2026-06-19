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
  title: 'Manage Tennis',
  description:
    'Manage team tennis, league seasons, tournament desks, schedules, availability, scores, rosters, and communication with less chaos.',
  path: '/manage',
})

export default function ManagePage() {
  return (
    <PublicPageShell active="manage">
      <main style={pageWrapStyle}>
        <JsonLd id="manage-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Manage', '/manage')} />
        <CommandHero
          eyebrow="Manage"
          title="Run tennis with fewer loose ends."
          body={`${PRODUCT_MOTTO} means availability, schedules, lineups, rosters, results, and messages should be easy to find and easy to act on from a phone.`}
          primary={{ href: '/captain', label: 'Manage My Team' }}
          secondary={{ href: '/leagues-and-tournaments', label: 'Run a League or Tournament' }}
          searchPlaceholder="Search teams, leagues, tournaments, schedules, scorecards, or captain tools"
        />

        <section style={quickPathStyle} aria-labelledby="manage-quick-path-title">
          <div style={quickPathHeaderStyle}>
            <p style={quickPathEyebrowStyle}>Pick your job</p>
            <h2 id="manage-quick-path-title" style={quickPathTitleStyle}>
              What are you trying to organize right now?
            </h2>
            <p style={quickPathBodyStyle}>
              Choose the closest path, then TenAceIQ keeps the next step focused on less admin and more tennis.
            </p>
          </div>
          <div style={quickPathGridStyle}>
            {manageQuickPaths.map((path) => (
              <Link
                key={path.job}
                href={path.href}
                style={quickPathCardStyle}
                data-manage-path-job={path.job}
              >
                <span style={quickPathRoleStyle}>{path.role}</span>
                <strong style={quickPathQuestionStyle}>{path.question}</strong>
                <span style={quickPathCtaStyle}>{path.cta}</span>
              </Link>
            ))}
          </div>
        </section>

        <section style={sectionStyle} aria-labelledby="manage-actions-title">
          <SectionHeader
            eyebrow="Manage paths"
            title="Start with the job that is causing the chaos."
            body="TenAceIQ organizes management work around the next practical action, not a complicated dashboard."
            titleId="manage-actions-title"
          />
          <div style={gridStyle}>
            {manageActions.map((action) => (
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
                <p style={actionQuestionStyle}>{action.question}</p>
              </TiqActionCard>
            ))}
          </div>
        </section>

        <section style={sectionStyle} aria-labelledby="manage-preview-title">
          <SectionHeader
            eyebrow="What gets simpler"
            title="The same tennis week, with fewer scattered tools."
            body="Captains, coordinators, and tournament directors should be able to answer the most important questions in seconds."
            titleId="manage-preview-title"
          />
          <div style={gridStyle}>
            <TiqWorkspacePreview
              eyebrow="Captain"
              title="Who can play?"
              body="Collect availability, see response risk, build lineups, and send the team plan."
              metrics={[
                { label: 'Availability', value: 'Visible' },
                { label: 'Lineup', value: 'Ready' },
                { label: 'Message', value: 'Next' },
              ]}
              href="/captain/availability"
              cta="Check Availability"
              event={{
                eventName: 'availability_clicked',
                surface: 'captain',
                metadata: { location: 'manage_preview', job: 'manage_team_week' },
              }}
            />
            <TiqWorkspacePreview
              eyebrow="League"
              title="What needs admin attention?"
              body="Keep teams, players, schedules, standings, results, and corrections in one season path."
              metrics={[
                { label: 'Schedule', value: 'Organized' },
                { label: 'Scores', value: 'Tracked' },
                { label: 'Roster', value: 'Clear' },
              ]}
              href="/league-coordinator"
              cta="Open League Office"
              event={{
                eventName: 'league_office_clicked',
                surface: 'leagues',
                metadata: { location: 'manage_preview', job: 'run_league_season' },
              }}
            />
            <TiqWorkspacePreview
              eyebrow="Tournament"
              title="What keeps the event moving?"
              body="Set divisions, manage entries, build draws, assign courts, collect scores, and publish winners."
              metrics={[
                { label: 'Entries', value: 'Managed' },
                { label: 'Draws', value: 'Ready' },
                { label: 'Results', value: 'Publish' },
              ]}
              href="/tournaments#desk"
              cta="Open Tournament Desk"
              event={{
                eventName: 'tournament_desk_clicked',
                surface: 'tournaments',
                metadata: { location: 'manage_preview', job: 'run_event_desk' },
              }}
            />
          </div>
        </section>

        <TrustStrip
          context="Manage hub trust strip"
          signals={[
            { label: 'Source', value: 'Team and event inputs', tone: 'info' },
            { label: 'Freshness', value: 'Updated as work moves', tone: 'info' },
            { label: 'Confidence', value: 'Improves with reviewed data', tone: 'warn' },
            { label: 'Status', value: 'Action ready', tone: 'good' },
          ]}
        />
      </main>
    </PublicPageShell>
  )
}

const manageQuickPaths = [
  {
    role: 'Captain',
    question: 'Who is available and what lineup should I send?',
    cta: 'Manage My Team',
    href: '/captain',
    job: 'manage_team_week',
  },
  {
    role: 'League coordinator',
    question: 'How do I organize schedules, teams, scores, and standings?',
    cta: 'Open League Office',
    href: '/league-coordinator',
    job: 'run_league_season',
  },
  {
    role: 'Tournament director',
    question: 'How do I keep entries, courts, draws, and results moving?',
    cta: 'Open Tournament Desk',
    href: '/tournaments#desk',
    job: 'run_event_desk',
  },
  {
    role: 'Data helper',
    question: 'What scorecard, roster, or schedule needs review?',
    cta: 'Refresh Tennis Context',
    href: '/data-assist?intent=upload-source&context=Manage%20quick%20path',
    job: 'refresh_management_context',
  },
] as const

const manageActions = [
  {
    eyebrow: 'Captain',
    title: 'Manage the team week',
    question: 'Who is available, what lineup should we send, and what needs to be communicated?',
    body: 'Answer who is available, what lineup gives the team the best chance, who should play together, and what to send.',
    metrics: [
      { label: 'Availability', value: 'Team' },
      { label: 'Lineups', value: 'Compare' },
      { label: 'Next', value: 'Send' },
    ],
    href: '/captain',
    cta: 'Manage My Team',
    event: {
      eventName: 'captain_tools_clicked',
      surface: 'teams',
      metadata: { location: 'manage_hub', job: 'manage_team_week' },
    },
    trust: [
      { label: 'Status', value: 'Captain path', tone: 'good' },
      { label: 'Source', value: 'Team context', tone: 'info' },
    ],
  },
  {
    eyebrow: 'League',
    title: 'Run a cleaner season',
    question: 'How do I keep schedules, players, teams, scores, and standings organized?',
    body: 'Organize schedules, manage players or teams, track scores, update standings, and reduce spreadsheet work.',
    metrics: [
      { label: 'Schedule', value: 'Season' },
      { label: 'Scores', value: 'Review' },
      { label: 'Admin', value: 'Less' },
    ],
    href: '/league-coordinator',
    cta: 'Open League Office',
    event: {
      eventName: 'league_office_clicked',
      surface: 'leagues',
      metadata: { location: 'manage_hub', job: 'run_league_season' },
    },
    trust: [
      { label: 'Status', value: 'Organizer path', tone: 'good' },
      { label: 'Source', value: 'League Office', tone: 'info' },
    ],
  },
  {
    eyebrow: 'Tournament',
    title: 'Run an event desk',
    question: 'How do I keep entries, draws, courts, scores, and winners moving?',
    body: 'Set up divisions, manage entries, build draws, schedule courts, track scores, and publish outcomes.',
    metrics: [
      { label: 'Entries', value: 'Open' },
      { label: 'Courts', value: 'Assign' },
      { label: 'Results', value: 'Publish' },
    ],
    href: '/tournaments#desk',
    cta: 'Run a Tournament',
    event: {
      eventName: 'tournament_desk_clicked',
      surface: 'tournaments',
      metadata: { location: 'manage_hub', job: 'run_event_desk' },
    },
    trust: [
      { label: 'Status', value: 'Event path', tone: 'good' },
      { label: 'Freshness', value: 'Director updated', tone: 'info' },
    ],
  },
  {
    eyebrow: 'Organizer hub',
    title: 'Choose the right league or tournament path',
    question: 'Which path fits the work: league season, tournament desk, or both?',
    body: 'Use the combined organizer hub when schedules, standings, draws, players, teams, scores, and event work overlap.',
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
        location: 'manage_hub',
        job: 'organize_competition',
      },
    },
    trust: [
      { label: 'Status', value: 'Public organizer path', tone: 'good' },
      { label: 'Source', value: 'TenAceIQ hub', tone: 'info' },
    ],
  },
  {
    eyebrow: 'Data Assist',
    title: 'Fix the source of confusion',
    question: 'What source needs review before it shapes the tennis context?',
    body: 'Upload scorecards, schedules, rosters, team summaries, or corrections when the tennis context needs review.',
    metrics: [
      { label: 'Upload', value: 'Source' },
      { label: 'Review', value: 'Needed' },
      { label: 'Feeds', value: 'Tennis context' },
    ],
    href: '/data-assist?intent=upload-source&context=Manage%20hub',
    cta: 'Open Data Assist',
    event: {
      eventName: 'data_assist_opened',
      surface: 'data_assist',
      metadata: { location: 'manage_hub', job: 'fix_source_confusion' },
    },
    trust: [
      { label: 'Source', value: 'User upload', tone: 'info' },
      { label: 'Status', value: 'Review before use', tone: 'warn' },
    ],
  },
] as const

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const quickPathStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
  gap: 16,
  alignItems: 'stretch',
  minWidth: 0,
  border: '1px solid rgba(50, 255, 126, 0.22)',
  borderRadius: 18,
  padding: 'clamp(16px, 3vw, 22px)',
  background:
    'linear-gradient(135deg, rgba(50, 255, 126, 0.1), rgba(27, 117, 255, 0.08) 46%, rgba(7, 14, 30, 0.82))',
  boxShadow: '0 22px 58px rgba(0, 0, 0, 0.26)',
}

const quickPathHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  alignContent: 'center',
  minWidth: 0,
}

const quickPathEyebrowStyle: CSSProperties = {
  margin: 0,
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const quickPathTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--text)',
  fontSize: 'clamp(22px, 3.5vw, 34px)',
  lineHeight: 1.02,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const quickPathBodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--muted)',
  fontSize: 14,
  lineHeight: 1.55,
  maxWidth: 540,
}

const quickPathGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const quickPathCardStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  alignContent: 'space-between',
  minWidth: 0,
  minHeight: 138,
  border: '1px solid rgba(255, 255, 255, 0.13)',
  borderRadius: 14,
  padding: 14,
  color: 'inherit',
  textDecoration: 'none',
  background: 'rgba(5, 12, 25, 0.72)',
}

const quickPathRoleStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const quickPathQuestionStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 15,
  lineHeight: 1.25,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const quickPathCtaStyle: CSSProperties = {
  color: 'var(--brand-blue)',
  fontSize: 12,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const actionQuestionStyle: CSSProperties = {
  margin: 0,
  borderTop: '1px solid var(--shell-panel-border)',
  paddingTop: 10,
  color: 'var(--brand-green)',
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}
