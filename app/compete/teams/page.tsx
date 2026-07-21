'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import CompetePageFrame, {
  CompeteCard,
  CompeteGrid,
} from '@/app/compete/_components/compete-page-frame'
import { buildProductAccessState } from '@/lib/access-model'
import { useAuth } from '@/app/components/auth-provider'
import { listTeamDirectoryOptions, type TeamDirectoryOption } from '@/lib/team-directory'
import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'
import {
  listTiqTeamParticipations,
  type TiqTeamParticipationRecord,
} from '@/lib/tiq-league-service'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const dataAssistTeamsHref = '/data-assist?intent=upload-source&context=League%20Office%20teams'

const emptyTeamActions = [
  { href: '/league-coordinator', label: 'Create team league' },
  { href: dataAssistTeamsHref, label: 'Refresh team data' },
  { href: '/teams', label: 'Browse teams' },
] as const

const TEAM_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('doubles-commander-4-0')
const TEAM_PLAYER_IDENTITY_READ = getPlayerDevelopmentIdentityActionRead(TEAM_PLAYER_IDENTITY)
const TEAM_LEVEL_UP_HREF = `/level-up/${TEAM_PLAYER_IDENTITY.slug}#level-up-flow`
const TEAM_PLAYER_DEVELOPMENT_HREF = `/player-development/${TEAM_PLAYER_IDENTITY.slug}`
const teamPlayerIdPrepItems = [
  { label: 'Team read', value: TEAM_PLAYER_IDENTITY_READ.matchTrigger },
  { label: 'Roster proof', value: TEAM_PLAYER_IDENTITY_READ.proofTarget },
  { label: 'Captain cue', value: TEAM_PLAYER_IDENTITY_READ.coachPrompt },
] as const
const teamPlayerIdActions = [
  { href: TEAM_LEVEL_UP_HREF, label: 'Start Level Up' },
  { href: TEAM_PLAYER_DEVELOPMENT_HREF, label: 'Read Player ID' },
  { href: '/captain', label: 'Open Team Hub' },
] as const

const teamPathActions = [
  {
    href: '/teams',
    job: 'find_team',
    question: 'Which team am I reading?',
    title: 'Find a team',
    body: 'Open public team context before you scout players, depth, standings, or history.',
    cta: 'Find team',
  },
  {
    href: dataAssistTeamsHref,
    job: 'refresh_roster',
    question: 'How do I refresh the roster?',
    title: 'Upload team data',
    body: 'Send reviewed team summaries, rosters, or scorecards through Data Assist when team context is stale.',
    cta: 'Refresh data',
  },
  {
    href: '/captain/lineup-builder',
    job: 'build_lineup',
    question: 'What lineup gives us the best chance?',
    title: 'Build lineup',
    body: 'Move from team read to captain decision with lineup, partner, and weekly context.',
    cta: 'Build lineup',
  },
  {
    href: '/league-coordinator/results',
    job: 'record_results',
    question: 'What happened last match?',
    title: 'Open team book',
    body: 'Record team match events and line scores so future team reads have real evidence.',
    cta: 'Open scorebook',
  },
] as const

export default function CompeteTeamsPage() {
  return (
    <CompetePageFrame
      eyebrow="My Teams"
      title="Find the team move fast."
      description="Open the team, refresh roster data, build a lineup, or send match history to the team book."
    >
      <CompeteTeamsContent />
    </CompetePageFrame>
  )
}

