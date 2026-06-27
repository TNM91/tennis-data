'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type MouseEvent } from 'react'
import NavLockIcon from '@/app/components/nav-lock-icon'
import { useAuth } from '@/app/components/auth-provider'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { buildProductAccessState, type ProductAccessState } from '@/lib/access-model'
import { getPortalLaneTarget } from '@/lib/portal-lane-routing'
import { isPortalTaskActive } from '@/lib/portal-task-active'
import { getPortalTaskTarget } from '@/lib/portal-task-target'
import { PLATFORM_POSITIONING, PRODUCT_MOTTO } from '@/lib/product-story'
import { loadUserProfileLink } from '@/lib/user-profile'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type PortalLaneId = 'find' | 'you' | 'compete' | 'coach' | 'team' | 'league'

const dataAssistPortalHref = '/data-assist?intent=upload-source&context=Portal'

type PortalLane = {
  id: PortalLaneId
  label: string
  cue: string
  route: string
  icon: TiqFeatureIconName
  planRoute: '/explore' | '/player-development' | '/mylab' | '/compete' | '/coach' | '/captain' | '/league-coordinator'
  paths: string[]
  searchScope: 'players' | 'teams' | 'leagues'
  tasks: Array<{
    title: string
    detail: string
    metric: string
    href: string
    icon: TiqFeatureIconName
    requiredRoute: '/explore' | '/mylab' | '/compete' | '/coach' | '/captain' | '/league-coordinator'
  }>
}

