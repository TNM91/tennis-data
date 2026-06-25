'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import CompetePageFrame, {
  CompeteCard,
  CompeteGrid,
} from '@/app/compete/_components/compete-page-frame'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { getLeagueFormatLabel } from '@/lib/competition-layers'
import { listTiqIndividualLeagueResults } from '@/lib/tiq-individual-results-service'
import {
  buildTiqIndividualLeagueSummaries,
  type TiqIndividualLeagueSummary,
} from '@/lib/tiq-individual-results-summary'
import { listTiqIndividualSuggestions } from '@/lib/tiq-individual-suggestions-service'
import {
  buildTiqIndividualSuggestionSummaries,
  type TiqIndividualSuggestionSummary,
} from '@/lib/tiq-individual-suggestions-summary'
import {
  getTiqIndividualCompetitionFormatLabel,
  getTiqIndividualCompetitionFormatNextAction,
  getTiqIndividualCompetitionFormatPreview,
} from '@/lib/tiq-individual-format'
import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'
import { DATA_ASSIST_STORY, LEAGUE_COORDINATOR_STORY, MY_LAB_STORY, PRODUCT_MOTTO } from '@/lib/product-story'
import { type TiqLeagueRecord } from '@/lib/tiq-league-registry'
import { listTiqLeagues } from '@/lib/tiq-league-service'

const leaguePathActions = [
  {
    href: '/league-coordinator',
    job: 'run_league',
    question: 'How do I run the season?',
    title: 'Open League Office',
    body: 'Set up seasons, approve entries, publish league rooms, schedule matches, and keep standings moving.',
    cta: 'Open League Office',
  },
  {
    href: '/explore/leagues',
    job: 'find_league',
    question: 'Which league am I looking for?',
    title: 'Browse leagues',
    body: 'Search USTA history, TIQ team leagues, and TIQ individual leagues from one public map.',
    cta: 'Browse leagues',
  },
  {
    href: DATA_ASSIST_STORY.href,
    job: 'refresh_league_data',
    question: 'How do I refresh schedules or scorecards?',
    title: 'Upload league data',
    body: 'Use reviewed Data Assist uploads for schedules, rosters, team summaries, and official scorecards.',
    cta: 'Upload data',
  },
  {
    href: '/captain',
    job: 'open_team_week',
    question: 'What does this mean for my team?',
    title: 'Open Team week',
    body: 'Turn league context into availability, lineups, scenarios, and team messages.',
    cta: 'Open week',
  },
] as const

const LEAGUE_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('relentless-competitor-4-0')
const LEAGUE_PLAYER_IDENTITY_READ = getPlayerDevelopmentIdentityActionRead(LEAGUE_PLAYER_IDENTITY)
const LEAGUE_LEVEL_UP_HREF = `/level-up/${LEAGUE_PLAYER_IDENTITY.slug}`
const LEAGUE_PLAYER_DEVELOPMENT_HREF = `/player-development/${LEAGUE_PLAYER_IDENTITY.slug}`
const leaguePlayerIdPrepItems = [
  { label: 'League read', value: LEAGUE_PLAYER_IDENTITY_READ.matchTrigger },
  { label: 'Result proof', value: LEAGUE_PLAYER_IDENTITY_READ.proofTarget },
  { label: 'Next cue', value: LEAGUE_PLAYER_IDENTITY_READ.nextCue },
] as const
const leaguePlayerIdActions = [
  { href: LEAGUE_LEVEL_UP_HREF, label: 'Start Level Up' },
  { href: LEAGUE_PLAYER_DEVELOPMENT_HREF, label: 'Read Player ID' },
  { href: '/compete/results', label: 'Open results' },
] as const