function CompeteTeamsContent() {
  const { role, userId, entitlements, authResolved } = useAuth()
  const [participations, setParticipations] = useState<TiqTeamParticipationRecord[]>([])
  const [teamDirectory, setTeamDirectory] = useState<TeamDirectoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [storageWarning, setStorageWarning] = useState('')
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [resolvedRole, entitlements])

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      const [participationResult, teamOptions] = await Promise.all([
        listTiqTeamParticipations(),
        listTeamDirectoryOptions().catch(() => []),
      ])

      if (!active) return

      setParticipations(participationResult.entries)
      setTeamDirectory(teamOptions)
      setStorageWarning(participationResult.warning || '')
      setLoading(false)
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  const groupedTeams = useMemo(() => {
    const directoryByTeam = new Map(teamDirectory.map((option) => [option.team, option]))
    const grouped = new Map<
      string,
      {
        teamName: string
        sourceLeagueName: string
        sourceFlight: string
        tiqLeagues: TiqTeamParticipationRecord[]
        directoryOption: TeamDirectoryOption | null
      }
    >()

    for (const entry of participations) {
      const key = entry.teamEntityId || `${entry.teamName}__${entry.sourceLeagueName}__${entry.sourceFlight}`
      if (!grouped.has(key)) {
        grouped.set(key, {
          teamName: entry.teamName,
          sourceLeagueName: entry.sourceLeagueName,
          sourceFlight: entry.sourceFlight,
          tiqLeagues: [],
          directoryOption: directoryByTeam.get(entry.teamName) || null,
        })
      }

      grouped.get(key)?.tiqLeagues.push(entry)
    }

    return Array.from(grouped.values()).sort((left, right) => {
      if (right.tiqLeagues.length !== left.tiqLeagues.length) {
        return right.tiqLeagues.length - left.tiqLeagues.length
      }
      return left.teamName.localeCompare(right.teamName)
    })
  }, [participations, teamDirectory])

  return (
    <>
      <TeamPathPanel />

      <section id="tiq-entered-teams" style={sectionStyle}>
        <div style={sectionEyebrowStyle}>Entered teams</div>
        <div style={sectionTextStyle}>
          {loading
            ? 'Loading team participation...'
            : groupedTeams.length > 0
              ? 'Open the team, check match history, or move straight into the lineup action.'
              : 'Create a team league, refresh roster data, or find a public team.'}
        </div>

        {storageWarning ? <div style={warningStyle}>{storageWarning}</div> : null}
        {groupedTeams.length === 0 ? (
          <EmptyTeamsState />
        ) : (
          <div style={listStyle}>
            {groupedTeams.map((group) => {
              const teamPageHref = `/team/${encodeURIComponent(group.teamName)}?layer=tiq${group.sourceLeagueName ? `&league=${encodeURIComponent(group.sourceLeagueName)}` : ''}${group.sourceFlight ? `&flight=${encodeURIComponent(group.sourceFlight)}` : ''}`
              const lineupHref = `/captain/lineup-builder?layer=tiq&team=${encodeURIComponent(group.teamName)}${group.sourceLeagueName ? `&league=${encodeURIComponent(group.sourceLeagueName)}` : ''}${group.sourceFlight ? `&flight=${encodeURIComponent(group.sourceFlight)}` : ''}`
              const teamReadinessItems = [
                {
                  label: 'Leagues',
                  value: group.tiqLeagues.length > 0 ? `${group.tiqLeagues.length}` : 'Waiting',
                  ready: group.tiqLeagues.length > 0,
                },
                {
                  label: 'History',
                  value: group.directoryOption ? `${group.directoryOption.matchCount} matches` : 'No matches',
                  ready: Boolean(group.directoryOption),
                },
                {
                  label: 'Captain',
                  value: access.canUseCaptainWorkflow ? 'Ready' : 'Locked',
                  ready: access.canUseCaptainWorkflow,
                },
              ]
              const primaryHref = access.canUseCaptainWorkflow ? lineupHref : teamPageHref
              const primaryLabel = access.canUseCaptainWorkflow ? 'Build lineup' : 'Open team'

              return (
                <div key={`${group.teamName}-${group.sourceLeagueName}-${group.sourceFlight}`} style={rowStyle}>
                  <div style={teamCopyStyle}>
                    <div style={rowTitleStyle}>{group.teamName}</div>
                    <div style={rowMetaStyle}>
                      {[group.sourceLeagueName, group.sourceFlight, `${group.tiqLeagues.length} TIQ leagues`]
                        .filter(Boolean)
                        .join(' | ')}
                    </div>
                    <div style={rowSubtleStyle}>
                      {group.tiqLeagues
                        .map((entry) => [entry.leagueName, entry.seasonLabel].filter(Boolean).join(' - '))
                        .join(' | ')}
                    </div>
                    <div style={teamReadinessGridStyle}>
                      {teamReadinessItems.map((item) => (
                        <div key={item.label} style={teamReadinessItemStyle}>
                          <span style={item.ready ? readinessDotReadyStyle : readinessDotWaitingStyle} aria-hidden="true" />
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                      <Link href={primaryHref} style={teamPrimaryActionStyle}>
                        {primaryLabel}
                      </Link>
                    </div>
                  </div>
                  {access.canUseCaptainWorkflow ? (
                    <Link href={teamPageHref} style={teamSecondaryLinkStyle}>
                      Team page
                    </Link>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <TeamToolsDisclosure>
        <CompeteGrid>
          <CompeteCard
            href="/teams"
            meta="Public map"
            title="Team directory"
            text="Open roster, standings, and team analytics."
            icon="teamRankings"
            action="Find team"
          />
          <CompeteCard
            href="/league-coordinator/results"
            meta="Scorebook"
            title="Team book"
            text="Record team match events, line scores, and standings-moving outcomes."
            icon="reports"
            action="Open book"
          />
          <CompeteCard
            href="/captain/lineup-builder"
            meta="Team handoff"
            title="Build lineup"
            text="Build from the team already in view."
            icon="lineupBuilder"
            action="Build lineup"
          />
          <CompeteCard
            href="/compete/schedule"
            meta="Shared calendar"
            title="Match dates"
            text="Keep team matches connected to the league calendar."
            icon="schedule"
            action="Open calendar"
          />
        </CompeteGrid>
      </TeamToolsDisclosure>

      <TeamSupportDisclosure>
        <TeamPlayerIdPrepPanel />
      </TeamSupportDisclosure>

      {authResolved ? (
        <TeamUpgradeDisclosure>
          <div style={upgradeGridStyle}>
            {!access.canUseCaptainWorkflow ? (
              <UpgradePrompt
                planId="captain"
                compact
                headline="Still moving from team context to lineups by hand?"
                body="Unlock Captain to connect team context, availability, lineup building, and messaging through Team Hub."
                ctaLabel="Unlock Captain"
                ctaHref="/pricing"
                secondaryLabel="See Captain plan"
                secondaryHref="/pricing"
              />
            ) : null}
            {!access.canUseLeagueTools ? (
              <UpgradePrompt
                planId="league"
                compact
                headline="Running TIQ team seasons without a real organizer layer?"
                body="League Office keeps season structure, standings, scheduling, and team coordination organized instead of scattered spreadsheet cleanup."
                ctaLabel="Unlock League"
                ctaHref="/pricing"
                secondaryLabel="See league plan"
                secondaryHref="/pricing"
              />
            ) : null}
          </div>
        </TeamUpgradeDisclosure>
      ) : null}
    </>
  )
}

function TeamSupportDisclosure({ children }: { children: ReactNode }) {
  return (
    <details className="competeDetailsSection" style={teamSupportDisclosureStyle}>
      <summary style={teamSupportSummaryStyle}>
        <span style={teamSupportSummaryCopyStyle}>Use Player ID for this team read</span>
        <span>Open</span>
      </summary>
      <div style={teamSupportBodyStyle}>{children}</div>
    </details>
  )
}

function TeamUpgradeDisclosure({ children }: { children: ReactNode }) {
  return (
    <details className="competeDetailsSection" style={teamSupportDisclosureStyle}>
      <summary style={teamSupportSummaryStyle}>
        <span style={teamSupportSummaryCopyStyle}>Need Captain or League tools?</span>
        <span>Open</span>
      </summary>
      <div style={teamSupportBodyStyle}>{children}</div>
    </details>
  )
}

function TeamToolsDisclosure({ children }: { children: ReactNode }) {
  return (
    <details className="competeDetailsSection" style={teamSupportDisclosureStyle}>
      <summary style={teamSupportSummaryStyle}>
        <span style={teamSupportSummaryCopyStyle}>More team tools</span>
        <span>Open</span>
      </summary>
      <div style={teamSupportBodyStyle}>{children}</div>
    </details>
  )
}

function TeamPathPanel() {
  const { isMobile } = useViewportBreakpoints()

  return (
    <section style={teamPathStyle} aria-labelledby="compete-team-path-title">
      <div style={teamPathHeaderStyle}>
        <div>
          <span style={teamPathEyebrowStyle}>Team path</span>
          <h2 id="compete-team-path-title" style={teamPathTitleStyle}>Choose what to do with a team</h2>
        </div>
        <p style={{ ...teamPathIntroStyle, display: isMobile ? 'none' : undefined }}>
          Pick the action that matches the team question in front of you.
        </p>
      </div>
      <div style={{ ...teamPathGridStyle, gap: isMobile ? '8px' : teamPathGridStyle.gap }}>
        {teamPathActions.map((action) => (
          <Link
            key={action.job}
            href={action.href}
            style={{
              ...teamPathCardStyle,
              minHeight: isMobile ? 76 : teamPathCardStyle.minHeight,
              padding: isMobile ? '10px' : teamPathCardStyle.padding,
              borderRadius: isMobile ? '14px' : teamPathCardStyle.borderRadius,
            }}
            data-compete-team-path-job={action.job}
            aria-label={`${action.cta}: ${action.question}`}
          >
            <span style={teamPathQuestionStyle}>{action.question}</span>
            <strong style={teamPathCardTitleStyle}>{action.title}</strong>
            <span style={teamPathCtaStyle}>{action.cta}</span>
          </Link>
        ))}
      </div>
      <details className="competeDetailsSection" style={teamPathGuideStyle}>
        <summary style={teamPathGuideSummaryStyle}>Help me choose</summary>
        <div style={teamPathGuideGridStyle}>
          {teamPathActions.map((action) => (
            <div key={action.job} style={teamPathGuideItemStyle}>
              <strong>{action.title}</strong>
              <span>{action.body}</span>
            </div>
          ))}
        </div>
      </details>
    </section>
  )
}

function TeamPlayerIdPrepPanel() {
  return (
    <section style={teamPlayerIdPrepStyle} aria-label="Teams Player ID team prep">
      <div style={teamPlayerIdPrepCopyStyle}>
        <span style={teamPlayerIdPrepEyebrowStyle}>Team read to Player ID</span>
        <h2 style={teamPlayerIdPrepTitleStyle}>Pick the player cue before the lineup.</h2>
        <p style={teamPlayerIdPrepTextStyle}>
          {TEAM_PLAYER_IDENTITY_READ.levelUpNudge} Use the same Player ID read to turn team context into one Level Up rep, one roster proof point, and one captain move.
        </p>
      </div>
      <div style={teamPlayerIdPrepGridStyle} aria-label="Teams Player ID starter read">
        {teamPlayerIdPrepItems.map((item) => (
          <div key={item.label} style={teamPlayerIdPrepCardStyle}>
            <span style={teamPlayerIdPrepLabelStyle}>{item.label}</span>
            <strong style={teamPlayerIdPrepValueStyle}>{item.value}</strong>
          </div>
        ))}
      </div>
      <div style={teamPlayerIdActionRowStyle}>
        {teamPlayerIdActions.map((action, index) => (
          <Link
            key={action.href}
            href={action.href}
            style={index === 0 ? { ...teamPlayerIdActionStyle, ...teamPlayerIdPrimaryActionStyle } : teamPlayerIdActionStyle}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  )
}

function EmptyTeamsState() {
  return (
    <div style={emptyTeamsStyle}>
      <div style={emptyTeamsCopyStyle}>
        <strong>Team tools start with one real team signal.</strong>
        <span>Create a TIQ team league, upload a roster or scorecard through Data Assist, or find the team already in the public map.</span>
      </div>
      <div style={emptyTeamsActionRowStyle}>
        {emptyTeamActions.map((action) => (
          <Link key={action.href} href={action.href} style={emptyTeamsActionStyle}>
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

const sectionStyle = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: '12px',
  marginTop: '24px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8, 16, 34, 0.74)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
} as const

const teamPathStyle: CSSProperties = {
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

const teamSupportDisclosureStyle: CSSProperties = {
  minWidth: 0,
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.62)',
  boxShadow: '0 14px 36px rgba(2,10,24,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
  overflow: 'hidden',
}

const teamSupportSummaryStyle: CSSProperties = {
  cursor: 'pointer',
  minHeight: 48,
  padding: '0 14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  color: 'var(--foreground-strong)',
  fontSize: '13px',
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const teamSupportSummaryCopyStyle: CSSProperties = {
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const teamSupportBodyStyle: CSSProperties = {
  minWidth: 0,
  padding: '0 10px 10px',
}

const teamPathHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const teamPathEyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '12px',
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const teamPathTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(22px, 5vw, 30px)',
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const teamPathIntroStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.55,
  fontWeight: 750,
  maxWidth: 560,
  overflowWrap: 'anywhere',
}

const teamPathGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: '10px',
  minWidth: 0,
}

const teamPathCardStyle: CSSProperties = {
  display: 'grid',
  gap: '7px',
  alignContent: 'start',
  minHeight: 92,
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

const teamPathQuestionStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  lineHeight: 1.3,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const teamPathCardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '15px',
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const teamPathCtaStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '12px',
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const teamPathGuideStyle: CSSProperties = {
  minWidth: 0,
  borderRadius: '14px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(2,8,23,0.24)',
  overflow: 'hidden',
}

const teamPathGuideSummaryStyle: CSSProperties = {
  cursor: 'pointer',
  minHeight: 42,
  padding: '0 12px',
  display: 'flex',
  alignItems: 'center',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const teamPathGuideGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: '8px',
  minWidth: 0,
  padding: '0 10px 10px',
}

const teamPathGuideItemStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  minWidth: 0,
  padding: '9px',
  borderRadius: '12px',
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.035)',
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
}

const teamPlayerIdPrepStyle: CSSProperties = {
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

const teamPlayerIdPrepCopyStyle: CSSProperties = {
  display: 'grid',
  gap: '7px',
  minWidth: 0,
}

const teamPlayerIdPrepEyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '12px',
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const teamPlayerIdPrepTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(20px, 5vw, 28px)',
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const teamPlayerIdPrepTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.55,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const teamPlayerIdPrepGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: '8px',
  minWidth: 0,
}

const teamPlayerIdPrepCardStyle: CSSProperties = {
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

const teamPlayerIdPrepLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '11px',
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const teamPlayerIdPrepValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '13px',
  lineHeight: 1.35,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const teamPlayerIdActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-start',
  gap: '9px',
  minWidth: 0,
}

const teamPlayerIdActionStyle: CSSProperties = {
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

const teamPlayerIdPrimaryActionStyle: CSSProperties = {
  borderColor: 'rgba(155,225,29,0.36)',
  background: 'rgba(155,225,29,0.13)',
  color: '#f5ffe2',
}

const upgradeGridStyle = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
  gap: '16px',
  marginTop: '24px',
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

const emptyTeamsStyle = {
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

const emptyTeamsCopyStyle = {
  display: 'grid',
  gap: '6px',
  minWidth: 0,
  overflowWrap: 'anywhere',
} as const

const emptyTeamsActionRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  minWidth: 0,
} as const

const emptyTeamsActionStyle = {
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
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.66)',
  minWidth: 0,
} as const

const teamCopyStyle = {
  minWidth: 0,
} as const

const rowTitleStyle = {
  color: 'var(--foreground-strong)',
  fontSize: '18px',
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

const rowSubtleStyle = {
  marginTop: '6px',
  color: 'var(--foreground)',
  fontSize: '12px',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
} as const

const teamReadinessGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 118px), 1fr))',
  gap: '8px',
  marginTop: '12px',
  minWidth: 0,
} as const

const teamReadinessItemStyle = {
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

const teamPrimaryActionStyle = {
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

const teamSecondaryLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  minHeight: '34px',
  padding: '7px 12px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(7,17,33,0.72)',
  color: '#eef5ff',
  fontSize: '12px',
  fontWeight: 850,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
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

const warningStyle = {
  padding: '10px 14px',
  borderRadius: '12px',
  border: '1px solid rgba(251,191,36,0.18)',
  background: 'rgba(120,80,0,0.18)',
  color: 'rgba(253,230,138,0.88)',
  fontSize: '13px',
  lineHeight: 1.55,
} as const
