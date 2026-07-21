import type { Metadata } from 'next'
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import JsonLd from '@/app/components/json-ld'
import {
  CommandHero,
  PublicPageShell,
  SectionHeader,
  TrustStrip,
  TwoColumnStory,
  pageWrapStyle,
} from '@/app/components/public-command-center'
import TrackedProductLink from '@/app/components/tracked-product-link'
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
const TOURNAMENT_LEVEL_UP_HREF = `/level-up/${TOURNAMENT_PLAYER_IDENTITY.slug}#level-up-flow`
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
          searchCompact
          showSearchResults={false}
          showBoard={false}
        />
        <section id="find" className="tournamentFindSection" style={findSectionStyle} aria-labelledby="tournament-find-title">
          <SectionHeader
            eyebrow="Find tournaments"
            title="Search events, follow draws, or check results."
            body="Jump straight to the next tournament answer: where to play, when to play, or what happened."
            titleId="tournament-find-title"
          />
          <div className="tournamentDiscoveryGrid" style={discoveryQuickGridStyle}>
            {primaryTournamentDiscoveryCards.map((card) => (
              <TournamentDiscoveryCard key={card.title} card={card} />
            ))}
          </div>
          <TournamentDetailsSection
            eyebrow="More tournament paths"
            title="Draws and event desk options."
            cue="Show paths"
          >
            <div style={discoveryQuickGridStyle}>
              {supportTournamentDiscoveryCards.map((card) => (
                <TournamentDiscoveryCard key={card.title} card={card} />
              ))}
            </div>
          </TournamentDetailsSection>
        </section>
        <section className="tournamentNextActionSection" style={nextActionSectionStyle} aria-labelledby="tournament-next-actions-title">
          <SectionHeader
            eyebrow="Next tournament move"
            title="Find the event, follow the draw, or open the desk."
            body="Start with the action you need now. Organizer and data-quality paths stay close when the event needs more support."
            titleId="tournament-next-actions-title"
          />
          <div className="tournamentCommandBoard" style={tournamentCommandBoardStyle}>
            <article className="tournamentCommandDesk" style={tournamentCommandDeskStyle}>
              <div style={tournamentCommandTopStyle}>
                <span style={tournamentCommandBadgeStyle}>Tournament Desk</span>
                <TrackedProductLink
                  href={tournamentDeskHref}
                  style={tournamentCommandTopLinkStyle}
                  event={{
                    eventName: 'run_tournament_clicked',
                    surface: 'tournaments',
                    metadata: {
                      location: 'tournament_command_path',
                    },
                  }}
                >
                  Open Desk
                </TrackedProductLink>
              </div>
              <h3 className="tournamentCommandTitle" style={tournamentCommandTitleStyle}>One run sheet for event day.</h3>
              <p className="tournamentCommandText" style={tournamentCommandTextStyle}>
                Keep entries, draws, courts, scores, winners, and player updates moving from the same tournament desk.
              </p>
              <div className="tournamentCommandMetricGrid" style={tournamentCommandMetricGridStyle}>
                <MetricTile label="Entries" value="28" />
                <MetricTile label="Draws" value="Draft" />
                <MetricTile label="Courts" value="6" accent />
              </div>
              <div className="tournamentCommandActionRow" style={tournamentCommandActionRowStyle}>
                <TrackedProductLink
                  href="#find"
                  style={tournamentCommandGhostLinkStyle}
                  event={{
                    eventName: 'tournament_search_submitted',
                    surface: 'tournaments',
                    metadata: {
                      location: 'tournament_command_path',
                    },
                  }}
                >
                  Find Events
                </TrackedProductLink>
                <TrackedProductLink
                  href="/data-assist?intent=request-review&context=Tournament%20Desk"
                  style={tournamentCommandGhostLinkStyle}
                  event={{
                    eventName: 'data_assist_opened',
                    surface: 'data_assist',
                    metadata: {
                      location: 'tournament_command_path',
                    },
                  }}
                >
                  Send Correction
                </TrackedProductLink>
              </div>
            </article>
            <TournamentDetailsSection
              eyebrow="Event path"
              title="Find, draw, and desk steps."
              cue="Show steps"
            >
              <div style={tournamentCommandStepListStyle}>
                {primaryTournamentNextActions.map((action, index) => (
                  <TournamentCommandStep key={action.title} action={action} step={index + 1} />
                ))}
              </div>
            </TournamentDetailsSection>
          </div>
        </section>
        <section id="desk" className="tournamentDeskSection" style={{ display: 'grid', gap: 14 }}>
          <SectionHeader
            eyebrow="Tournament Desk"
            title="Open Tournament Desk."
            body="Review entries, draws, courts, scores, and player updates from one place."
          />
          <div className="tournamentDeskQuick" style={tournamentDeskQuickStyle}>
            <div style={tournamentDeskSummaryCopyStyle}>
              <span style={tournamentCommandBadgeStyle}>Tournament Desk</span>
              <h3 style={tournamentCommandTitleStyle}>Run the event.</h3>
            </div>
            <TrackedProductLink
              href={tournamentDeskHref}
              style={tournamentCommandTopLinkStyle}
              event={{
                eventName: 'tournament_desk_clicked',
                surface: 'tournaments',
                metadata: {
                  location: 'tournament_desk_summary',
                },
              }}
          >
            Open Tournament Desk
          </TrackedProductLink>
          </div>
        </section>
        <TournamentDetailsSection
          eyebrow="Tournament help"
          title="More tournament help."
          cue="Open"
        >
          <div style={tournamentSupportDrawerStackStyle}>
            <TournamentDetailsSection
              eyebrow="Organizer support"
              title="Need the bigger event path?"
              cue="Show organizer options"
            >
              <div style={tournamentSupportStepListStyle}>
                {supportTournamentNextActions.map((action, index) => (
                  <TournamentCommandStep
                    key={action.title}
                    action={action}
                    step={PRIMARY_TOURNAMENT_ACTION_COUNT + index + 1}
                  />
                ))}
              </div>
            </TournamentDetailsSection>
            <TournamentDetailsSection
              eyebrow="Player prep"
              title="Prep the next match from the draw."
              cue="Show Player ID prep"
            >
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
            </TournamentDetailsSection>
            <TournamentDetailsSection
              eyebrow="By role"
              title="What players and organizers can do."
              cue="Show role details"
            >
              <TwoColumnStory
                leftTitle="For players"
                leftBody="Find events, view divisions, see draws, know your schedule, and follow results."
                rightTitle="For organizers"
                rightBody="Create divisions, manage entries, build draws, schedule courts, track scores, publish results, and reduce event admin."
              />
            </TournamentDetailsSection>
            <TournamentDetailsSection
              eyebrow="Tournament flow"
              title="See the full event path."
              cue="Show flow"
            >
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
            </TournamentDetailsSection>
          <TournamentDetailsSection
            eyebrow="Event-day preview"
            title="Preview a ready event."
            cue="Show preview"
          >
            <div style={tournamentDeskSummaryStyle}>
              <div style={tournamentDeskSummaryCopyStyle}>
                <span style={tournamentCommandBadgeStyle}>Summer Doubles Classic</span>
                <h3 style={tournamentCommandTitleStyle}>Divisions are open, draws are draft, courts are ready.</h3>
                <p style={tournamentCommandTextStyle}>
                  Use Tournament Desk to review entries, publish court blocks, collect scores, and send winners or awards after the final.
                </p>
              </div>
              <div style={tournamentDeskSummaryGridStyle}>
                <MetricTile label="Pending" value="Clear" />
                <MetricTile label="Winners" value="Ready" />
                <MetricTile label="Notify" value="Players" accent />
              </div>
            </div>
          </TournamentDetailsSection>
          <TournamentDetailsSection
            eyebrow="Data quality"
            title="See data checks."
            cue="Show trust signals"
          >
            <TrustStrip
              context="Tournaments trust strip"
              signals={[
                { label: 'Source', value: 'Tournament Desk', tone: 'info' },
                { label: 'Freshness', value: 'Schedule changes visible', tone: 'good' },
                { label: 'Confidence', value: 'Improves after score review', tone: 'warn' },
                { label: 'Status', value: 'Players can report issues', tone: 'good' },
              ]}
            />
          </TournamentDetailsSection>
          </div>
        </TournamentDetailsSection>
      </main>
    </PublicPageShell>
  )
}