export default function CompeteLeaguesPage() {
  const [records, setRecords] = useState<TiqLeagueRecord[]>([])
  const [storageWarning, setStorageWarning] = useState('')
  const [individualLeagueSummaries, setIndividualLeagueSummaries] = useState<
    Map<string, TiqIndividualLeagueSummary>
  >(new Map())
  const [individualSuggestionSummaries, setIndividualSuggestionSummaries] = useState<
    Map<string, TiqIndividualSuggestionSummary>
  >(new Map())

  useEffect(() => {
    async function load() {
      const [result, individualResults, suggestionResult] = await Promise.all([
        listTiqLeagues(),
        listTiqIndividualLeagueResults(),
        listTiqIndividualSuggestions(),
      ])
      setRecords(result.records)
      setStorageWarning(result.warning || individualResults.warning || suggestionResult.warning || '')
      setIndividualLeagueSummaries(buildTiqIndividualLeagueSummaries(individualResults.results))
      setIndividualSuggestionSummaries(
        buildTiqIndividualSuggestionSummaries(suggestionResult.suggestions),
      )
    }

    void load()
  }, [])

  const teamLeagues = useMemo(
    () => records.filter((record) => record.leagueFormat === 'team'),
    [records],
  )
  const individualLeagues = useMemo(
    () => records.filter((record) => record.leagueFormat === 'individual'),
    [records],
  )

  return (
    <CompetePageFrame
      eyebrow="League Office directory"
      title="Open the right league room."
      description="Saved TIQ leagues, public league pages, data refreshes, and team-week handoffs stay under the League Office lane."
    >
      <LeaguePathPanel />
      <LeaguePlayerIdPrepPanel />

      <CompeteGrid>
        <CompeteCard
          href="/league-coordinator"
          meta="League tool"
          title="League Office"
          text="Set up seasons, approve entries, publish pages, and record results."
          icon="teamRankings"
          action="Open League Office"
        />
        <CompeteCard
          href="/explore/leagues"
          meta="Public map"
          title="Browse leagues"
          text="USTA history, TIQ team leagues, and TIQ individual leagues in one search surface."
          icon="opponentScouting"
          action="Browse leagues"
        />
        <CompeteCard
          href={DATA_ASSIST_STORY.href}
          meta="Refresh"
          title="Improve league data"
          text="Upload schedules, rosters, and scorecards when league context changes."
          icon="accountSecurity"
          action="Upload data"
        />
        <CompeteCard
          href="/captain"
          meta="Team handoff"
          title="Team week"
          text="Move into lineup, availability, scenario, and team messages."
          icon="captainDashboard"
          action="Open week"
        />
      </CompeteGrid>

      {storageWarning ? <div style={warningStyle}>{storageWarning}</div> : null}

      <div style={upgradeWrapStyle}>
        <div style={upgradeIntroStyle}>
          <div style={sectionEyebrowStyle}>Unlock path</div>
          <div style={upgradeTitleStyle}>Open the path that matches the tennis need.</div>
          <div style={sectionTextStyle}>
            Player handles personal prep, Captain handles team week, and League Office handles seasons, scorebooks, and public league rooms.
          </div>
        </div>

        <div style={upgradeGridStyle}>
          <UpgradePrompt
            planId="player_plus"
            compact
            headline={MY_LAB_STORY.upgradeHeadline}
            body={MY_LAB_STORY.upgradeBody}
            ctaLabel="Unlock Player"
            ctaHref="/pricing"
            secondaryLabel="See plans"
            secondaryHref="/pricing"
          />
          <UpgradePrompt
            planId="captain"
            compact
            headline="Still building lineups manually?"
            body="Captain helps you save time, reduce stress, and move from availability to smarter lineups and team communication."
            ctaLabel="Unlock Captain"
            ctaHref="/pricing"
            secondaryLabel="See plans"
            secondaryHref="/pricing"
          />
          <UpgradePrompt
            planId="league"
            compact
            headline={LEAGUE_COORDINATOR_STORY.finalUpgradeHeadline}
            body={LEAGUE_COORDINATOR_STORY.finalUpgradeBody}
            ctaLabel={LEAGUE_COORDINATOR_STORY.cta}
            ctaHref="/pricing"
            secondaryLabel="See plans"
            secondaryHref="/pricing"
          />
        </div>
      </div>

      <div style={sectionWrap}>
        <LeagueListSection
          title="Team Leagues"
          body="These TIQ team leagues are the captain-owned competition containers that can feed lineups, availability, messaging, and seasonal operations."
          records={teamLeagues}
        />
        <LeagueListSection
          title="Individual Leagues"
          body="These TIQ individual leagues are the player-vs-player containers that stay separate from captain-led team workflows."
          records={individualLeagues}
          individualSummaries={individualLeagueSummaries}
          individualSuggestionSummaries={individualSuggestionSummaries}
        />
      </div>

    </CompetePageFrame>
  )
}

