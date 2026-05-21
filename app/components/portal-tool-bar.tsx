'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import NavLockIcon from '@/app/components/nav-lock-icon'
import { useAuth } from '@/app/components/auth-provider'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { buildProductAccessState, type ProductAccessState } from '@/lib/access-model'
import { getPrimaryNavTarget } from '@/lib/primary-nav-access'
import { PRODUCT_MOTTO } from '@/lib/product-story'
import { loadUserProfileLink } from '@/lib/user-profile'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type PortalLaneId = 'find' | 'you' | 'team' | 'league'

type PortalLane = {
  id: PortalLaneId
  label: string
  cue: string
  route: string
  icon: TiqFeatureIconName
  planRoute: '/explore' | '/mylab' | '/captain' | '/league-coordinator'
  paths: string[]
  searchScope: 'players' | 'teams' | 'leagues'
  tasks: Array<{
    title: string
    detail: string
    metric: string
    href: string
    icon: TiqFeatureIconName
    requiredRoute: '/explore' | '/mylab' | '/captain' | '/league-coordinator'
  }>
}

const portalLanes: PortalLane[] = [
  {
    id: 'find',
    label: 'Find',
    cue: 'Search the tennis map',
    route: '/explore',
    planRoute: '/explore',
    icon: 'opponentScouting',
    paths: ['/explore', '/players', '/teams', '/rankings', '/leagues'],
    searchScope: 'players',
    tasks: [
      { title: 'Find a player', detail: 'Public profiles, rating shape, and team context.', metric: 'Free', href: '/explore/players', icon: 'playerRatings', requiredRoute: '/explore' },
      { title: 'Browse teams', detail: 'Rosters, sections, records, and nearby competition.', metric: 'Free', href: '/explore/teams', icon: 'lineupBuilder', requiredRoute: '/explore' },
      { title: 'Check standings', detail: 'League tables and flight context.', metric: 'Free', href: '/explore/leagues', icon: 'schedule', requiredRoute: '/explore' },
      { title: 'Upload scorecard', detail: 'Refresh tennis data through review.', metric: 'Free', href: '/data-assist', icon: 'reports', requiredRoute: '/explore' },
    ],
  },
  {
    id: 'you',
    label: 'You',
    cue: 'Open your lab',
    route: '/mylab',
    planRoute: '/mylab',
    icon: 'myLab',
    paths: ['/mylab', '/profile', '/messages', '/data-assist', '/matchup', '/compete'],
    searchScope: 'players',
    tasks: [
      { title: 'Open My Lab', detail: 'Your scorecard, goals, follows, and next read.', metric: 'Player', href: '/mylab', icon: 'myLab', requiredRoute: '/mylab' },
      { title: 'Link profile', detail: 'Choose the player record that powers your tools.', metric: 'Set once', href: '/profile', icon: 'accountSecurity', requiredRoute: '/mylab' },
      { title: 'Prep matchup', detail: 'Compare the court before you play.', metric: 'Player', href: '/matchup', icon: 'matchupAnalysis', requiredRoute: '/mylab' },
      { title: 'Review messages', detail: 'Keep tennis replies and alerts together.', metric: 'Inbox', href: '/messages', icon: 'messagingCenter', requiredRoute: '/mylab' },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    cue: 'Build the week',
    route: '/captain',
    planRoute: '/captain',
    icon: 'lineupBuilder',
    paths: ['/captain'],
    searchScope: 'teams',
    tasks: [
      { title: 'Who can play', detail: 'Availability and readiness before lineup pressure.', metric: 'Captain', href: '/captain/availability', icon: 'reliabilityIndex', requiredRoute: '/captain' },
      { title: 'Build lineup', detail: 'Turn the roster into the weekly plan.', metric: 'Captain', href: '/captain/lineup-builder', icon: 'lineupBuilder', requiredRoute: '/captain' },
      { title: 'Send plan', detail: 'Message the team from the same workspace.', metric: 'Captain', href: '/captain/messaging', icon: 'messagingCenter', requiredRoute: '/captain' },
      { title: 'Read brief', detail: 'See the match-week snapshot.', metric: 'Captain', href: '/captain/weekly-brief', icon: 'reports', requiredRoute: '/captain' },
    ],
  },
  {
    id: 'league',
    label: 'League',
    cue: 'Run the season',
    route: '/league-coordinator',
    planRoute: '/league-coordinator',
    icon: 'teamRankings',
    paths: ['/league-coordinator'],
    searchScope: 'leagues',
    tasks: [
      { title: 'League command', detail: 'Setup, approvals, and operating lane.', metric: 'League', href: '/league-coordinator', icon: 'teamRankings', requiredRoute: '/league-coordinator' },
      { title: 'Team book', detail: 'Enter team results and keep standings moving.', metric: 'League', href: '/league-coordinator/results', icon: 'reports', requiredRoute: '/league-coordinator' },
      { title: 'Player book', detail: 'Run individual leagues with clear records.', metric: 'League', href: '/league-coordinator/individual-results', icon: 'playerRatings', requiredRoute: '/league-coordinator' },
      { title: 'Public pages', detail: 'See how the league looks to members.', metric: 'View', href: '/explore/leagues', icon: 'opponentScouting', requiredRoute: '/explore' },
    ],
  },
]

const hiddenPrefixes = ['/login', '/join', '/legal', '/reset-password', '/forget-password']
const portalSurfaceBackground =
  'radial-gradient(circle at 18% 8%, rgba(155,225,29,0.16), transparent 26%), radial-gradient(circle at 88% 18%, rgba(74,163,255,0.14), transparent 30%), linear-gradient(145deg, rgba(7,18,38,0.96) 0%, rgba(10,25,48,0.98) 52%, rgba(4,13,29,0.98) 100%)'
const portalActiveCardBackground =
  'linear-gradient(135deg, rgba(17,36,67,0.86) 0%, rgba(12,26,50,0.92) 100%)'

function isLaneActive(pathname: string, lane: PortalLane) {
  return lane.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function getActiveLane(pathname: string) {
  return portalLanes.find((lane) => isLaneActive(pathname, lane)) ?? portalLanes[0]
}

function isPortalHidden(pathname: string) {
  return pathname === '/' || hiddenPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
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
  const { isMobile, isSmallMobile } = useViewportBreakpoints()
  const [query, setQuery] = useState('')
  const [profileName, setProfileName] = useState('')

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
        return
      }

      const result = await loadUserProfileLink(userId)
      if (!active) return
      setProfileName(result.data?.message_display_name || result.data?.linked_player_name || '')
    }

    void loadName()

    return () => {
      active = false
    }
  }, [authResolved, userId])

  if (isPortalHidden(pathname)) return null

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams({ scope: activeLane.searchScope })
    if (query.trim()) params.set('q', query.trim())
    router.push(`/explore/search?${params.toString()}`)
  }

  const headline = authenticated
    ? firstName
      ? `Hi ${firstName}, welcome back!`
      : 'Welcome back.'
    : PRODUCT_MOTTO

  return (
    <section
      aria-label="TenAceIQ command center"
      style={{
        position: 'relative',
        zIndex: 25,
        width: '100%',
        boxSizing: 'border-box',
        padding: isMobile ? '14px 8px 10px' : '18px 16px 12px',
        overflow: 'clip',
      }}
    >
      <div
        style={{
          width: 'min(1280px, 100%)',
          margin: '0 auto',
          display: 'grid',
          gap: isMobile ? 14 : 16,
          padding: isSmallMobile ? 16 : isMobile ? 18 : 20,
          borderRadius: isSmallMobile ? 24 : 28,
          border: '1px solid rgba(116,190,255,0.15)',
          background: portalSurfaceBackground,
          color: 'var(--foreground)',
          boxShadow: '0 28px 80px rgba(2, 10, 24, 0.28), inset 0 1px 0 rgba(255,255,255,0.06)',
          minWidth: 0,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
          <h1 style={portalTitleStyle}>{headline}</h1>
          <p style={portalSubtitleStyle}>
            {authenticated ? 'What do we want to work on today?' : 'Start with the tennis map, then unlock the tools that save your week.'}
          </p>
        </div>

        <nav
          aria-label="Choose a TenAceIQ tool"
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(4, minmax(0, 1fr))',
            gap: 10,
            minWidth: 0,
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
            />
          ))}
        </nav>

        <form
          onSubmit={handleSearch}
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, auto)',
            gap: 12,
            minWidth: 0,
          }}
        >
          <label style={searchShellStyle}>
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search players, teams, leagues, ratings..."
              aria-label="Search players, teams, leagues, and ratings"
              style={searchInputStyle}
            />
          </label>
          <button type="submit" style={searchButtonStyle}>
            Search
          </button>
        </form>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(4, minmax(0, 1fr))',
            gap: 10,
            minWidth: 0,
          }}
        >
          {activeLane.tasks.map((task) => (
            <PortalTaskCard
              key={task.title}
              task={task}
              access={access}
              authenticated={authenticated}
              accessPending={accessPending}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function PortalLaneCard({
  lane,
  active,
  access,
  authenticated,
  accessPending,
}: {
  lane: PortalLane
  active: boolean
  access: ProductAccessState
  authenticated: boolean
  accessPending: boolean
}) {
  const target = accessPending
    ? { href: lane.route, locked: false, requiredPlan: null }
    : getPrimaryNavTarget(lane.planRoute, access, authenticated)
  const accent = lane.id === 'find' ? '#9be11d' : lane.id === 'you' ? '#4aa3ff' : lane.id === 'team' ? '#f3b51b' : '#19c8b6'

  return (
    <Link
      href={target.href}
      aria-current={active ? 'page' : undefined}
      style={{
        ...laneCardStyle,
        borderColor: active ? accent : 'rgba(116,190,255,0.15)',
        background: active ? portalActiveCardBackground : 'rgba(255,255,255,0.045)',
        boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(116,190,255,0.08)' : undefined,
      }}
    >
      <TiqFeatureIcon name={lane.icon} size="sm" variant={active ? 'surface' : 'ghost'} />
      <span style={laneCopyStyle}>
        <span style={laneTopStyle}>
          <strong style={laneLabelStyle}>{lane.label}</strong>
          {target.locked ? (
            <span style={lockBubbleStyle} title={`${lane.label} unlock`}>
              <NavLockIcon size={13} />
            </span>
          ) : (
            <em style={{ ...laneStatusStyle, color: accent }}>Open</em>
          )}
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
}: {
  task: PortalLane['tasks'][number]
  access: ProductAccessState
  authenticated: boolean
  accessPending: boolean
}) {
  const target = accessPending
    ? { href: task.href, locked: false, requiredPlan: null }
    : getPrimaryNavTarget(task.requiredRoute, access, authenticated)
  const href = target.locked ? target.href : task.href

  return (
    <Link href={href} style={taskCardStyle}>
      <span style={taskTopStyle}>
        <span style={taskMetricStyle}>{task.metric}</span>
        <TiqFeatureIcon name={task.icon} size="sm" variant="ghost" />
      </span>
      <span style={taskBodyStyle}>
        <strong style={taskTitleStyle}>{task.title}</strong>
        <span style={taskDetailStyle}>{task.detail}</span>
        <span style={taskOpenStyle}>
          {target.locked ? <NavLockIcon size={12} /> : null}
          {target.locked ? 'Unlock' : 'Open'}
        </span>
      </span>
    </Link>
  )
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

const laneStatusStyle: CSSProperties = {
  fontSize: 10,
  fontStyle: 'normal',
  fontWeight: 950,
  textTransform: 'uppercase',
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

const taskCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'minmax(0, auto) minmax(0, 1fr)',
  gap: 10,
  minHeight: 128,
  padding: 13,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(255,255,255,0.055)',
  color: 'var(--foreground)',
  textDecoration: 'none',
  minWidth: 0,
}

const taskTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  minWidth: 0,
}

const taskMetricStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
}

const taskBodyStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const taskTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.1,
  fontWeight: 950,
}

const taskDetailStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 700,
}

const taskOpenStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}
