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
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import { listTeamDirectoryOptions, type TeamDirectoryOption } from '@/lib/team-directory'
import { fetchTeamConnections, getCachedTeamConnections } from '@/lib/team-profile-links-client'
import { getTeamConnectionRolesLabel, isCaptainTeamConnection, type TeamConnection } from '@/lib/team-profile-links'
import { buildTeamRoomHref } from '@/lib/team-room'
import { buildTeamProfileHref } from '@/lib/team-routes'
import { buildCaptainScopedHref } from '@/lib/captain-memory'
import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'
import {
  listTiqTeamParticipations,
  type TiqTeamParticipationRecord,
} from '@/lib/tiq-league-service'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const dataAssistTeamsHref = '/data-assist?intent=upload-source&context=League%20Office%20teams'
const FUTURE_JWT_SETTLE_DELAY_MS = 3_000

function isFutureJwtError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes('jwt issued at future')
}

async function loadConnectedTeamDirectoryOptions(teamNames: string[], retryingFutureJwt = false) {
  try {
    return await listTeamDirectoryOptions({ teamNames })
  } catch (error) {
    if (!retryingFutureJwt && isFutureJwtError(error)) {
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, FUTURE_JWT_SETTLE_DELAY_MS))
      return loadConnectedTeamDirectoryOptions(teamNames, true)
    }
    throw error
  }
}

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
    body: 'Send reviewed Player Rosters or scorecards through Data Assist when team context is stale.',
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
  const { isMobile } = useViewportBreakpoints()

  return (
    <CompetePageFrame
      eyebrow="My Teams"
      title="Your teams, one tap away."
      description="Open the roster, schedule, stats, and Team Chat connected to your account."
      compactHome={isMobile}
      resumeSurface="teams"
      resumeLabel="team directory"
      resumeHref="/compete/teams"
      showGenericSupport={false}
      showHeroSignals={false}
    >
      <CompeteTeamsContent />
    </CompetePageFrame>
  )
}