const portalLanes: PortalLane[] = [
  {
    id: 'find',
    label: 'Explore',
    cue: 'Players, teams, leagues, events',
    route: '/explore',
    planRoute: '/explore',
    icon: 'opponentScouting',
    paths: ['/explore', '/players', '/teams', '/rankings', '/leagues'],
    searchScope: 'players',
    tasks: [
      { title: 'Find a player', detail: 'Public profiles, rating shape, and team context.', metric: 'Free', href: '/explore/players', icon: 'playerRatings', requiredRoute: '/explore' },
      { title: 'Browse teams', detail: 'Rosters, sections, records, and nearby competition.', metric: 'Free', href: '/explore/teams', icon: 'lineupBuilder', requiredRoute: '/explore' },
      { title: 'Check standings', detail: 'League tables and flight context.', metric: 'Free', href: '/explore/leagues', icon: 'schedule', requiredRoute: '/explore' },
      { title: 'Check rankings', detail: 'Scan the field before opening a player or flight.', metric: 'Free', href: '/explore/rankings', icon: 'reports', requiredRoute: '/explore' },
    ],
  },
  {
    id: 'you',
    label: 'Improve',
    cue: 'Drills, skills, My Lab',
    route: '/player-development',
    planRoute: '/player-development',
    icon: 'myLab',
    paths: ['/mylab', '/profile', '/messages', '/data-assist', '/matchup', '/level-up', '/player-development', '/resources', '/tactics'],
    searchScope: 'players',
    tasks: [
      { title: 'Open My Lab', detail: 'Your scorecard, goals, follows, and next read.', metric: 'Player', href: '/mylab', icon: 'myLab', requiredRoute: '/mylab' },
      { title: 'Level Up', detail: 'Choose a training card, run the rep, and save proof.', metric: 'Player', href: '/level-up', icon: 'matchPrep', requiredRoute: '/mylab' },
      { title: 'Tactics Tools', detail: 'Map the court pattern before practice or your next match.', metric: 'Player', href: '/tactics', icon: 'scenarioBuilder', requiredRoute: '/mylab' },
      { title: 'Fix tennis context', detail: 'Upload, report, or refresh the tennis context behind your read.', metric: 'Player', href: dataAssistPortalHref, icon: 'reports', requiredRoute: '/mylab' },
      { title: 'Prep matchup', detail: 'Compare the court before you play.', metric: 'Player', href: '/matchup', icon: 'matchupAnalysis', requiredRoute: '/mylab' },
      { title: 'Review messages', detail: 'Keep tennis replies and alerts together.', metric: 'Inbox', href: '/messages', icon: 'messagingCenter', requiredRoute: '/mylab' },
    ],
  },
  {
    id: 'compete',
    label: 'Compete',
    cue: 'Matchups, scouting, lineups',
    route: '/compete',
    planRoute: '/compete',
    icon: 'matchupAnalysis',
    paths: ['/compete', '/matchup'],
    searchScope: 'players',
    tasks: [
      { title: 'Prep matchup', detail: 'Compare the court before you play.', metric: 'Prep', href: '/matchup', icon: 'matchupAnalysis', requiredRoute: '/compete' },
      { title: 'Scout players', detail: 'Read ratings, recent context, and player signals.', metric: 'Scout', href: '/explore/players', icon: 'playerRatings', requiredRoute: '/compete' },
      { title: 'Build lineup', detail: 'Turn roster, opponent, and partner context into a plan.', metric: 'Captain', href: '/captain/lineup-builder', icon: 'lineupBuilder', requiredRoute: '/compete' },
      { title: 'Track results', detail: 'Use scores and match history to guide the next decision.', metric: 'Results', href: '/compete/results', icon: 'reports', requiredRoute: '/compete' },
    ],
  },
  {
    id: 'coach',
    label: 'Coaches',
    cue: 'Support player development',
    route: '/coach',
    planRoute: '/coach',
    icon: 'scenarioBuilder',
    paths: ['/coach', '/coaches', '/player-development', '/tactics'],
    searchScope: 'players',
    tasks: [
      { title: 'Player bench', detail: 'Open your roster, player profiles, assignments, and next coaching moves.', metric: 'Coach', href: '/coach#coach-linked-dashboard', icon: 'playerRatings', requiredRoute: '/coach' },
      { title: 'Tactical Studio', detail: 'Map the drill or pattern before assigning it.', metric: 'Coach', href: '/tactics', icon: 'matchPrep', requiredRoute: '/coach' },
      { title: 'Level Up library', detail: 'Assign training modules and keep player work aligned.', metric: 'Coach', href: '/level-up', icon: 'reports', requiredRoute: '/coach' },
      { title: 'Coach-player messages', detail: 'Keep lesson follow-up tied to player goals and assignments.', metric: 'Inbox', href: '/messages', icon: 'messagingCenter', requiredRoute: '/coach' },
    ],
  },
  {
    id: 'team',
    label: 'Manage',
    cue: 'Teams and match week',
    route: '/captain',
    planRoute: '/captain',
    icon: 'lineupBuilder',
    paths: ['/captain', '/manage', '/compete/teams'],
    searchScope: 'teams',
    tasks: [
      { title: 'Who can play', detail: 'Availability and readiness before lineup pressure.', metric: 'Captain', href: '/captain/availability', icon: 'reliabilityIndex', requiredRoute: '/captain' },
      { title: 'Plan practice', detail: 'Schedule practice, invite the roster, and collect RSVPs.', metric: 'Captain', href: '/captain/practice', icon: 'schedule', requiredRoute: '/captain' },
      { title: 'Map tactics', detail: 'Build a court picture for the next point, drill, or team pattern.', metric: 'Coach beta', href: '/tactics', icon: 'scenarioBuilder', requiredRoute: '/captain' },
      { title: 'Build lineup', detail: 'Turn the roster into the weekly plan.', metric: 'Captain', href: '/captain/lineup-builder', icon: 'lineupBuilder', requiredRoute: '/captain' },
      { title: 'Send plan', detail: 'Message the team from Team Hub.', metric: 'Captain', href: '/captain/messaging', icon: 'messagingCenter', requiredRoute: '/captain' },
    ],
  },
  {
    id: 'league',
    label: 'Leagues & Tournaments',
    cue: 'Schedules, scores, events',
    route: '/leagues-and-tournaments',
    planRoute: '/league-coordinator',
    icon: 'teamRankings',
    paths: ['/leagues-and-tournaments', '/league-coordinator', '/tournaments', '/compete/leagues', '/compete/schedule', '/explore/leagues', '/leagues'],
    searchScope: 'leagues',
    tasks: [
      { title: 'Shared calendar', detail: 'Publish, propose, confirm, and track match dates.', metric: 'League', href: '/compete/schedule', icon: 'schedule', requiredRoute: '/explore' },
      { title: 'Build tournament', detail: 'Create a draw, seed entrants, and preview the path.', metric: 'Full-Court', href: '/league-coordinator/tournaments', icon: 'teamRankings', requiredRoute: '/league-coordinator' },
      { title: 'Team book', detail: 'Enter team results and keep standings moving.', metric: 'League', href: '/league-coordinator/results', icon: 'reports', requiredRoute: '/league-coordinator' },
      { title: 'Player book', detail: 'Run individual leagues with clear records.', metric: 'League', href: '/league-coordinator/individual-results', icon: 'playerRatings', requiredRoute: '/league-coordinator' },
    ],
  },
]