type TournamentAction = (typeof tournamentNextActions)[number]
type TournamentDiscoveryCardModel = (typeof tournamentDiscoveryCards)[number]

function TournamentDiscoveryCard({ card }: { card: TournamentDiscoveryCardModel }) {
  return (
    <Link
      href={card.href}
      className="tournamentDiscoveryCard"
      style={discoveryQuickCardStyle}
      aria-label={`${card.cta}: ${card.title}`}
    >
      <strong className="tournamentDiscoveryTitle" style={discoveryQuickTitleStyle}>{card.title}</strong>
      <span className="tournamentDiscoveryBody" style={discoveryQuickBodyStyle}>{card.body}</span>
      <span className="tournamentDiscoveryCta" style={discoveryQuickCtaStyle}>{card.cta}</span>
    </Link>
  )
}

function TournamentDetailsSection({
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
    <details className="tournamentDetailsSection" style={tournamentDetailsSectionStyle}>
      <summary style={tournamentDetailsSummaryStyle}>
        <span style={tournamentDetailsSummaryCopyStyle}>
          <span style={tournamentDetailsEyebrowStyle}>{eyebrow}</span>
          <strong style={tournamentDetailsTitleStyle}>{title}</strong>
        </span>
        <span style={tournamentDetailsCueStyle}>{cue}</span>
      </summary>
      <div className="tournamentDetailsContent" style={tournamentDetailsContentStyle}>{children}</div>
    </details>
  )
}

