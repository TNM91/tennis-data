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
    question: 'What source needs review before the platform can trust it?',
    body: 'Upload scorecards, schedules, rosters, team summaries, or corrections when the tennis context needs review.',
    metrics: [
      { label: 'Upload', value: 'Source' },
      { label: 'Review', value: 'Needed' },
      { label: 'Feeds', value: 'Platform' },
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