const hiddenPrefixes = ['/login', '/join', '/legal', '/reset-password', '/forget-password']
const portalSurfaceBackground = 'var(--portal-surface-bg)'
const portalActiveCardBackground = 'var(--portal-active-card-bg)'
const mobilePortalDockBackground =
  'linear-gradient(180deg, rgba(7, 13, 27, 0.94) 0%, rgba(8, 18, 34, 0.96) 100%)'

function getActiveLane(pathname: string) {
  const matches = portalLanes.flatMap((lane) =>
    lane.paths
      .filter((path) => pathname === path || pathname.startsWith(`${path}/`))
      .map((path) => ({ lane, path })),
  )

  matches.sort((left, right) => right.path.length - left.path.length)
  return matches[0]?.lane ?? portalLanes[0]
}

function isPortalHidden(pathname: string) {
  return hiddenPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function getMetadataFirstName(session: ReturnType<typeof useAuth>['session']) {
  const metadata = session?.user?.user_metadata || {}
  const raw =
    typeof metadata.name === 'string'
      ? metadata.name
      : typeof metadata.full_name === 'string'
        ? metadata.full_name
        : typeof metadata.display_name === 'string'
          ? metadata.display_name
          : ''
  return raw.trim().split(' ')[0] || ''
}

export default function PortalToolBar() {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const { role, userId, entitlements, authResolved, session } = useAuth()
  const { screenWidth, isMobile, isSmallMobile } = useViewportBreakpoints()
  const [query, setQuery] = useState('')
  const [profileName, setProfileName] = useState('')
  const [profileLinked, setProfileLinked] = useState(false)
  const [mobilePortalLaneState, setMobilePortalLaneState] = useState<{ pathname: string; laneId: PortalLaneId | null }>({
    pathname: '',
    laneId: null,
  })
  const [currentHash, setCurrentHash] = useState('')

  const authenticated = Boolean(userId) || role !== 'public'
  const accessPending = authenticated && (!authResolved || entitlements === null)
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [resolvedRole, entitlements])
  const activeLane = getActiveLane(pathname)
  const metadataFirstName = getMetadataFirstName(session)
  const firstName = metadataFirstName || profileName.split(' ')[0] || ''

  useEffect(() => {
    let active = true

    async function loadName() {
      if (!authResolved || !userId) {
        setProfileName('')
        setProfileLinked(false)
        return
      }

      const result = await loadUserProfileLink(userId)
      if (!active) return
      setProfileName(result.data?.message_display_name || result.data?.linked_player_name || '')
      setProfileLinked(Boolean(result.data?.linked_player_id || result.data?.linked_player_name))
    }

    void loadName()

    return () => {
      active = false
    }
  }, [authResolved, userId])

  useEffect(() => {
    function syncCurrentHash() {
      setCurrentHash(window.location.hash || '')
    }

    syncCurrentHash()
    window.addEventListener('hashchange', syncCurrentHash)
    return () => window.removeEventListener('hashchange', syncCurrentHash)
  }, [pathname])

  if (isPortalHidden(pathname)) return null
  const publicVisitor = !authenticated
  const showPublicTasks = !(publicVisitor && isMobile)
  const visibleTasks = publicVisitor ? (showPublicTasks ? activeLane.tasks.slice(0, 4) : []) : activeLane.tasks
  const showPortalBrandRunway = publicVisitor && pathname === '/' && !isMobile
  const collapseMobilePortal = isMobile
  const mobilePortalLaneId = mobilePortalLaneState.pathname === pathname ? mobilePortalLaneState.laneId : null
  const mobilePortalLane = mobilePortalLaneId ? portalLanes.find((lane) => lane.id === mobilePortalLaneId) ?? activeLane : null
  const currentPortalPath = `${pathname}${currentHash}`
  const mobilePortalHasActiveTask = mobilePortalLane
    ? mobilePortalLane.tasks.some((task) => isPortalTaskActive(currentPortalPath, task.href))
    : false
  const mobilePortalStickyTop = 'var(--header-height)'
  const showExpandedPortalIntro = !collapseMobilePortal
  const portalMenuId = 'tenaceiq-mobile-portal-menu'

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams({ scope: activeLane.searchScope })
    if (query.trim()) params.set('q', query.trim())
    router.push(`/explore/search?${params.toString()}`)
  }

  function handleMobilePortalLaneSelect(event: MouseEvent<HTMLButtonElement>, laneId: PortalLaneId) {
    event.currentTarget.blur()
    setMobilePortalLaneState({ pathname, laneId })
  }

  function handleMobilePortalMainSelect(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.blur()
    setMobilePortalLaneState({ pathname, laneId: null })
  }

  function handleMobilePortalNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
    event.currentTarget.blur()

    try {
      const target = new URL(href, window.location.origin)
      if (target.pathname === pathname) setCurrentHash(target.hash || '')
    } catch {
      // Relative URLs should always parse, but navigation should not fail if one does not.
    }
  }

  const headline = authenticated
    ? firstName
      ? `Hi ${firstName}, welcome back!`
      : 'Welcome back.'
    : PRODUCT_MOTTO
  const activeAccent = getLaneAccent(activeLane.id)

  return (
    <>
    <section
      aria-label="TenAceIQ platform navigation"
      style={{
        position: collapseMobilePortal ? 'sticky' : 'relative',
        top: collapseMobilePortal ? mobilePortalStickyTop : undefined,
        zIndex: collapseMobilePortal ? 32 : 25,
        width: '100%',
        boxSizing: 'border-box',
        padding: collapseMobilePortal
          ? '0 max(8px, env(safe-area-inset-right)) 6px max(8px, env(safe-area-inset-left))'
          : publicVisitor
            ? isMobile
              ? '10px 8px 8px'
              : '10px 16px 8px'
            : isMobile
              ? '14px 8px 10px'
              : '18px 16px 12px',
        overflow: 'clip',
        background: collapseMobilePortal ? mobilePortalDockBackground : undefined,
        borderBottom: collapseMobilePortal ? '1px solid rgba(116,190,255,0.12)' : undefined,
        boxShadow: collapseMobilePortal ? '0 10px 22px rgba(2,10,24,0.14)' : undefined,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 'min(1280px, 100%)',
          margin: '0 auto',
          display: 'grid',
          gap: publicVisitor ? 10 : isMobile ? 14 : 16,
          padding: collapseMobilePortal ? '5px 0 0' : publicVisitor ? (isSmallMobile ? 12 : 14) : isSmallMobile ? 16 : isMobile ? 18 : 20,
          borderRadius: collapseMobilePortal ? 0 : publicVisitor ? (isSmallMobile ? 18 : 20) : isSmallMobile ? 24 : 28,
          border: collapseMobilePortal ? '0' : '1px solid rgba(116,190,255,0.15)',
          background: collapseMobilePortal ? 'transparent' : portalSurfaceBackground,
          color: 'var(--foreground)',
          boxShadow: collapseMobilePortal ? 'none' : '0 28px 80px rgba(2, 10, 24, 0.28), inset 0 1px 0 rgba(255,255,255,0.06)',
          minWidth: 0,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {collapseMobilePortal ? (
          <div
            id={portalMenuId}
            style={mobilePortalLane ? mobilePortalActionPaletteStyle : mobilePortalPaletteStyle}
            aria-label={mobilePortalLane ? `${mobilePortalLane.label} actions` : 'Main TenAceIQ menu'}
            aria-live="polite"
          >
            {mobilePortalLane ? (
              <>
                <button
                  type="button"
                  onClick={handleMobilePortalMainSelect}
                  style={mobilePortalBackTileStyle}
                  aria-label="Show main TenAceIQ menu"
                >
                  <span style={mobilePortalTileIconStyle}>
                    <TiqFeatureIcon name="opponentScouting" size="sm" variant="ghost" />
                  </span>
                  <span style={mobilePortalTileLabelStyle}>Main</span>
                </button>
                <MobilePortalHubTile
                  lane={mobilePortalLane}
                  access={access}
                  authenticated={authenticated}
                  accessPending={accessPending}
                  active={!mobilePortalHasActiveTask && pathname === mobilePortalLane.route && !currentHash}
                  profileLinked={profileLinked}
                  accent={getLaneAccent(mobilePortalLane.id)}
                  onActivate={handleMobilePortalNavigation}
                />
                {mobilePortalLane.tasks.slice(0, 4).map((task) => (
                  <MobilePortalTaskTile
                    key={task.title}
                    task={task}
                    access={access}
                    authenticated={authenticated}
                    accessPending={accessPending}
                    active={isPortalTaskActive(currentPortalPath, task.href)}
                    profileLinked={profileLinked}
                    accent={getLaneAccent(mobilePortalLane.id)}
                    onActivate={handleMobilePortalNavigation}
                  />
                ))}
              </>
            ) : portalLanes.map((lane) => (
              <button
                key={lane.id}
                type="button"
                onClick={(event) => handleMobilePortalLaneSelect(event, lane.id)}
                style={{
                  ...mobilePortalTileStyle,
                  borderColor: lane.id === activeLane.id ? getLaneAccent(lane.id) : 'rgba(116,190,255,0.15)',
                  background: lane.id === activeLane.id ? portalActiveCardBackground : 'rgba(255,255,255,0.045)',
                }}
                aria-pressed={lane.id === activeLane.id}
                aria-label={`${lane.label}: ${lane.cue}`}
              >
                <span style={mobilePortalTileIconStyle}>
                  <TiqFeatureIcon name={lane.icon} size="sm" variant={lane.id === activeLane.id ? 'surface' : 'ghost'} />
                </span>
                <span style={mobilePortalTileLabelStyle}>{getMobileLaneLabel(lane.id)}</span>
              </button>
            ))}
          </div>
        ) : (
          <>

          <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gap: publicVisitor ? 10 : isMobile ? 14 : 16,
            minWidth: 0,
          }}
        >
          {showExpandedPortalIntro ? (
            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 6, minWidth: 0 }}>
              <div style={{ ...portalTitleStyle, ...(publicVisitor ? publicPortalTitleStyle : null) }}>{headline}</div>
              <p style={{ ...portalSubtitleStyle, ...(publicVisitor ? publicPortalSubtitleStyle : null) }}>
                {authenticated ? 'What do we want to work on today?' : PLATFORM_POSITIONING}
              </p>
            </div>
          ) : null}

          {showPortalBrandRunway ? (
            <div
              aria-hidden="true"
              style={{
                ...portalBrandRunwayStyle,
                minHeight: isMobile ? 152 : 198,
              }}
            >
              <span
                style={{
                  ...portalBrandRunwayMarkStyle,
                  width: isMobile ? 'min(84vw, 320px)' : 'min(38vw, 420px)',
                  opacity: isMobile ? 0.38 : 0.34,
                }}
              />
            </div>
          ) : null}

          <nav
            aria-label="Choose a TenAceIQ tool"
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'grid',
              gridTemplateColumns: publicVisitor && isMobile
                ? screenWidth < 360
                  ? 'minmax(0, 1fr)'
                  : 'repeat(2, minmax(0, 1fr))'
                : isMobile
                  ? 'minmax(0, 1fr)'
                  : 'repeat(6, minmax(0, 1fr))',
              gap: 10,
              minWidth: 0,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {portalLanes.map((lane) => (
              <PortalLaneCard
                key={lane.id}
                lane={lane}
                active={lane.id === activeLane.id}
                access={access}
                authenticated={authenticated}
                accessPending={accessPending}
                profileLinked={profileLinked}
                compact={publicVisitor}
                mobileCompact={publicVisitor && isMobile}
              />
            ))}
          </nav>

          <form
            onSubmit={handleSearch}
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'grid',
              gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, auto)',
              gap: 12,
              minWidth: 0,
            }}
          >
            <label style={{ ...searchShellStyle, ...(publicVisitor ? compactSearchShellStyle : null) }}>
              <SearchIcon />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search players, teams, leagues, tournaments, coaches, resources..."
                aria-label="Search players, teams, leagues, tournaments, coaches, and resources"
                style={searchInputStyle}
              />
            </label>
            <button type="submit" style={{ ...searchButtonStyle, ...(publicVisitor ? compactSearchButtonStyle : null) }}>
              Search
            </button>
          </form>

          {visibleTasks.length > 0 ? (
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'grid',
                gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(4, minmax(0, 1fr))',
                gap: 10,
                minWidth: 0,
              }}
            >
              {visibleTasks.map((task) => (
                <PortalTaskCard
                  key={task.title}
                  task={task}
                  access={access}
                  authenticated={authenticated}
                  accessPending={accessPending}
                  accent={activeAccent}
                  active={isPortalTaskActive(currentPortalPath, task.href)}
                  profileLinked={profileLinked}
                  compact={publicVisitor}
                />
            ))}
          </div>
        ) : null}
        </div>
          </>
        )}
      </div>
    </section>
    </>
  )
}