function CompeteTeamsContent() {
  const { role, userId, entitlements, authResolved, session } = useAuth()
  const [participations, setParticipations] = useState<TiqTeamParticipationRecord[]>([])
  const [connections, setConnections] = useState<TeamConnection[]>([])
  const [pendingConnections, setPendingConnections] = useState<TeamConnection[]>([])
  const [teamDirectory, setTeamDirectory] = useState<TeamDirectoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState('')
  const [connectionRefresh, setConnectionRefresh] = useState(0)
  const [storageWarning, setStorageWarning] = useState('')
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [resolvedRole, entitlements])
  const accessToken = session?.access_token || ''
  const { isMobile } = useViewportBreakpoints()

  useEffect(() => {
    let active = true

    if (!authResolved && !accessToken) {
      // Do not leave the public shell on an indefinite team loader while
      // Supabase restores a mobile session. Once auth resolves this effect
      // runs again and fetches the connected teams automatically.
      setLoading(false)
      return () => {
        active = false
      }
    }

    async function loadConnections() {
      const cachedConnections = accessToken ? getCachedTeamConnections(accessToken, { userId }) : null
      setConnectionError('')
      setLoading(!cachedConnections)

      if (cachedConnections) {
        setConnections(cachedConnections.connections)
        setPendingConnections(cachedConnections.pending)
        void loadSupportingTeamContext(cachedConnections.connections)
        if (connectionRefresh === 0) return
      }

      try {
        const connectionResult = accessToken
          ? await fetchTeamConnections(accessToken, { force: connectionRefresh > 0, userId })
          : { pending: [], connections: [], offers: null }

        if (!active) return

        setConnections(connectionResult.connections)
        setPendingConnections(connectionResult.pending)
        void loadSupportingTeamContext(connectionResult.connections)
      } catch (error) {
        if (!active) return
        if (!cachedConnections) {
          setConnectionError(error instanceof Error ? error.message : 'Your teams could not be refreshed. Please try again.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    async function loadSupportingTeamContext(connectedTeams: TeamConnection[]) {
      // A connected USTA team does not need a second, broad TIQ-entry read to
      // remain usable. That optional read was the source of the misleading
      // "cloud sync" banner even though the team connection itself succeeded.
      const needsTiqParticipationContext = connectedTeams.some((connection) => connection.sourceType === 'tiq_entry')
      const [participationResult, teamOptions] = await Promise.all([
        needsTiqParticipationContext
          ? listTiqTeamParticipations()
          : Promise.resolve({ entries: [], source: 'supabase' as const, warning: null }),
        connectedTeams.length > 0
          ? loadConnectedTeamDirectoryOptions(connectedTeams.map((connection) => connection.teamName)).catch(() => [])
          : Promise.resolve([]),
      ])

      if (!active) return

      setParticipations(participationResult.entries)
      setTeamDirectory(teamOptions)
      setStorageWarning(needsTiqParticipationContext ? participationResult.warning || '' : '')
    }

    void loadConnections()

    return () => {
      active = false
    }
  }, [accessToken, authResolved, connectionRefresh, userId])

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
        connection: TeamConnection
      }
    >()

    for (const connection of connections) {
      const matchingParticipations = participations.filter((entry) => (
        entry.teamName.toLowerCase() === connection.teamName.toLowerCase()
        && (!connection.leagueName || !entry.sourceLeagueName || entry.sourceLeagueName.toLowerCase() === connection.leagueName.toLowerCase())
        && (!connection.flight || !entry.sourceFlight || entry.sourceFlight.toLowerCase() === connection.flight.toLowerCase())
      ))
      const directoryOption = teamDirectory.find((option) => (
        option.team.toLowerCase() === connection.teamName.toLowerCase()
        && (!connection.leagueName || !option.league || option.league.toLowerCase() === connection.leagueName.toLowerCase())
        && (!connection.flight || !option.flight || option.flight.toLowerCase() === connection.flight.toLowerCase())
      )) || directoryByTeam.get(connection.teamName) || null
      const key = `${connection.teamName}__${connection.leagueName}__${connection.flight}`
      if (!grouped.has(key)) {
        grouped.set(key, {
          teamName: connection.teamName,
          sourceLeagueName: connection.leagueName,
          sourceFlight: connection.flight,
          tiqLeagues: matchingParticipations,
          directoryOption,
          connection,
        })
      }
    }

    return Array.from(grouped.values()).sort((left, right) => {
      if (right.tiqLeagues.length !== left.tiqLeagues.length) {
        return right.tiqLeagues.length - left.tiqLeagues.length
      }
      return left.teamName.localeCompare(right.teamName)
    })
  }, [connections, participations, teamDirectory])

  return (
    <>
      {!loading && !connectionError && (!userId || groupedTeams.length === 0) ? (
        <TeamAccountAccessPanel
          authResolved={authResolved}
          signedIn={Boolean(userId)}
          linkedTeamCount={connections.length}
          pendingTeamCount={pendingConnections.length}
          playerToolsActive={access.canUseAdvancedPlayerInsights}
          captainToolsActive={access.canUseCaptainWorkflow}
          isMobile={isMobile}
        />
      ) : null}

      <section
        id="tiq-entered-teams"
        style={{
          ...sectionStyle,
          marginTop: isMobile ? 0 : sectionStyle.marginTop,
          padding: isMobile ? '16px' : sectionStyle.padding,
          borderRadius: isMobile ? '20px' : sectionStyle.borderRadius,
        }}
      >
        {isMobile ? (
          <h1 style={mobileTeamsTitleStyle}>{userId ? 'Your teams' : 'Explore teams'}</h1>
        ) : (
          <div style={sectionEyebrowStyle}>{userId ? 'Your teams' : 'Explore teams'}</div>
        )}
        <div style={sectionTextStyle}>
          {connectionError
            ? 'Your teams did not finish loading. Nothing has been changed.'
            : loading
            ? 'Getting your teams...'
            : groupedTeams.length > 0
              ? 'Open a team for its roster, schedule, stats, and Team Chat.'
              : userId
                ? 'Accept a team connection or connect your player profile to bring your teams here.'
                : 'Public team pages are open now. Accepted team connections appear here after registration.'}
        </div>

        {storageWarning ? <div style={warningStyle}>{storageWarning}</div> : null}
        {connectionError ? (
          <TeamListLoadError message={connectionError} onRetry={() => setConnectionRefresh((value) => value + 1)} />
        ) : loading ? (
          <TeamListLoadingState />
        ) : groupedTeams.length === 0 ? (
          <EmptyTeamsState signedIn={Boolean(userId)} pendingTeamCount={pendingConnections.length} />
        ) : (
          <div style={listStyle}>
            {groupedTeams.map((group) => {
              const competitionLayer = group.connection.sourceType === 'tiq_entry' || group.tiqLeagues.length > 0 ? 'tiq' : 'usta'
              const teamPageHref = buildTeamProfileHref(group.teamName, {
                layer: competitionLayer,
                league: group.sourceLeagueName,
                flight: group.sourceFlight,
              })
              const lineupHref = buildCaptainScopedHref('/captain/lineup-builder', {
                competitionLayer,
                team: group.teamName,
                league: group.sourceLeagueName || undefined,
                flight: group.sourceFlight || undefined,
              })
              const teamRoomHref = buildTeamRoomHref({
                teamName: group.teamName,
                leagueName: group.sourceLeagueName,
                flight: group.sourceFlight,
              })
              const canStartTeamLineup = access.canUseCaptainWorkflow || isCaptainTeamConnection(group.connection.roles)
              const teamFacts = [
                {
                  label: 'Team connection',
                  value: 'Connected',
                },
                {
                  label: 'Match history',
                  value: group.directoryOption ? `${group.directoryOption.matchCount} matches` : 'Match data syncing',
                },
              ]
              const teamMetaItems = [
                group.sourceLeagueName,
                group.sourceFlight,
              ].filter(Boolean)

              return (
                <div
                  key={`${group.teamName}-${group.sourceLeagueName}-${group.sourceFlight}`}
                  style={{
                    ...rowStyle,
                    padding: isMobile ? '14px' : rowStyle.padding,
                    borderRadius: isMobile ? '16px' : rowStyle.borderRadius,
                  }}
                >
                  <div style={teamCopyStyle}>
                    <div style={{ ...rowTitleStyle, fontSize: isMobile ? '17px' : rowTitleStyle.fontSize }}>{group.teamName}</div>
                    <div style={rowMetaStyle}>
                      {teamMetaItems.map((item) => <span key={item} style={rowMetaChipStyle}>{item}</span>)}
                    </div>
                    <div style={rowSubtleStyle}>
                      {getTeamConnectionRolesLabel(group.connection.roles)} connection
                    </div>
                    <dl style={teamFactsStyle} aria-label={`${group.teamName} team status`}>
                      {teamFacts.map((item) => (
                        <div key={item.label} style={teamFactStyle}>
                          <dt style={teamFactLabelStyle}>{item.label}</dt>
                          <dd style={teamFactValueStyle}>{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <Link href={teamPageHref} style={{ ...teamPrimaryActionStyle, width: isMobile ? '100%' : undefined }}>
                      Open team
                    </Link>
                  </div>
                  <div style={isMobile ? { ...teamRowActionStyle, ...teamRowActionMobileStyle } : teamRowActionStyle}>
                    <Link href={teamRoomHref} style={teamSecondaryLinkStyle}>Team Chat</Link>
                    {canStartTeamLineup ? (
                      <Link href={lineupHref} style={teamSecondaryLinkStyle}>Build lineup</Link>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {!loading && userId && groupedTeams.length > 0 && pendingConnections.length > 0 ? (
        <TeamAccountAccessPanel
          authResolved={authResolved}
          signedIn
          linkedTeamCount={connections.length}
          pendingTeamCount={pendingConnections.length}
          playerToolsActive={access.canUseAdvancedPlayerInsights}
          captainToolsActive={access.canUseCaptainWorkflow}
          isMobile={isMobile}
        />
      ) : null}

      <TeamToolsDisclosure label="Find or manage a team">
        <TeamPathPanel />
        <details className="competeDetailsSection" style={teamMoreOptionsStyle}>
          <summary style={teamMoreOptionsSummaryStyle}>More team options</summary>
          <div style={teamMoreOptionsBodyStyle}>
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
          </div>
        </details>
      </TeamToolsDisclosure>

      {authResolved && userId ? (
        <TeamSupportDisclosure>
          <TeamPlayerIdPrepPanel />
        </TeamSupportDisclosure>
      ) : null}

      {authResolved && userId ? (
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
        <span style={teamSupportCueStyle}>View</span>
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
        <span style={teamSupportCueStyle}>View</span>
      </summary>
      <div style={teamSupportBodyStyle}>{children}</div>
    </details>
  )
}

function TeamToolsDisclosure({ children, label }: { children: ReactNode; label: string }) {
  return (
    <details className="competeDetailsSection" style={teamSupportDisclosureStyle}>
      <summary style={teamSupportSummaryStyle}>
        <span style={teamSupportSummaryCopyStyle}>{label}</span>
        <span style={teamSupportCueStyle}>View</span>
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

function TeamAccountAccessPanel({
  authResolved,
  signedIn,
  linkedTeamCount,
  pendingTeamCount,
  playerToolsActive,
  captainToolsActive,
  isMobile,
}: {
  authResolved: boolean
  signedIn: boolean
  linkedTeamCount: number
  pendingTeamCount: number
  playerToolsActive: boolean
  captainToolsActive: boolean
  isMobile: boolean
}) {
  const title = !authResolved
    ? 'Checking your team access...'
    : !signedIn
      ? 'Register to access your teams.'
      : linkedTeamCount > 0
        ? `${linkedTeamCount} team${linkedTeamCount === 1 ? '' : 's'} connected.`
        : pendingTeamCount > 0
          ? `${pendingTeamCount} team connection${pendingTeamCount === 1 ? '' : 's'} waiting.`
          : 'Connect your first team.'

  return (
    <section
      style={{
        ...accountAccessStyle,
        padding: isMobile ? '16px' : accountAccessStyle.padding,
        borderRadius: isMobile ? '20px' : accountAccessStyle.borderRadius,
        gap: isMobile ? '12px' : accountAccessStyle.gap,
      }}
      aria-label="Teams account access"
    >
      <div style={emptyTeamsCopyStyle}>
        <span style={sectionEyebrowStyle}>Team access</span>
        <strong style={accountAccessTitleStyle}>{title}</strong>
        <span style={sectionTextStyle}>
          {!signedIn
            ? 'A Free account includes every accepted team’s roster, schedule, stats, and private Team Chat.'
            : 'Team access is included. Player adds personalized improvement tools; Captain adds lineup and match-week decisions.'}
        </span>
        {signedIn && linkedTeamCount > 0 ? (
          <span style={accountTierCueStyle}>
            {captainToolsActive ? 'Captain tools active' : playerToolsActive ? 'Player tools active' : 'Free team access active'}
          </span>
        ) : null}
      </div>
      <div style={isMobile && !signedIn ? { ...emptyTeamsActionRowStyle, ...mobileActionGridStyle } : emptyTeamsActionRowStyle}>
        {!signedIn ? (
          <>
            <Link href="/join?next=%2Fcompete%2Fteams" style={teamPrimaryActionStyle}>Register Free</Link>
            <Link href="/login?next=%2Fcompete%2Fteams" style={teamSecondaryLinkStyle}>Sign in</Link>
          </>
        ) : (
          <Link href="/team-connections" style={teamPrimaryActionStyle}>
            {pendingTeamCount > 0 ? 'Review team connections' : 'Connect a team'}
          </Link>
        )}
      </div>
    </section>
  )
}

function EmptyTeamsState({ signedIn, pendingTeamCount }: { signedIn: boolean; pendingTeamCount: number }) {
  return (
    <div style={emptyTeamsStyle}>
      <div style={emptyTeamsCopyStyle}>
        <strong>{signedIn ? 'No accepted team connections yet.' : 'Explore public teams now.'}</strong>
        <span>
          {signedIn
            ? pendingTeamCount > 0
              ? 'Review the team connection waiting for you, then its Team Chat and team tools will open here.'
              : 'Connect your player profile, accept a team invitation, or find the team already in the public map.'
            : 'Check rosters, records, standings, and recent results without an account.'}
        </span>
      </div>
      <div style={emptyTeamsActionRowStyle}>
        {signedIn ? (
          <Link href="/team-connections" style={emptyTeamsActionStyle}>{pendingTeamCount > 0 ? 'Review connections' : 'Connect team'}</Link>
        ) : null}
        <Link href="/teams" style={emptyTeamsActionStyle}>Browse public teams</Link>
      </div>
    </div>
  )
}

function TeamListLoadingState() {
  return (
    <div style={teamLoadingStyle} role="status" aria-live="polite">
      <TiqFeatureIcon name="teamRankings" size="sm" variant="ghost" />
      <span>
        <strong style={teamLoadingTitleStyle}>Getting your teams</strong>
        <span style={teamLoadingTextStyle}>Your connected team will appear here as soon as it is ready.</span>
      </span>
    </div>
  )
}

function TeamListLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={teamLoadErrorStyle} role="alert">
      <TiqFeatureIcon name="teamRankings" size="sm" variant="ghost" />
      <span style={teamLoadErrorCopyStyle}>
        <strong style={teamLoadingTitleStyle}>We could not refresh your teams.</strong>
        <span style={teamLoadingTextStyle}>{message}</span>
      </span>
      <button type="button" onClick={onRetry} style={teamLoadRetryStyle}>Try again</button>
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

const mobileTeamsTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: '28px',
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: '-0.02em',
}

const teamLoadingStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  alignItems: 'center',
  gap: '12px',
  minHeight: '88px',
  padding: '14px',
  borderRadius: '16px',
  border: '1px solid rgba(155, 225, 29, 0.18)',
  background: 'rgba(7, 18, 36, 0.72)',
}

const teamLoadingTitleStyle: CSSProperties = {
  display: 'block',
  color: 'var(--foreground-strong)',
  fontSize: '15px',
  lineHeight: 1.25,
  fontWeight: 850,
}

const teamLoadingTextStyle: CSSProperties = {
  display: 'block',
  marginTop: '3px',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.45,
  fontWeight: 600,
}

const teamLoadErrorStyle: CSSProperties = {
  ...teamLoadingStyle,
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  borderColor: 'rgba(255, 163, 112, 0.32)',
}

const teamLoadErrorCopyStyle: CSSProperties = {
  minWidth: 0,
}

const teamLoadRetryStyle: CSSProperties = {
  gridColumn: '1 / -1',
  width: '100%',
  minHeight: 40,
  padding: '8px 12px',
  border: '1px solid rgba(116,190,255,0.32)',
  borderRadius: 12,
  background: 'rgba(16, 35, 63, 0.76)',
  color: 'var(--foreground-strong)',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 13,
  fontWeight: 850,
}

const accountAccessStyle: CSSProperties = {
  ...sectionStyle,
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
  alignItems: 'center',
  marginTop: 0,
  borderColor: 'rgba(155,225,29,0.24)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.09), rgba(116,190,255,0.05)), rgba(8,16,34,0.78)',
}

const accountAccessTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(20px, 4vw, 28px)',
  lineHeight: 1.12,
  fontWeight: 950,
}

const accountTierCueStyle: CSSProperties = {
  width: 'fit-content',
  maxWidth: '100%',
  padding: '6px 10px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'rgba(155,225,29,0.10)',
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 900,
}

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
  lineHeight: 1.3,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const teamSupportSummaryCopyStyle: CSSProperties = {
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const teamSupportCueStyle: CSSProperties = {
  flex: '0 0 auto',
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  whiteSpace: 'nowrap',
}

const teamSupportBodyStyle: CSSProperties = {
  minWidth: 0,
  padding: '0 10px 10px',
}

const teamMoreOptionsStyle: CSSProperties = {
  minWidth: 0,
  borderTop: '1px solid rgba(116,190,255,0.12)',
}

const teamMoreOptionsSummaryStyle: CSSProperties = {
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  padding: '0 4px',
  color: 'var(--brand-blue-2)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 900,
}

const teamMoreOptionsBodyStyle: CSSProperties = {
  minWidth: 0,
  paddingTop: 10,
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

const mobileActionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  alignItems: 'stretch',
  width: '100%',
}

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
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  marginTop: '4px',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.6,
  overflowWrap: 'anywhere',
} as const

const rowMetaChipStyle = {
  display: 'inline-flex',
  maxWidth: '100%',
  minWidth: 0,
  padding: '3px 7px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(116,190,255,0.06)',
  overflowWrap: 'anywhere',
} as const

const rowSubtleStyle = {
  marginTop: '6px',
  color: 'var(--foreground)',
  fontSize: '12px',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
} as const

const teamFactsStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '12px',
  margin: '12px 0',
  padding: '10px 0',
  borderTop: '1px solid rgba(116,190,255,0.10)',
  borderBottom: '1px solid rgba(116,190,255,0.10)',
  minWidth: 0,
} as const

const teamFactStyle = {
  minWidth: 0,
} as const

const teamFactLabelStyle: CSSProperties = {
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 750,
  lineHeight: 1.3,
  overflowWrap: 'anywhere',
}

const teamFactValueStyle: CSSProperties = {
  margin: '3px 0 0',
  minWidth: 0,
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 850,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
}

const teamPrimaryActionStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '42px',
  minWidth: 0,
  padding: '7px 12px',
  borderRadius: '12px',
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.11)',
  color: '#f5ffe2',
  fontSize: '13px',
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

const teamRowActionStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const teamRowActionMobileStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 108px), 1fr))',
  justifyContent: 'stretch',
  width: '100%',
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
