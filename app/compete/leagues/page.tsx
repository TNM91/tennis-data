'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
import { DATA_ASSIST_STORY, LEAGUE_COORDINATOR_STORY, MY_LAB_STORY } from '@/lib/product-story'
import { type TiqLeagueRecord } from '@/lib/tiq-league-registry'
import { listTiqLeagues } from '@/lib/tiq-league-service'

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
      eyebrow="League directory"
      title="Open the right league room."
      description="Saved TIQ leagues, public league pages, data refreshes, and team-week handoffs stay under the League lane."
    >
      <CompeteGrid>
        <CompeteCard
          href="/league-coordinator"
          meta="Workspace"
          title="League workspace"
          text="Set up seasons, approve entries, publish pages, and record results."
          icon="teamRankings"
          action="Open workspace"
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
          <div style={upgradeTitleStyle}>Open the workspace that matches the job.</div>
          <div style={sectionTextStyle}>
            Player handles personal prep, Captain handles team week, and League handles seasons, scorebooks, and public league rooms.
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
        <strong>{isTeam ? 'Team seasons start in the league workspace.' : 'Individual play starts with a league room.'}</strong>
        <span>
          {isTeam
            ? 'Create the season, add teams, then schedule and record results from one League lane.'
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