function PortalLaneCard({
  lane,
  active,
  access,
  authenticated,
  accessPending,
  profileLinked,
  compact,
  mobileCompact,
}: {
  lane: PortalLane
  active: boolean
  access: ProductAccessState
  authenticated: boolean
  accessPending: boolean
  profileLinked: boolean
  compact?: boolean
  mobileCompact?: boolean
}) {
  const target = getPortalLaneTarget({
    laneId: lane.id,
    fallbackHref: lane.route,
    planRoute: lane.planRoute,
    access,
    authenticated,
    accessPending,
    profileLinked,
  })
  const accent = getLaneAccent(lane.id)

  return (
    <Link
      href={target.href}
      aria-current={active ? 'page' : undefined}
      style={{
        ...laneCardStyle,
        ...(compact ? compactLaneCardStyle : null),
        ...(mobileCompact ? compactMobileLaneCardStyle : null),
        borderColor: active ? accent : 'rgba(116,190,255,0.15)',
        background: active ? portalActiveCardBackground : 'rgba(255,255,255,0.045)',
        boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(116,190,255,0.08)' : undefined,
      }}
    >
      <TiqFeatureIcon name={lane.icon} size="sm" variant={active ? 'surface' : 'ghost'} />
      <span style={laneCopyStyle}>
        <span style={laneTopStyle}>
          <strong style={laneLabelStyle}>{lane.label}</strong>
          {target.locked && !mobileCompact ? (
            <span style={lockBubbleStyle} title={`${lane.label} unlock`}>
              <NavLockIcon size={13} />
            </span>
          ) : null}
        </span>
        <span style={laneCueStyle}>{target.locked ? 'Preview unlock' : lane.cue}</span>
      </span>
    </Link>
  )
}