function RowLink({ href, children }: { href: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...rowLinkStyle,
        color: hovered ? '#9be11d' : rowLinkStyle.color,
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'color 160ms ease, transform 160ms ease',
      }}
    >
      {children}
    </Link>
  )
}

function LeaguePathPanel() {
  return (
    <section style={leaguePathStyle} aria-labelledby="compete-league-path-title">
      <div style={leaguePathHeaderStyle}>
        <div>
          <span style={leaguePathEyebrowStyle}>League path</span>
          <h2 id="compete-league-path-title" style={leaguePathTitleStyle}>{PRODUCT_MOTTO}</h2>
        </div>
        <p style={leaguePathIntroStyle}>
          Start with the league need, then open the smallest action that keeps seasons, teams, and results organized.
        </p>
      </div>
      <div style={leaguePathGridStyle}>
        {leaguePathActions.map((action) => (
          <Link
            key={action.job}
            href={action.href}
            style={leaguePathCardStyle}
            data-compete-league-path-job={action.job}
            aria-label={`${action.cta}: ${action.question}`}
          >
            <span style={leaguePathQuestionStyle}>{action.question}</span>
            <strong style={leaguePathCardTitleStyle}>{action.title}</strong>
            <span>{action.body}</span>
            <span style={leaguePathCtaStyle}>{action.cta}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function LeaguePlayerIdPrepPanel() {
  return (
    <section style={leaguePlayerIdPrepStyle} aria-label="Leagues Player ID individual prep">
      <div style={leaguePlayerIdPrepCopyStyle}>
        <span style={leaguePlayerIdPrepEyebrowStyle}>Individual league to Player ID</span>
        <h2 style={leaguePlayerIdPrepTitleStyle}>When the league question becomes personal, pick one cue.</h2>
        <p style={leaguePlayerIdPrepTextStyle}>
          {LEAGUE_PLAYER_IDENTITY_READ.levelUpNudge} Keep League Office as the season layer, then use Player ID to turn standings, results, and prompts into one prep action.
        </p>
      </div>
      <div style={leaguePlayerIdPrepGridStyle} aria-label="Leagues Player ID starter read">
        {leaguePlayerIdPrepItems.map((item) => (
          <div key={item.label} style={leaguePlayerIdPrepCardStyle}>
            <span style={leaguePlayerIdPrepLabelStyle}>{item.label}</span>
            <strong style={leaguePlayerIdPrepValueStyle}>{item.value}</strong>
          </div>
        ))}
      </div>
      <div style={leaguePlayerIdActionRowStyle}>
        {leaguePlayerIdActions.map((action, index) => (
          <Link
            key={action.href}
            href={action.href}
            style={index === 0 ? { ...leaguePlayerIdActionStyle, ...leaguePlayerIdPrimaryActionStyle } : leaguePlayerIdActionStyle}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  )
}

function buildTiqLeagueDetailHref(record: TiqLeagueRecord) {
  return `/explore/leagues/tiq/${encodeURIComponent(record.id)}?league_id=${encodeURIComponent(record.id)}`
}

function buildTiqTeamResultsHref(record: TiqLeagueRecord) {
  return `/captain/tiq-team-matches?leagueId=${encodeURIComponent(record.id)}`
}

function buildTiqIndividualResultHref(record: TiqLeagueRecord) {
  const params = new URLSearchParams({ league_id: record.id })
  const [playerA, playerB] = record.players
  if (playerA && playerB) {
    params.set('suggest_player_a', `name:${playerA}`)
    params.set('suggest_player_b', `name:${playerB}`)
  }
  return `/explore/leagues/tiq/${encodeURIComponent(record.id)}?${params.toString()}`
}

function LeagueListSection({
  title,
  body,
  records,
  individualSummaries,
  individualSuggestionSummaries,
}: {
  title: string
  body: string
  records: TiqLeagueRecord[]
  individualSummaries?: Map<string, TiqIndividualLeagueSummary>
  individualSuggestionSummaries?: Map<string, TiqIndividualSuggestionSummary>
}) {
  return (
    <section style={panelStyle}>
      <div style={sectionEyebrowStyle}>{title}</div>
      <div style={sectionTextStyle}>{body}</div>

      {records.length === 0 ? (
        <EmptyLeagueSection title={title} />
      ) : (
        <div style={listStyle}>
          {records.map((record) => {
            const summary = individualSummaries?.get(record.id)
            const suggestionSummary = individualSuggestionSummaries?.get(record.id)
            const leagueHref = buildTiqLeagueDetailHref(record)
            const primaryActionLabel = record.leagueFormat === 'team' ? 'Record results' : 'Log result'
            const primaryActionHref =
              record.leagueFormat === 'team' ? buildTiqTeamResultsHref(record) : buildTiqIndividualResultHref(record)
            const leagueReadinessItems = record.leagueFormat === 'team'
              ? [
                  {
                    label: 'Teams',
                    value: record.teams.length > 0 ? `${record.teams.length}` : 'Waiting',
                    ready: record.teams.length > 0,
                  },
                  {
                    label: 'Schedule',
                    value: record.defaultMatchDay || record.defaultMatchTime ? 'Set' : 'Needs dates',
                    ready: Boolean(record.defaultMatchDay || record.defaultMatchTime),
                  },
                  {
                    label: 'Season',
                    value: record.seasonStatus || 'Draft',
                    ready: record.seasonStatus === 'active',
                  },
                ]
              : [
                  {
                    label: 'Players',
                    value: record.players.length > 0 ? `${record.players.length}` : 'Waiting',
                    ready: record.players.length > 0,
                  },
                  {
                    label: 'Results',
                    value: summary?.resultCount ? `${summary.resultCount}` : 'Waiting',
                    ready: Boolean(summary?.resultCount),
                  },
                  {
                    label: 'Prompts',
                    value: suggestionSummary?.openCount ? `${suggestionSummary.openCount} open` : 'Clear',
                    ready: !suggestionSummary?.openCount,
                  },
                ]

            return (
              <div key={record.id} style={rowStyle}>
                <div style={rowCopyStyle}>
                  <div style={rowTitleStyle}>{record.leagueName}</div>
                  <div style={rowMetaStyle}>
                    {[
                      getLeagueFormatLabel(record.leagueFormat),
                      record.leagueFormat === 'individual'
                        ? getTiqIndividualCompetitionFormatLabel(record.individualCompetitionFormat)
                        : null,
                      record.seasonLabel,
                      record.locationLabel,
                    ]
                      .filter(Boolean)
                      .join(' | ')}
                  </div>
                  <div style={rowPreviewStyle}>
                    {record.leagueFormat === 'team'
                      ? record.teams.slice(0, 3).join(' - ') || 'No team entries yet'
                      : summary
                        ? `${getTiqIndividualCompetitionFormatPreview(record.individualCompetitionFormat)} Leader ${summary.leaderName} (${summary.leaderRecord})${summary.leaderRecentForm ? ` - Form ${summary.leaderRecentForm}` : ''}`
                        : record.players.slice(0, 3).join(' - ') ||
                          getTiqIndividualCompetitionFormatPreview(record.individualCompetitionFormat)}
                  </div>
                  {record.leagueFormat === 'individual' ? (
                    <div style={rowActionHintStyle}>
                      {getTiqIndividualCompetitionFormatNextAction(
                        record.individualCompetitionFormat,
                        record.leagueName,
                      )}
                    </div>
                  ) : null}
                  {record.leagueFormat === 'individual' && suggestionSummary ? (
                    <div style={rowSuggestionStyle}>
                      {suggestionSummary.openCount > 0
                        ? `${suggestionSummary.openCount} open TIQ prompt${suggestionSummary.openCount === 1 ? '' : 's'}${suggestionSummary.claimedOpenCount ? ` - ${suggestionSummary.claimedOpenCount} claimed${suggestionSummary.latestClaimedByLabel ? ` by ${suggestionSummary.latestClaimedByLabel}` : ''}` : ''}${suggestionSummary.latestOpenTitle ? ` - ${suggestionSummary.latestOpenTitle}` : ''}`
                        : `${suggestionSummary.completedCount} TIQ prompt${suggestionSummary.completedCount === 1 ? '' : 's'} completed`}
                    </div>
                  ) : null}
                  <div style={leagueReadinessGridStyle}>
                    {leagueReadinessItems.map((item) => (
                      <div key={item.label} style={leagueReadinessItemStyle}>
                        <span style={item.ready ? readinessDotReadyStyle : readinessDotWaitingStyle} aria-hidden="true" />
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                    <Link href={primaryActionHref} style={leaguePrimaryActionStyle}>
                      {primaryActionLabel}
                    </Link>
                  </div>
                </div>
                <div style={rowActionStackStyle}>
                  <div style={rowMetaStrongStyle}>
                    {record.leagueFormat === 'team'
                      ? `${record.teams.length} teams`
                      : `${summary?.resultCount || 0} results`}
                  </div>
                  <RowLink href={leagueHref}>
                    Open league
                  </RowLink>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function EmptyLeagueSection({ title }: { title: string }) {
  const isTeam = title.toLowerCase().includes('team')
  return (
    <div style={emptyLeagueStyle}>
      <div style={emptyLeagueCopyStyle}>
        <strong>{isTeam ? 'Team seasons start in League Office.' : 'Individual play starts with a league room.'}</strong>
        <span>
          {isTeam
            ? 'Create the season, add teams, then schedule and record results from League Office.'
            : 'Create a ladder, round robin, or challenge board, then invite players and log the first result.'}
        </span>
      </div>
      <div style={emptyLeagueActionRowStyle}>
        <Link href="/league-coordinator" style={emptyLeagueActionStyle}>
          Create league
        </Link>
        <Link href="/explore/leagues" style={emptyLeagueActionStyle}>
          Browse leagues
        </Link>
      </div>
    </div>
  )
}

const warningStyle = {
  padding: '10px 14px',
  borderRadius: '12px',
  border: '1px solid rgba(251,191,36,0.18)',
  background: 'rgba(120,80,0,0.18)',
  color: 'rgba(253,230,138,0.88)',
  fontSize: '13px',
  lineHeight: 1.55,
} as const

const leaguePathStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: '14px',
  padding: '16px',
  borderRadius: '22px',
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.09), rgba(116,190,255,0.045)), rgba(8,16,34,0.76)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.22), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
  overflow: 'hidden',
  overflowWrap: 'anywhere',
}

const leaguePathHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const leaguePathEyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '12px',
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const leaguePathTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(22px, 5vw, 30px)',
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const leaguePathIntroStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.55,
  fontWeight: 750,
  maxWidth: 560,
  overflowWrap: 'anywhere',
}

const leaguePathGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: '10px',
  minWidth: 0,
}

const leaguePathCardStyle: CSSProperties = {
  display: 'grid',
  gap: '7px',
  alignContent: 'start',
  minHeight: 148,
  minWidth: 0,
  padding: '12px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.72)',
  color: 'var(--shell-copy-muted)',
  textDecoration: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  overflowWrap: 'anywhere',
}

const leaguePathQuestionStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  lineHeight: 1.3,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const leaguePathCardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '15px',
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const leaguePathCtaStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '12px',
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const leaguePlayerIdPrepStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: '14px',
  alignItems: 'center',
  marginTop: '14px',
  padding: '16px',
  borderRadius: '22px',
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(8,16,34,0.72)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.20), inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
  overflow: 'hidden',
  overflowWrap: 'anywhere',
}

const leaguePlayerIdPrepCopyStyle: CSSProperties = {
  display: 'grid',
  gap: '7px',
  minWidth: 0,
}

const leaguePlayerIdPrepEyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '12px',
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const leaguePlayerIdPrepTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(20px, 5vw, 28px)',
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const leaguePlayerIdPrepTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.55,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const leaguePlayerIdPrepGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: '8px',
  minWidth: 0,
}

const leaguePlayerIdPrepCardStyle: CSSProperties = {
  display: 'grid',
  gap: '5px',
  minWidth: 0,
  minHeight: 78,
  padding: '10px',
  borderRadius: '14px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  overflowWrap: 'anywhere',
}

const leaguePlayerIdPrepLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '11px',
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const leaguePlayerIdPrepValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '13px',
  lineHeight: 1.35,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const leaguePlayerIdActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-start',
  gap: '9px',
  minWidth: 0,
}

const leaguePlayerIdActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  minHeight: 38,
  minWidth: 0,
  padding: '9px 12px',
  borderRadius: '12px',
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'rgba(7,17,33,0.74)',
  color: '#eef5ff',
  textDecoration: 'none',
  fontSize: '12px',
  fontWeight: 950,
  textAlign: 'center',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const leaguePlayerIdPrimaryActionStyle: CSSProperties = {
  borderColor: 'rgba(155,225,29,0.36)',
  background: 'rgba(155,225,29,0.13)',
  color: '#f5ffe2',
}

const upgradeWrapStyle = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: '16px',
  marginTop: '24px',
} as const

const upgradeIntroStyle = {
  display: 'grid',
  gap: '10px',
} as const

const upgradeTitleStyle = {
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.4rem, 2vw, 2rem)',
  lineHeight: 1.08,
  fontWeight: 900,
  letterSpacing: 0,
} as const

const upgradeGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: '16px',
} as const

const sectionWrap = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  gap: '16px',
  marginTop: '24px',
  minWidth: 0,
} as const

const panelStyle = {
  display: 'grid',
  gap: '12px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8, 16, 34, 0.74)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
  overflowWrap: 'anywhere',
} as const

const sectionEyebrowStyle = {
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  color: 'var(--brand-blue-2)',
} as const

const sectionTextStyle = {
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.72,
} as const

const emptyLeagueStyle = {
  display: 'grid',
  gap: '14px',
  padding: '16px',
  borderRadius: '18px',
  border: '1px dashed rgba(116,190,255,0.18)',
  color: 'var(--shell-copy-muted)',
  background: 'rgba(8,16,34,0.66)',
  minWidth: 0,
  overflowWrap: 'anywhere',
} as const

const emptyLeagueCopyStyle = {
  display: 'grid',
  gap: '6px',
  minWidth: 0,
  overflowWrap: 'anywhere',
} as const

const emptyLeagueActionRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  minWidth: 0,
} as const

const emptyLeagueActionStyle = {
  minWidth: 0,
  maxWidth: '100%',
  padding: '10px 13px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: '12px',
  fontWeight: 900,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
} as const

const listStyle = {
  display: 'grid',
  gap: '12px',
} as const

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  gap: '12px',
  alignItems: 'center',
  padding: '14px',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.66)',
  minWidth: 0,
} as const

const rowCopyStyle = {
  minWidth: 0,
} as const

const rowTitleStyle = {
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  fontWeight: 800,
  overflowWrap: 'anywhere',
} as const

const rowMetaStyle = {
  marginTop: '4px',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.6,
  overflowWrap: 'anywhere',
} as const

const rowPreviewStyle = {
  marginTop: '8px',
  color: 'var(--foreground)',
  fontSize: '13px',
  lineHeight: 1.6,
  overflowWrap: 'anywhere',
} as const

const rowActionHintStyle = {
  marginTop: '8px',
  color: 'rgba(155,225,29,0.86)',
  fontSize: '12px',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
} as const

const rowSuggestionStyle = {
  marginTop: '8px',
  color: 'rgba(147,197,253,0.84)',
  fontSize: '12px',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
} as const

const leagueReadinessGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 118px), 1fr))',
  gap: '8px',
  marginTop: '12px',
  minWidth: 0,
} as const

const leagueReadinessItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '7px',
  minHeight: '34px',
  minWidth: 0,
  padding: '7px 9px',
  borderRadius: '12px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.035)',
  color: 'rgba(223,238,255,0.84)',
  fontSize: '12px',
  fontWeight: 850,
  overflow: 'hidden',
} as const

const leaguePrimaryActionStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '34px',
  minWidth: 0,
  padding: '7px 12px',
  borderRadius: '12px',
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.11)',
  color: '#f5ffe2',
  fontSize: '12px',
  fontWeight: 900,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
  textAlign: 'center',
} as const

const readinessDotReadyStyle = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: 'var(--brand-lime)',
  boxShadow: '0 0 0 4px rgba(155,225,29,0.10)',
  flex: '0 0 auto',
} as const

const readinessDotWaitingStyle = {
  ...readinessDotReadyStyle,
  background: 'rgba(116,190,255,0.46)',
  boxShadow: '0 0 0 4px rgba(116,190,255,0.08)',
} as const

const rowActionStackStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
  gap: '8px',
  minWidth: 0,
} as const

const rowMetaStrongStyle = {
  color: '#dffad5',
  fontSize: '13px',
  fontWeight: 800,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
} as const

const rowLinkStyle = {
  color: '#dfeeff',
  fontSize: '13px',
  fontWeight: 800,
  textDecoration: 'none',
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
} as const