function TournamentCommandStep({ action, step }: { action: TournamentAction; step: number }) {
  return (
    <article style={tournamentCommandStepStyle}>
      <span style={tournamentCommandStepNumberStyle}>{step}</span>
      <div style={tournamentCommandStepCopyStyle}>
        <div style={tournamentCommandStepTopStyle}>
          <span style={tournamentCommandStepEyebrowStyle}>{action.eyebrow}</span>
          <TrackedProductLink href={action.href} style={tournamentCommandStepLinkStyle} event={action.event}>
            {action.cta}
          </TrackedProductLink>
        </div>
        <h3 style={tournamentCommandStepTitleStyle}>{action.title}</h3>
        <p style={tournamentCommandStepBodyStyle}>{action.body}</p>
        <div style={tournamentCommandMetricRowStyle}>
          {action.metrics.map((metric) => (
            <span key={metric.label} style={tournamentCommandMetricPillStyle}>
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
    <div style={{ ...tournamentCommandMetricTileStyle, ...(accent ? tournamentCommandMetricTileAccentStyle : null) }}>
      <span style={tournamentCommandMetricLabelStyle}>{label}</span>
      <strong style={tournamentCommandMetricValueStyle}>{value}</strong>
    </div>
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
  },
  {
    eyebrow: 'Organize',
    title: 'Plan the full competition',
    body: 'Use the Leagues & Tournaments hub when schedules, standings, draws, teams, players, and scoring need one organizer path.',
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
  },
] as const

const PRIMARY_TOURNAMENT_ACTION_COUNT = 3
const primaryTournamentNextActions = tournamentNextActions.slice(0, PRIMARY_TOURNAMENT_ACTION_COUNT)
const supportTournamentNextActions = tournamentNextActions.slice(PRIMARY_TOURNAMENT_ACTION_COUNT)
const PRIMARY_TOURNAMENT_DISCOVERY_CARD_COUNT = 1
const primaryTournamentDiscoveryCards = tournamentDiscoveryCards.slice(0, PRIMARY_TOURNAMENT_DISCOVERY_CARD_COUNT)
const supportTournamentDiscoveryCards = tournamentDiscoveryCards.slice(PRIMARY_TOURNAMENT_DISCOVERY_CARD_COUNT)

const tournamentSupportDrawerStackStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const tournamentDetailsSectionStyle: CSSProperties = {
  display: 'block',
  gap: 10,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const tournamentDetailsSummaryStyle: CSSProperties = {
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

const tournamentDetailsSummaryCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const tournamentDetailsEyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const tournamentDetailsTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const tournamentDetailsCueStyle: CSSProperties = {
  flex: '0 0 auto',
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const tournamentDetailsContentStyle: CSSProperties = {
  minWidth: 0,
  paddingTop: 10,
  overflowWrap: 'anywhere',
}

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

const tournamentCommandBoardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 370px), 1fr))',
  gap: 12,
  alignItems: 'stretch',
  minWidth: 0,
  padding: 'clamp(12px, 2.2vw, 16px)',
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, var(--brand-green) 18%, var(--shell-panel-border) 82%)',
  background:
    'linear-gradient(145deg, color-mix(in srgb, var(--brand-green) 8%, var(--shell-panel-bg) 92%), rgba(8,16,34,0.78))',
  boxShadow: '0 18px 48px rgba(2,10,24,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const tournamentCommandDeskStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  padding: 13,
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background:
    'linear-gradient(150deg, color-mix(in srgb, var(--brand-green) 11%, transparent), rgba(7,17,33,0.84) 48%, rgba(8,16,34,0.92))',
  overflow: 'hidden',
}

const tournamentCommandTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const tournamentCommandBadgeStyle: CSSProperties = {
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

const tournamentCommandTopLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  minHeight: 34,
  padding: '0 11px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 30%, var(--shell-panel-border) 70%)',
  background: 'rgba(7,17,33,0.66)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 950,
  textAlign: 'center',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const tournamentCommandTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.3rem, 2.2vw, 1.85rem)',
  lineHeight: 1.05,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const tournamentCommandTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.52,
  fontWeight: 740,
  overflowWrap: 'anywhere',
}

const tournamentCommandMetricGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 118px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const tournamentCommandMetricTileStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  alignContent: 'start',
  minWidth: 0,
  padding: 10,
  borderRadius: 8,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.62)',
}

const tournamentCommandMetricTileAccentStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-green) 10%, rgba(7,17,33,0.62) 90%)',
}

const tournamentCommandMetricLabelStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 11,
  lineHeight: 1.15,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const tournamentCommandMetricValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.15,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const tournamentCommandActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const tournamentCommandGhostLinkStyle: CSSProperties = {
  ...tournamentCommandTopLinkStyle,
  color: 'var(--brand-green)',
}

const tournamentCommandStepListStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const tournamentSupportStepListStyle: CSSProperties = {
  ...tournamentCommandStepListStyle,
  paddingTop: 10,
}

const tournamentCommandStepStyle: CSSProperties = {
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

const tournamentCommandStepNumberStyle: CSSProperties = {
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

const tournamentCommandStepCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
}

const tournamentCommandStepTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const tournamentCommandStepEyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const tournamentCommandStepLinkStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
  textDecoration: 'none',
  borderBottom: '1px solid color-mix(in srgb, var(--brand-green) 46%, transparent)',
}

const tournamentCommandStepTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 17,
  lineHeight: 1.12,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const tournamentCommandStepBodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.42,
  fontWeight: 730,
  overflowWrap: 'anywhere',
}

const tournamentCommandMetricRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  minWidth: 0,
}

const tournamentCommandMetricPillStyle: CSSProperties = {
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

const discoveryQuickGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const discoveryQuickCardStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  minHeight: 108,
  alignContent: 'space-between',
  padding: 11,
  borderRadius: 8,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.58)',
  color: 'inherit',
  textDecoration: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const discoveryQuickTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 18,
  lineHeight: 1.12,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const discoveryQuickBodyStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.42,
  fontWeight: 730,
  overflowWrap: 'anywhere',
}

const discoveryQuickCtaStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const tournamentDeskSummaryStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
  gap: 12,
  alignItems: 'center',
  minWidth: 0,
  padding: 'clamp(14px, 2.4vw, 18px)',
  borderRadius: 8,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(8,16,34,0.72)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const tournamentDeskQuickStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 12,
  alignItems: 'center',
  minWidth: 0,
  padding: 'clamp(12px, 2.2vw, 16px)',
  borderRadius: 8,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(8,16,34,0.72)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.16), inset 0 1px 0 rgba(255,255,255,0.04)',
  overflowWrap: 'anywhere',
}

const tournamentDeskSummaryCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const tournamentDeskSummaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))',
  gap: 8,
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