function PortalTaskCard({
  task,
  access,
  authenticated,
  accessPending,
  accent,
  active,
  profileLinked,
  compact,
}: {
  task: PortalLane['tasks'][number]
  access: ProductAccessState
  authenticated: boolean
  accessPending: boolean
  accent: string
  active: boolean
  profileLinked: boolean
  compact?: boolean
}) {
  const target = getPortalTaskTarget({
    href: task.href,
    requiredRoute: task.requiredRoute,
    title: task.title,
    access,
    authenticated,
    accessPending,
    profileLinked,
  })

  return (
    <Link
      href={target.href}
      aria-current={active ? 'page' : undefined}
      title={task.detail}
      style={{
        ...taskCardStyle,
        ...(compact ? compactTaskCardStyle : null),
        ...(active ? getActiveTaskCardStyle(accent) : null),
      }}
    >
      <span style={{ ...taskIconShellStyle, borderColor: active ? accent : 'rgba(116,190,255,0.14)' }}>
        <TiqFeatureIcon name={task.icon} size="sm" variant={active ? 'surface' : 'ghost'} />
      </span>
      <span style={taskBodyStyle}>
        <strong style={taskTitleStyle}>{target.title}</strong>
        {target.locked ? (
          <span style={taskLockStyle} aria-label={`${target.title} locked`}>
            <NavLockIcon size={12} />
          </span>
        ) : null}
      </span>
    </Link>
  )
}

function MobilePortalTaskTile({
  task,
  access,
  authenticated,
  accessPending,
  active,
  profileLinked,
  accent,
  onActivate,
}: {
  task: PortalLane['tasks'][number]
  access: ProductAccessState
  authenticated: boolean
  accessPending: boolean
  active: boolean
  profileLinked: boolean
  accent: string
  onActivate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void
}) {
  const target = getPortalTaskTarget({
    href: task.href,
    requiredRoute: task.requiredRoute,
    title: task.title,
    access,
    authenticated,
    accessPending,
    profileLinked,
  })

  return (
    <Link
      href={target.href}
      onClick={(event) => onActivate(event, target.href)}
      aria-current={active ? 'page' : undefined}
      aria-label={`${target.title}${target.locked ? ' locked' : ''}: ${task.detail}`}
      title={task.detail}
      style={{
        ...mobilePortalTileStyle,
        ...(active ? getActiveTaskCardStyle(accent) : null),
      }}
    >
      <span style={mobilePortalTileIconStyle}>
        <TiqFeatureIcon name={task.icon} size="sm" variant={active ? 'surface' : 'ghost'} />
      </span>
      <span style={mobilePortalTileLabelStyle}>
        {getMobileTaskLabel(target.title)}
        {target.locked ? <NavLockIcon size={10} /> : null}
      </span>
    </Link>
  )
}

function MobilePortalHubTile({
  lane,
  access,
  authenticated,
  accessPending,
  active,
  profileLinked,
  accent,
  onActivate,
}: {
  lane: PortalLane
  access: ProductAccessState
  authenticated: boolean
  accessPending: boolean
  active: boolean
  profileLinked: boolean
  accent: string
  onActivate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void
}) {
  const target = getPortalLaneTarget({
    laneId: lane.id,
    fallbackHref: lane.route,
    planRoute: lane.planRoute,
    access,
    authenticated,
    accessPending,
    profileLinked,
  })

  return (
    <Link
      href={target.href}
      onClick={(event) => onActivate(event, target.href)}
      aria-current={active ? 'page' : undefined}
      aria-label={`${getMobileLaneLabel(lane.id)} hub${target.locked ? ' locked' : ''}: ${lane.cue}`}
      title={`${getMobileLaneLabel(lane.id)} hub`}
      style={{
        ...mobilePortalTileStyle,
        ...(active ? getActiveTaskCardStyle(accent) : null),
      }}
    >
      <span style={mobilePortalTileIconStyle}>
        <TiqFeatureIcon name={lane.icon} size="sm" variant={active ? 'surface' : 'ghost'} />
      </span>
      <span style={mobilePortalTileLabelStyle}>
        {getMobileHubLabel(lane.id)}
        {target.locked ? <NavLockIcon size={10} /> : null}
      </span>
    </Link>
  )
}

function getLaneAccent(laneId: PortalLaneId) {
  if (laneId === 'find') return '#9be11d'
  if (laneId === 'you') return '#4aa3ff'
  if (laneId === 'compete') return '#19c8b6'
  if (laneId === 'coach') return '#a6ff2e'
  if (laneId === 'team') return '#f3b51b'
  return '#9be11d'
}

function getMobileLaneLabel(laneId: PortalLaneId) {
  if (laneId === 'find') return 'Explore'
  if (laneId === 'you') return 'Improve'
  if (laneId === 'compete') return 'Compete'
  if (laneId === 'coach') return 'Coaches'
  if (laneId === 'team') return 'Manage'
  return 'Leagues'
}

function getMobileHubLabel(laneId: PortalLaneId) {
  if (laneId === 'find') return 'Explore Hub'
  if (laneId === 'you') return 'Improve Hub'
  if (laneId === 'compete') return 'Compete Hub'
  if (laneId === 'coach') return 'Coach Hub'
  if (laneId === 'team') return 'Team Hub'
  return 'League Hub'
}

function getMobileTaskLabel(title: string) {
  if (title === 'Player bench') return 'Bench'
  if (title === 'Open My Lab') return 'My Lab'
  if (title === 'Tactics Tools') return 'Tactics'
  if (title === 'Tactical Studio') return 'Tactics'
  if (title === 'Level Up library') return 'Level Up'
  if (title === 'Coach-player messages') return 'Messages'
  if (title === 'Fix tennis context') return 'Fix context'
  if (title === 'Prep matchup') return 'Match prep'
  if (title === 'Shared calendar') return 'Calendar'
  if (title === 'Build tournament') return 'Tournament'
  return title
}

function getActiveTaskCardStyle(accent: string): CSSProperties {
  return {
    border: `1px solid ${accent}`,
    background: 'var(--portal-active-card-bg)',
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px color-mix(in srgb, ${accent} 18%, transparent)`,
  }
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12.4 12.4 17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

const portalTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(2rem, 4vw, 3.35rem)',
  lineHeight: 0.98,
  letterSpacing: 0,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const portalSubtitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.5,
  fontWeight: 700,
}

const publicPortalTitleStyle: CSSProperties = {
  fontSize: 'clamp(1.15rem, 2.2vw, 1.55rem)',
  lineHeight: 1.08,
}

const publicPortalSubtitleStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.35,
}

const portalBrandRunwayStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  alignItems: 'center',
  justifyItems: 'center',
  minWidth: 0,
  overflow: 'hidden',
  borderTop: '1px solid rgba(116,190,255,0.08)',
  borderBottom: '1px solid rgba(116,190,255,0.08)',
  background:
    'linear-gradient(90deg, rgba(116,190,255,0.045), rgba(155,225,29,0.055) 46%, rgba(255,255,255,0.025))',
}

const portalBrandRunwayMarkStyle: CSSProperties = {
  display: 'block',
  aspectRatio: '1045 / 490',
  background: 'url("/tiq/logo/tiq-mark-light.png") center / contain no-repeat',
  mixBlendMode: 'screen',
  pointerEvents: 'none',
}

const mobilePortalPaletteStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 5,
  minWidth: 0,
}

const mobilePortalActionPaletteStyle: CSSProperties = {
  ...mobilePortalPaletteStyle,
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
}

const mobilePortalTileStyle: CSSProperties = {
  display: 'grid',
  gridTemplateRows: '24px minmax(0, auto)',
  justifyItems: 'center',
  alignContent: 'center',
  gap: 3,
  minHeight: 48,
  padding: '5px 4px',
  borderRadius: 10,
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  minWidth: 0,
  width: '100%',
  boxSizing: 'border-box',
  cursor: 'pointer',
  touchAction: 'manipulation',
  userSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
  transition: 'border-color 120ms ease, background 120ms ease, box-shadow 120ms ease',
}

const mobilePortalBackTileStyle: CSSProperties = {
  ...mobilePortalTileStyle,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.03)',
  color: 'var(--shell-copy-muted)',
}

const mobilePortalTileIconStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 24,
  height: 24,
}

const mobilePortalTileLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  color: 'var(--foreground-strong)',
  fontSize: 9.75,
  lineHeight: 1.1,
  fontWeight: 950,
  textAlign: 'center',
  overflowWrap: 'break-word',
  minWidth: 0,
}

const laneCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '42px minmax(0, 1fr)',
  gap: 10,
  alignItems: 'center',
  minHeight: 84,
  padding: 12,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.15)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  minWidth: 0,
}

const compactLaneCardStyle: CSSProperties = {
  gridTemplateColumns: '34px minmax(0, 1fr)',
  gap: 8,
  minHeight: 58,
  padding: 9,
  borderRadius: 8,
}

const compactMobileLaneCardStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
}

const laneCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
}

const laneTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minWidth: 0,
}

const laneLabelStyle: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.05,
  fontWeight: 950,
}

const laneCueStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.3,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const lockBubbleStyle: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 25,
  height: 25,
  borderRadius: 999,
  color: 'var(--foreground-strong)',
  background: 'color-mix(in srgb, var(--brand-green) 18%, var(--surface-soft) 82%)',
  border: '1px solid rgba(155,225,29,0.28)',
}

const searchShellStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '22px minmax(0, 1fr)',
  gap: 10,
  alignItems: 'center',
  minHeight: 54,
  padding: '0 16px',
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(255,255,255,0.07)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
}

const compactSearchShellStyle: CSSProperties = {
  minHeight: 46,
  borderRadius: 8,
}

const searchInputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  border: 0,
  outline: 'none',
  background: 'transparent',
  color: 'var(--foreground-strong)',
  fontSize: 15,
  fontWeight: 750,
}

const searchButtonStyle: CSSProperties = {
  minHeight: 54,
  padding: '0 22px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.20)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--foreground-strong)',
  fontSize: 14,
  fontWeight: 900,
  cursor: 'pointer',
}

const compactSearchButtonStyle: CSSProperties = {
  minHeight: 46,
  padding: '0 18px',
}

const taskCardStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  gap: 8,
  minHeight: 72,
  padding: '10px 8px',
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(255,255,255,0.055)',
  color: 'var(--foreground)',
  textDecoration: 'none',
  minWidth: 0,
  textAlign: 'center',
}

const compactTaskCardStyle: CSSProperties = {
  minHeight: 56,
  padding: '8px 6px',
  borderRadius: 8,
}

const taskIconShellStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 34,
  height: 34,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.045)',
}

const taskBodyStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  minWidth: 0,
  maxWidth: '100%',
}

const taskTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 12.5,
  lineHeight: 1.15,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const taskLockStyle: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  flex: '0 0 auto',
  color: 'var(--shell-copy-muted)',
}
