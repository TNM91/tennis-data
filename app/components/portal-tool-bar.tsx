'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { PushPinSimpleIcon } from '@phosphor-icons/react/dist/csr/PushPinSimple'
import { SlidersHorizontalIcon } from '@phosphor-icons/react/dist/csr/SlidersHorizontal'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent, type UIEvent } from 'react'
import NavLockIcon from '@/app/components/nav-lock-icon'
import { useAuth } from '@/app/components/auth-provider'
import { useClubCommunicationAttention } from '@/app/components/use-club-communication-attention'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { buildProductAccessState, type ProductAccessState } from '@/lib/access-model'
import { getPortalLaneTarget } from '@/lib/portal-lane-routing'
import {
  buildPortalLaneOrderFromShortcuts,
  cachePinnedPortalShortcuts,
  DEFAULT_PINNED_PORTAL_SHORTCUTS,
  dismissPortalPersonalizationCue,
  hasDismissedPortalPersonalizationCue,
  movePinnedPortalShortcut,
  PORTAL_SHORTCUT_PIN_LIMIT,
  readPinnedPortalShortcuts,
  shouldShowPortalPersonalizationCue,
  writePinnedPortalShortcuts,
  type PortalLanePreferenceId,
  type PortalShortcutPreferenceId,
} from '@/lib/portal-lane-preferences'
import {
  loadPortalShortcutCloudState,
  loadPortalShortcutSuggestions,
  savePortalShortcutCloudState,
} from '@/lib/portal-shortcut-cloud'
import {
  dismissPortalShortcutPinRecommendation,
  mergePortalShortcutSuggestionCandidates,
  readPortalShortcutPinRecommendation,
  readPortalShortcutSuggestionCandidates,
  recordPortalShortcutUse,
  type PortalShortcutPinRecommendation,
} from '@/lib/portal-shortcut-suggestions'
import { isPortalTaskActive } from '@/lib/portal-task-active'
import { getPortalTaskTarget } from '@/lib/portal-task-target'
import { PLATFORM_POSITIONING, PRODUCT_MOTTO } from '@/lib/product-story'
import { trackProductUsageEvent } from '@/lib/product-usage-client'
import { CAPTAIN_TACTICS_BOARD_HREF, COACH_TACTICS_BOARD_HREF, PLAYER_TACTICS_BOARD_HREF } from '@/lib/tactics-hrefs'
import { loadUserProfileLink } from '@/lib/user-profile'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type PortalLaneId = PortalLanePreferenceId
type PortalRequiredRoute = '/explore' | '/mylab' | '/compete' | '/coach' | '/captain' | '/league-coordinator'

type PortalShortcut = {
  id: PortalShortcutPreferenceId
  kind: 'lane' | 'action'
  label: string
  cue: string
  href: string
  icon: TiqFeatureIconName
  laneId: PortalLaneId
  requiredRoute?: PortalRequiredRoute
}

const dataAssistPortalHref = '/data-assist?intent=upload-source&context=Portal'

type PortalToolBarProps = {
  layout?: 'top' | 'rail'
  suppressed?: boolean
}

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
    requiredRoute: PortalRequiredRoute
  }>
}

const portalLanes: PortalLane[] = [
  {
    id: 'find',
    label: 'Explore',
    cue: 'Players, teams, leagues, events',
    route: '/explore',
    planRoute: '/explore',
    icon: 'exploreTennis',
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
    icon: 'improveTennis',
    paths: ['/mylab', '/profile', '/messages', '/data-assist', '/matchup', '/level-up', '/player-development', '/resources', '/tactics'],
    searchScope: 'players',
    tasks: [
      { title: 'Open My Lab', detail: 'Your scorecard, goals, follows, and next read.', metric: 'Player', href: '/mylab', icon: 'myLab', requiredRoute: '/mylab' },
      { title: 'Level Up', detail: 'Choose a training card, run the rep, and save proof.', metric: 'Player', href: '/level-up', icon: 'matchPrep', requiredRoute: '/mylab' },
      { title: 'Tactics Tools', detail: 'Map the court pattern before practice or your next match.', metric: 'Player', href: PLAYER_TACTICS_BOARD_HREF, icon: 'scenarioBuilder', requiredRoute: '/mylab' },
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
    icon: 'competeTennis',
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
    route: '/coaches',
    planRoute: '/coach',
    icon: 'coachTennis',
    paths: ['/coach', '/coaches', '/player-development', '/tactics'],
    searchScope: 'players',
    tasks: [
      { title: 'Player bench', detail: 'Open your roster, player profiles, assignments, and next coaching moves.', metric: 'Coach', href: '/coach#coach-linked-dashboard', icon: 'playerRatings', requiredRoute: '/coach' },
      { title: 'Tactical Studio', detail: 'Map the drill or pattern before assigning it.', metric: 'Coach', href: COACH_TACTICS_BOARD_HREF, icon: 'matchPrep', requiredRoute: '/coach' },
      { title: 'Level Up library', detail: 'Assign training modules and keep player work aligned.', metric: 'Coach', href: '/level-up', icon: 'reports', requiredRoute: '/coach' },
      { title: 'Coach-player messages', detail: 'Keep lesson follow-up tied to player goals and assignments.', metric: 'Inbox', href: '/messages', icon: 'messagingCenter', requiredRoute: '/coach' },
    ],
  },
  {
    id: 'team',
    label: 'Captain',
    cue: 'Team Hub and match week',
    route: '/captain',
    planRoute: '/captain',
    icon: 'captainTennis',
    paths: ['/captain', '/manage', '/compete/teams'],
    searchScope: 'teams',
    tasks: [
      { title: 'Who can play', detail: 'Availability and readiness before lineup pressure.', metric: 'Captain', href: '/captain/availability', icon: 'reliabilityIndex', requiredRoute: '/captain' },
      { title: 'Plan practice', detail: 'Schedule practice, invite the roster, and collect RSVPs.', metric: 'Captain', href: '/captain/practice', icon: 'schedule', requiredRoute: '/captain' },
      { title: 'Map tactics', detail: 'Build a court picture for the next point, drill, or team pattern.', metric: 'Coach beta', href: CAPTAIN_TACTICS_BOARD_HREF, icon: 'scenarioBuilder', requiredRoute: '/captain' },
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
    icon: 'leagueTennis',
    paths: ['/leagues-and-tournaments', '/league-coordinator', '/tournaments', '/compete/leagues', '/compete/schedule', '/explore/leagues', '/leagues'],
    searchScope: 'leagues',
    tasks: [
      { title: 'Shared calendar', detail: 'Publish, propose, confirm, and track match dates.', metric: 'League', href: '/compete/schedule', icon: 'schedule', requiredRoute: '/explore' },
      { title: 'Build tournament', detail: 'Create a draw, seed entrants, and preview the path.', metric: 'Full-Court', href: '/league-coordinator/tournaments', icon: 'teamRankings', requiredRoute: '/league-coordinator' },
      { title: 'Team book', detail: 'Enter team results and keep standings moving.', metric: 'League', href: '/league-coordinator/results', icon: 'reports', requiredRoute: '/league-coordinator' },
      { title: 'Player book', detail: 'Run individual leagues with clear records.', metric: 'League', href: '/league-coordinator/individual-results', icon: 'playerRatings', requiredRoute: '/league-coordinator' },
    ],
  },
  {
    id: 'club',
    label: 'Club',
    cue: 'Players, programs, staff, competition',
    route: '/clubs',
    planRoute: '/explore',
    icon: 'clubTennis',
    paths: ['/clubs'],
    searchScope: 'players',
    tasks: [
      { title: 'Club home', detail: 'Open the branded home for your staff and players.', metric: 'Club', href: '/clubs', icon: 'clubOperations', requiredRoute: '/explore' },
      { title: 'Run clinics', detail: 'Open clinic schedules, rosters, plans, attendance, and updates.', metric: 'Club', href: '/clubs?tab=groups&type=clinic', icon: 'schedule', requiredRoute: '/explore' },
      { title: 'Develop players', detail: 'Keep club coaching and player follow-through connected.', metric: 'Coach', href: '/coach?source=club', icon: 'scenarioBuilder', requiredRoute: '/explore' },
      { title: 'Host competition', detail: 'Open club leagues and tournaments without replacing registration.', metric: 'Club', href: '/clubs?tab=compete', icon: 'reports', requiredRoute: '/explore' },
    ],
  },
]

const portalLaneOrder: PortalLaneId[] = ['find', 'you', 'compete', 'team', 'coach', 'league', 'club']
const orderedPortalLanes = [...portalLanes].sort(
  (left, right) => portalLaneOrder.indexOf(left.id) - portalLaneOrder.indexOf(right.id),
)

const portalActionShortcuts: PortalShortcut[] = [
  { id: 'action:mylab', kind: 'action', label: 'My Lab', cue: 'Your tennis home', href: '/mylab', icon: 'myLab', laneId: 'you', requiredRoute: '/mylab' },
  { id: 'action:tactics', kind: 'action', label: 'Tactics', cue: 'Map the next pattern', href: PLAYER_TACTICS_BOARD_HREF, icon: 'scenarioBuilder', laneId: 'you', requiredRoute: '/mylab' },
  { id: 'action:level-up', kind: 'action', label: 'Level Up', cue: 'Run the next rep', href: '/level-up', icon: 'matchPrep', laneId: 'you', requiredRoute: '/mylab' },
  { id: 'action:matchup', kind: 'action', label: 'Matchup', cue: 'Compare the court', href: '/matchup', icon: 'matchupAnalysis', laneId: 'compete', requiredRoute: '/compete' },
  { id: 'action:availability', kind: 'action', label: 'Availability', cue: 'See who can play', href: '/captain/availability', icon: 'reliabilityIndex', laneId: 'team', requiredRoute: '/captain' },
  { id: 'action:lineup', kind: 'action', label: 'Build lineup', cue: 'Plan the next match', href: '/captain/lineup-builder', icon: 'lineupBuilder', laneId: 'team', requiredRoute: '/captain' },
  { id: 'action:team-room', kind: 'action', label: 'Team Room', cue: 'Open team communication', href: '/team-room', icon: 'messagingCenter', laneId: 'team', requiredRoute: '/captain' },
  { id: 'action:messages', kind: 'action', label: 'Messages', cue: 'Open tennis replies', href: '/messages', icon: 'messagingCenter', laneId: 'you', requiredRoute: '/mylab' },
]

const portalShortcutCatalog: PortalShortcut[] = [
  ...orderedPortalLanes.map((lane): PortalShortcut => ({
    id: `lane:${lane.id}` as PortalShortcutPreferenceId,
    kind: 'lane',
    label: getMobileLaneLabel(lane.id),
    cue: lane.cue,
    href: lane.route,
    icon: lane.icon,
    laneId: lane.id,
  })),
  ...portalActionShortcuts,
]

function getPortalShortcutLabel(shortcutId: PortalShortcutPreferenceId) {
  return portalShortcutCatalog.find((shortcut) => shortcut.id === shortcutId)?.label || 'this tool'
}

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

export default function PortalToolBar({ layout = 'top', suppressed = false }: PortalToolBarProps) {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const { role, userId, entitlements, authResolved, session } = useAuth()
  const { isMobile, isSmallMobile } = useViewportBreakpoints()
  const [query, setQuery] = useState('')
  const [profileName, setProfileName] = useState('')
  const [profileLinked, setProfileLinked] = useState(false)
  const mobilePortalPaletteRef = useRef<HTMLElement | null>(null)
  const [mobilePortalScroll, setMobilePortalScroll] = useState({ left: 0, max: 0 })
  const [mobilePortalLaneState, setMobilePortalLaneState] = useState<{ pathname: string; laneId: PortalLaneId | null }>({
    pathname: '',
    laneId: null,
  })
  const [currentHash, setCurrentHash] = useState('')
  const [pinnedPortalShortcutIds, setPinnedPortalShortcutIds] = useState<PortalShortcutPreferenceId[]>(DEFAULT_PINNED_PORTAL_SHORTCUTS)
  const [draftPinnedPortalShortcutIds, setDraftPinnedPortalShortcutIds] = useState<PortalShortcutPreferenceId[]>(DEFAULT_PINNED_PORTAL_SHORTCUTS)
  const [customizingPortalShortcuts, setCustomizingPortalShortcuts] = useState(false)
  const [showAllPortalLanes, setShowAllPortalLanes] = useState(false)
  const [showPortalPersonalizationCue, setShowPortalPersonalizationCue] = useState(false)
  const [portalPersonalizationMessage, setPortalPersonalizationMessage] = useState('')
  const [portalShortcutSuggestionCandidates, setPortalShortcutSuggestionCandidates] = useState<PortalShortcutPreferenceId[]>([])
  const [portalPinRecommendation, setPortalPinRecommendation] = useState<PortalShortcutPinRecommendation | null>(null)
  const [selectedPinnedPortalShortcutId, setSelectedPinnedPortalShortcutId] = useState<PortalShortcutPreferenceId | null>(null)
  const portalShortcutInteractionVersionRef = useRef(0)
  const portalShortcutSuggestionRequestRef = useRef(0)

  const authenticated = Boolean(userId) || role !== 'public'
  const accessPending = authenticated && (!authResolved || entitlements === null)
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [resolvedRole, entitlements])
  const activeLane = getActiveLane(pathname)
  const metadataFirstName = getMetadataFirstName(session)
  const firstName = metadataFirstName || profileName.split(' ')[0] || ''
  const { attention: clubCommunicationAttention } = useClubCommunicationAttention({
    accessToken: session?.access_token,
    userId,
  })
  const clubAttentionCount = clubCommunicationAttention?.attentionCount ?? 0
  const pinnedPortalShortcuts = useMemo(() => {
    return pinnedPortalShortcutIds
      .map((shortcutId) => portalShortcutCatalog.find((shortcut) => shortcut.id === shortcutId))
      .filter((shortcut): shortcut is PortalShortcut => Boolean(shortcut))
  }, [pinnedPortalShortcutIds])
  const personalizedPortalLanes = useMemo(() => {
    const laneIds = buildPortalLaneOrderFromShortcuts(pinnedPortalShortcutIds)
    return laneIds.map((laneId) => portalLanes.find((lane) => lane.id === laneId)).filter((lane): lane is PortalLane => Boolean(lane))
  }, [pinnedPortalShortcutIds])
  const suggestedPortalShortcutIds = useMemo(() => {
    const pinned = new Set(draftPinnedPortalShortcutIds)
    return portalShortcutSuggestionCandidates
      .filter((shortcutId) => !pinned.has(shortcutId))
      .slice(0, 3)
  }, [draftPinnedPortalShortcutIds, portalShortcutSuggestionCandidates])
  const draftPinnedPortalShortcuts = useMemo(() => (
    draftPinnedPortalShortcutIds
      .map((shortcutId) => portalShortcutCatalog.find((shortcut) => shortcut.id === shortcutId))
      .filter((shortcut): shortcut is PortalShortcut => Boolean(shortcut))
  ), [draftPinnedPortalShortcutIds])
  const unpinnedPortalShortcutOptions = useMemo(() => {
    const pinned = new Set(draftPinnedPortalShortcutIds)
    return portalShortcutCatalog.filter((shortcut) => !pinned.has(shortcut.id))
  }, [draftPinnedPortalShortcutIds])
  const selectedPinnedPortalShortcutPosition = selectedPinnedPortalShortcutId
    ? draftPinnedPortalShortcutIds.indexOf(selectedPinnedPortalShortcutId) + 1
    : 0

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const restoreVersion = portalShortcutInteractionVersionRef.current
    const localShortcutIds = readPinnedPortalShortcuts(userId)
    const localCueDismissed = hasDismissedPortalPersonalizationCue(userId)
    const frame = window.requestAnimationFrame(() => {
      setPinnedPortalShortcutIds(localShortcutIds)
      setDraftPinnedPortalShortcutIds(localShortcutIds)
      setCustomizingPortalShortcuts(false)
      setShowAllPortalLanes(false)
      setSelectedPinnedPortalShortcutId(null)
      setShowPortalPersonalizationCue(shouldShowPortalPersonalizationCue(userId))
      setPortalPinRecommendation(readPortalShortcutPinRecommendation(localShortcutIds, userId))
    })

    async function restoreCloudShortcuts() {
      const accessToken = session?.access_token || ''
      if (!authResolved || !userId || !accessToken) return

      const cloud = await loadPortalShortcutCloudState(accessToken, controller.signal)
      if (!active || !cloud.cloudAvailable || portalShortcutInteractionVersionRef.current !== restoreVersion) return

      if (!cloud.shortcuts) {
        void savePortalShortcutCloudState({
          accessToken,
          shortcuts: localShortcutIds,
          cueDismissed: localCueDismissed,
        })
        return
      }

      const restoredShortcutIds = cachePinnedPortalShortcuts(cloud.shortcuts, userId)
      const cueDismissed = cloud.cueDismissed || localCueDismissed
      if (cueDismissed) dismissPortalPersonalizationCue(userId)
      setPinnedPortalShortcutIds(restoredShortcutIds)
      setDraftPinnedPortalShortcutIds(restoredShortcutIds)
      setShowPortalPersonalizationCue(!cueDismissed)
      setPortalPinRecommendation(readPortalShortcutPinRecommendation(restoredShortcutIds, userId))

      if (cueDismissed && !cloud.cueDismissed) {
        void savePortalShortcutCloudState({
          accessToken,
          shortcuts: restoredShortcutIds,
          cueDismissed: true,
        })
      }
    }

    void restoreCloudShortcuts()

    return () => {
      active = false
      controller.abort()
      window.cancelAnimationFrame(frame)
    }
  }, [authResolved, session?.access_token, userId])

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

  const portalHidden = isPortalHidden(pathname)
  const publicVisitor = !authenticated
  const showPublicTasks = !(publicVisitor && isMobile)
  const visibleTasks = publicVisitor ? (showPublicTasks ? activeLane.tasks.slice(0, 4) : []) : activeLane.tasks
  const showPortalBrandRunway = publicVisitor && pathname === '/' && !isMobile
  // Keep the shared top portal compact so each route starts with the user's work.
  const collapseMobilePortal = layout === 'top'

  const mobilePortalLaneId = mobilePortalLaneState.pathname === pathname ? mobilePortalLaneState.laneId : null
  const mobilePortalLane = mobilePortalLaneId ? portalLanes.find((lane) => lane.id === mobilePortalLaneId) ?? activeLane : null
  const showPortalLanePicker = !collapseMobilePortal
  const currentPortalPath = `${pathname}${currentHash}`
  const mobilePortalHasActiveTask = mobilePortalLane
    ? mobilePortalLane.tasks.some((task) => isPortalTaskActive(currentPortalPath, task.href))
    : false
  const mobilePortalStickyTop = 'var(--header-height)'
  const showExpandedPortalIntro = !collapseMobilePortal
  const portalMenuId = 'tenaceiq-mobile-portal-menu'
  const portalActionMenuId = 'tenaceiq-mobile-portal-actions'
  const mobilePortalScrollProgress = mobilePortalScroll.max > 0
    ? Math.min(1, Math.max(0, mobilePortalScroll.left / mobilePortalScroll.max))
    : 0

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams({ scope: activeLane.searchScope })
    if (query.trim()) params.set('q', query.trim())
    router.push(`/explore/search?${params.toString()}`)
  }

  function handleMobilePortalLaneSelect(event: MouseEvent<HTMLButtonElement>, laneId: PortalLaneId) {
    event.currentTarget.blur()
    const lane = portalLanes.find((item) => item.id === laneId)
    if (lane) {
      trackPortalShortcutOpen({
        id: `lane:${lane.id}` as PortalShortcutPreferenceId,
        kind: 'lane',
        label: getMobileLaneLabel(lane.id),
        cue: lane.cue,
        href: lane.route,
        icon: lane.icon,
        laneId: lane.id,
      }, lane.route, 'all_tools')
      setShowAllPortalLanes(false)
      router.push(lane.route)
    }
  }

  function handlePinnedPortalShortcutActivate(
    event: MouseEvent<HTMLAnchorElement>,
    shortcut: PortalShortcut,
    destination: string,
  ) {
    event.currentTarget.blur()
    trackPortalShortcutOpen(shortcut, destination, 'pinned')
  }

  function trackPortalShortcutOpen(
    shortcut: PortalShortcut,
    destination: string,
    source: 'pinned' | 'all_tools',
  ) {
    const pinnedPosition = pinnedPortalShortcutIds.indexOf(shortcut.id) + 1
    recordPortalShortcutUse(shortcut.id, userId, new Date().toISOString(), source)
    if (source === 'all_tools' && pinnedPosition === 0) {
      setPortalPinRecommendation(readPortalShortcutPinRecommendation(pinnedPortalShortcutIds, userId))
    }
    void trackProductUsageEvent({
      eventName: 'portal_shortcut_opened',
      surface: 'portal',
      metadata: {
        shortcutId: shortcut.id,
        shortcutKind: shortcut.kind,
        shortcutLabel: shortcut.label,
        laneId: shortcut.laneId,
        destination,
        pinned: pinnedPosition > 0,
        pinnedPosition: pinnedPosition > 0 ? pinnedPosition : null,
        source,
        pathname,
        layout,
        mobile: isMobile,
      },
    })
  }

  function handlePortalShortcutCustomization(event: MouseEvent<HTMLButtonElement>, shortcutId: PortalShortcutPreferenceId) {
    event.currentTarget.blur()
    setDraftPinnedPortalShortcutIds((currentShortcutIds) => {
      if (currentShortcutIds.includes(shortcutId)) {
        if (selectedPinnedPortalShortcutId === shortcutId) {
          setSelectedPinnedPortalShortcutId(null)
          setPortalPersonalizationMessage('Tap a pinned shortcut to move or unpin it.')
          return currentShortcutIds
        }
        const position = currentShortcutIds.indexOf(shortcutId) + 1
        setSelectedPinnedPortalShortcutId(shortcutId)
        setPortalPersonalizationMessage(`${getPortalShortcutLabel(shortcutId)} is #${position}. Move it or unpin it.`)
        return currentShortcutIds
      }

      if (currentShortcutIds.length >= PORTAL_SHORTCUT_PIN_LIMIT) {
        setPortalPersonalizationMessage('Four are pinned. Select one, then tap Unpin.')
        return currentShortcutIds
      }

      const nextShortcutIds = [...currentShortcutIds, shortcutId]
      setSelectedPinnedPortalShortcutId(shortcutId)
      setPortalPersonalizationMessage(`${getPortalShortcutLabel(shortcutId)} is #${nextShortcutIds.length}.`)
      return nextShortcutIds
    })
  }

  function moveSelectedPortalShortcut(event: MouseEvent<HTMLButtonElement>, direction: -1 | 1) {
    event.currentTarget.blur()
    if (!selectedPinnedPortalShortcutId) return

    setDraftPinnedPortalShortcutIds((currentShortcutIds) => {
      const reordered = movePinnedPortalShortcut(currentShortcutIds, selectedPinnedPortalShortcutId, direction)
      const position = reordered.indexOf(selectedPinnedPortalShortcutId) + 1
      setPortalPersonalizationMessage(`${getPortalShortcutLabel(selectedPinnedPortalShortcutId)} moved to #${position}.`)
      return reordered
    })
  }

  function unpinSelectedPortalShortcut(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.blur()
    if (!selectedPinnedPortalShortcutId) return

    setDraftPinnedPortalShortcutIds((currentShortcutIds) => {
      const nextShortcutIds = currentShortcutIds.filter((shortcutId) => shortcutId !== selectedPinnedPortalShortcutId)
      setPortalPersonalizationMessage(`${nextShortcutIds.length} of ${PORTAL_SHORTCUT_PIN_LIMIT} pinned.`)
      return nextShortcutIds
    })
    setSelectedPinnedPortalShortcutId(null)
  }

  function openPortalShortcutCustomization(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.blur()
    portalShortcutInteractionVersionRef.current += 1
    setMobilePortalLaneState({ pathname, laneId: null })
    setShowAllPortalLanes(false)
    setShowPortalPersonalizationCue(false)
    setPortalPinRecommendation(null)
    setSelectedPinnedPortalShortcutId(null)
    setDraftPinnedPortalShortcutIds(pinnedPortalShortcutIds)
    setPortalPersonalizationMessage('Your first four open in this order. Tap one to move it.')
    setCustomizingPortalShortcuts(true)
    loadPortalShortcutSuggestionCandidates()
    void trackProductUsageEvent({
      eventName: 'portal_personalization_opened',
      surface: 'portal',
      metadata: {
        pinnedShortcuts: pinnedPortalShortcutIds,
        pathname,
        layout,
        mobile: isMobile,
      },
    })
  }

  function loadPortalShortcutSuggestionCandidates() {
    const requestVersion = ++portalShortcutSuggestionRequestRef.current
    const localSuggestions = readPortalShortcutSuggestionCandidates(userId)
    setPortalShortcutSuggestionCandidates(localSuggestions)

    const accessToken = session?.access_token || ''
    if (!authResolved || !userId || !accessToken) return

    void loadPortalShortcutSuggestions(accessToken).then((cloudSuggestions) => {
      if (portalShortcutSuggestionRequestRef.current !== requestVersion) return
      setPortalShortcutSuggestionCandidates(
        mergePortalShortcutSuggestionCandidates(cloudSuggestions, localSuggestions),
      )
    })
  }

  function savePortalShortcutCustomization(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.blur()
    if (draftPinnedPortalShortcutIds.length !== PORTAL_SHORTCUT_PIN_LIMIT) {
      setPortalPersonalizationMessage(`Choose ${PORTAL_SHORTCUT_PIN_LIMIT} shortcuts before saving.`)
      void trackProductUsageEvent({
        eventName: 'portal_personalization_save_blocked',
        surface: 'portal',
        metadata: {
          pinnedShortcuts: draftPinnedPortalShortcutIds,
          pinnedCount: draftPinnedPortalShortcutIds.length,
          requiredCount: PORTAL_SHORTCUT_PIN_LIMIT,
          pathname,
          layout,
          mobile: isMobile,
        },
      })
      return
    }

    const savedShortcutIds = writePinnedPortalShortcuts(draftPinnedPortalShortcutIds, userId)
    portalShortcutInteractionVersionRef.current += 1
    setPinnedPortalShortcutIds(savedShortcutIds)
    setDraftPinnedPortalShortcutIds(savedShortcutIds)
    setPortalPersonalizationMessage('Your first row is saved.')
    setCustomizingPortalShortcuts(false)
    setShowPortalPersonalizationCue(false)
    setPortalPinRecommendation(null)
    setSelectedPinnedPortalShortcutId(null)
    syncPortalShortcutsToCloud(savedShortcutIds, true)
    void trackProductUsageEvent({
      eventName: 'portal_personalization_saved',
      surface: 'portal',
      metadata: {
        pinnedShortcuts: savedShortcutIds,
        previousPinnedShortcuts: pinnedPortalShortcutIds,
        changed: savedShortcutIds.join('|') !== pinnedPortalShortcutIds.join('|'),
        pathname,
        layout,
        mobile: isMobile,
      },
    })
  }

  function resetPortalShortcutCustomization() {
    setSelectedPinnedPortalShortcutId(null)
    setDraftPinnedPortalShortcutIds([...DEFAULT_PINNED_PORTAL_SHORTCUTS])
    setPortalPersonalizationMessage('Default first row selected. Tap Done to save.')
  }

  function cancelPortalShortcutCustomization() {
    portalShortcutSuggestionRequestRef.current += 1
    setDraftPinnedPortalShortcutIds(pinnedPortalShortcutIds)
    setSelectedPinnedPortalShortcutId(null)
    setPortalPersonalizationMessage('')
    setCustomizingPortalShortcuts(false)
    setShowPortalPersonalizationCue(shouldShowPortalPersonalizationCue(userId))
  }

  function showAllPortalTools(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.blur()
    setShowAllPortalLanes(true)
  }

  function showPinnedPortalTools(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.blur()
    setShowAllPortalLanes(false)
  }

  function skipPortalPersonalizationCue() {
    portalShortcutInteractionVersionRef.current += 1
    dismissPortalPersonalizationCue(userId)
    setShowPortalPersonalizationCue(false)
    syncPortalShortcutsToCloud(pinnedPortalShortcutIds, true)
  }

  function applyPortalPinRecommendation() {
    if (!portalPinRecommendation) return

    const recommendedShortcut = portalPinRecommendation.shortcutId
    const replacedShortcut = portalPinRecommendation.replaceShortcutId
    const nextShortcutIds = pinnedPortalShortcutIds.map((shortcutId) => (
      shortcutId === replacedShortcut ? recommendedShortcut : shortcutId
    ))
    const savedShortcutIds = writePinnedPortalShortcuts(nextShortcutIds, userId)
    dismissPortalShortcutPinRecommendation(recommendedShortcut, userId)
    portalShortcutInteractionVersionRef.current += 1
    setPinnedPortalShortcutIds(savedShortcutIds)
    setDraftPinnedPortalShortcutIds(savedShortcutIds)
    setShowPortalPersonalizationCue(false)
    setPortalPinRecommendation(null)
    syncPortalShortcutsToCloud(savedShortcutIds, true)
    void trackProductUsageEvent({
      eventName: 'portal_personalization_saved',
      surface: 'portal',
      metadata: {
        pinnedShortcuts: savedShortcutIds,
        previousPinnedShortcuts: pinnedPortalShortcutIds,
        changed: true,
        source: 'usage_recommendation',
        recommendedShortcut,
        replacedShortcut,
        pathname,
        layout,
        mobile: isMobile,
      },
    })
  }

  function dismissPortalPinRecommendation() {
    if (!portalPinRecommendation) return
    dismissPortalShortcutPinRecommendation(portalPinRecommendation.shortcutId, userId)
    setPortalPinRecommendation(null)
  }

  function syncPortalShortcutsToCloud(shortcuts: readonly PortalShortcutPreferenceId[], cueDismissed: boolean) {
    const accessToken = session?.access_token || ''
    if (!authResolved || !userId || !accessToken) return
    void savePortalShortcutCloudState({ accessToken, shortcuts, cueDismissed })
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

  function handleMobilePortalPaletteScroll(event: UIEvent<HTMLElement>) {
    const palette = event.currentTarget
    setMobilePortalScroll({
      left: palette.scrollLeft,
      max: Math.max(0, palette.scrollWidth - palette.clientWidth),
    })
  }

  useEffect(() => {
    if (!collapseMobilePortal) return

    const palette = mobilePortalPaletteRef.current
    if (!palette) return
    const scrollPalette = palette

    function syncScrollState() {
      setMobilePortalScroll({
        left: scrollPalette.scrollLeft,
        max: Math.max(0, scrollPalette.scrollWidth - scrollPalette.clientWidth),
      })
    }

    syncScrollState()
    window.addEventListener('resize', syncScrollState)
    return () => window.removeEventListener('resize', syncScrollState)
  }, [collapseMobilePortal, mobilePortalLaneId, pathname])

  if (portalHidden) return null
  if (collapseMobilePortal && suppressed) return null

  const headline = authenticated
    ? firstName
      ? `Hi ${firstName}, welcome back!`
      : 'Welcome back.'
    : PRODUCT_MOTTO
  const activeAccent = getLaneAccent(activeLane.id)
  const useCompactPortalControls = publicVisitor || !isMobile
  const useDenseDesktopPortalRail = authenticated && !isMobile
  const useRailPortalLayout = layout === 'rail' && !collapseMobilePortal

  if (useRailPortalLayout) {
    return (
      <section aria-label="TenAceIQ platform navigation" style={railPortalShellStyle}>
        <div style={railPortalHeaderStyle}>
          <div style={{ ...portalTitleStyle, ...railPortalTitleStyle }}>{headline}</div>
          <p style={railPortalSubtitleStyle}>
            {authenticated ? 'Pick the tennis work for today.' : PLATFORM_POSITIONING}
          </p>
        </div>

        <form onSubmit={handleSearch} style={railPortalSearchFormStyle}>
          <label style={{ ...searchShellStyle, ...compactSearchShellStyle, ...railPortalSearchShellStyle }}>
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${activeLane.searchScope}`}
              aria-label={`Search ${activeLane.searchScope}`}
              style={searchInputStyle}
            />
          </label>
          <button type="submit" style={{ ...searchButtonStyle, ...compactSearchButtonStyle, ...railPortalSearchButtonStyle }}>
            Search
          </button>
        </form>

        <nav aria-label="Choose a TenAceIQ tool" style={railPortalLaneGridStyle}>
          {personalizedPortalLanes.map((lane) => {
            const laneActive = lane.id === activeLane.id
            const laneAccent = getLaneAccent(lane.id)
            const railTasks = publicVisitor ? lane.tasks.slice(0, 4) : lane.tasks

            return (
              <div key={lane.id} style={railPortalLaneGroupStyle}>
                <PortalLaneCard
                  lane={lane}
                  active={laneActive}
                  access={access}
                  authenticated={authenticated}
                  accessPending={accessPending}
                  profileLinked={profileLinked}
                  compact
                  dense
                  attentionCount={lane.id === 'club' ? clubAttentionCount : 0}
                />
                {laneActive ? (
                  <div
                    aria-label={`${lane.label} sections`}
                    data-portal-rail-sections={lane.id}
                    style={{
                      ...railPortalTaskListStyle,
                      borderColor: `color-mix(in srgb, ${laneAccent} 48%, rgba(116,190,255,0.16))`,
                    }}
                  >
                    {railTasks.map((task) => (
                      <PortalRailTaskLink
                        key={`${lane.id}-${task.href}-${task.title}`}
                        task={task}
                        access={access}
                        authenticated={authenticated}
                        accessPending={accessPending}
                        active={isPortalTaskActive(currentPortalPath, task.href)}
                        profileLinked={profileLinked}
                        accent={laneAccent}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </nav>
      </section>
    )
  }

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
              : '10px 16px 10px',
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
          gap: publicVisitor ? 10 : isMobile ? 14 : 12,
          padding: collapseMobilePortal ? '5px 0 0' : publicVisitor ? (isSmallMobile ? 12 : 14) : isSmallMobile ? 16 : isMobile ? 18 : 14,
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
          <nav
            ref={mobilePortalPaletteRef}
            id={mobilePortalLane ? portalActionMenuId : portalMenuId}
            data-mobile-portal-palette={mobilePortalLane ? 'actions' : customizingPortalShortcuts ? 'edit' : showAllPortalLanes ? 'all-tools' : 'shortcuts'}
            style={{
              ...(mobilePortalLane ? mobilePortalActionPaletteStyle : mobilePortalPaletteStyle),
              gridTemplateColumns: isMobile
                ? mobilePortalLane
                  ? 'repeat(3, minmax(0, 1fr))'
                  : 'repeat(4, minmax(0, 1fr))'
                : customizingPortalShortcuts || showAllPortalLanes
                  ? 'repeat(8, minmax(0, 1fr))'
                  : 'repeat(6, minmax(0, 1fr))',
              gap: isMobile ? 4 : 6,
            }}
            aria-label={mobilePortalLane ? `${mobilePortalLane.label} actions` : customizingPortalShortcuts ? 'Personalize TenAceIQ shortcuts' : showAllPortalLanes ? 'All TenAceIQ tools' : 'Pinned TenAceIQ shortcuts'}
            aria-live="polite"
            onScroll={handleMobilePortalPaletteScroll}
          >
            {mobilePortalLane ? (
              <>
                <button
                  type="button"
                  onClick={handleMobilePortalMainSelect}
                  data-mobile-portal-action="main"
                  style={mobilePortalBackTileStyle}
                  aria-label="Show main TenAceIQ menu"
                  aria-controls={portalMenuId}
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
            ) : customizingPortalShortcuts ? (
              <>
                {draftPinnedPortalShortcuts.map((shortcut) => (
                  <MobilePortalShortcutEditorTile
                    key={shortcut.id}
                    shortcut={shortcut}
                    pinnedPosition={draftPinnedPortalShortcutIds.indexOf(shortcut.id) + 1}
                    suggested={suggestedPortalShortcutIds.includes(shortcut.id)}
                    selected={selectedPinnedPortalShortcutId === shortcut.id}
                    onSelect={handlePortalShortcutCustomization}
                  />
                ))}
                <button
                  type="button"
                  onClick={savePortalShortcutCustomization}
                  data-mobile-portal-personalize="save"
                  style={{
                    ...mobilePortalTileStyle,
                    ...mobilePortalPersonalizeDoneStyle,
                  }}
                  aria-label="Save pinned shortcuts"
                >
                  <span style={mobilePortalTileIconStyle}>
                    <PushPinSimpleIcon size={27} weight="fill" aria-hidden="true" />
                  </span>
                  <span style={mobilePortalTileLabelStyle}>Done</span>
                </button>
                {unpinnedPortalShortcutOptions.map((shortcut) => (
                  <MobilePortalShortcutEditorTile
                    key={shortcut.id}
                    shortcut={shortcut}
                    pinnedPosition={0}
                    suggested={suggestedPortalShortcutIds.includes(shortcut.id)}
                    selected={false}
                    onSelect={handlePortalShortcutCustomization}
                  />
                ))}
              </>
            ) : showAllPortalLanes ? (
              <>
                <button
                  type="button"
                  onClick={showPinnedPortalTools}
                  data-mobile-portal-action="shortcuts"
                  style={mobilePortalBackTileStyle}
                  aria-label="Show pinned shortcuts"
                >
                  <span style={mobilePortalTileIconStyle}>
                    <PushPinSimpleIcon size={27} weight="fill" aria-hidden="true" />
                  </span>
                  <span style={mobilePortalTileLabelStyle}>Pinned</span>
                </button>
                {orderedPortalLanes.map((lane) => (
                  <MobilePortalLaneButton
                    key={lane.id}
                    lane={lane}
                    active={lane.id === activeLane.id}
                    expanded={false}
                    controlsId={portalActionMenuId}
                    onSelect={handleMobilePortalLaneSelect}
                    attentionCount={lane.id === 'club' ? clubAttentionCount : 0}
                  />
                ))}
              </>
            ) : (
              <>
                {pinnedPortalShortcuts.map((shortcut) => (
                  <MobilePortalShortcutTile
                    key={shortcut.id}
                    shortcut={shortcut}
                    access={access}
                    authenticated={authenticated}
                    accessPending={accessPending}
                    profileLinked={profileLinked}
                    active={isPortalTaskActive(currentPortalPath, shortcut.href)}
                    attentionCount={shortcut.laneId === 'club' ? clubAttentionCount : 0}
                    onActivate={handlePinnedPortalShortcutActivate}
                  />
                ))}
                <button
                  type="button"
                  onClick={showAllPortalTools}
                  data-mobile-portal-all="open"
                  style={mobilePortalTileStyle}
                  aria-label="Show all TenAceIQ tools"
                >
                  <span style={mobilePortalTileIconStyle}>
                    <TiqFeatureIcon name="exploreTennis" size="sm" variant="ghost" />
                  </span>
                  <span style={mobilePortalTileLabelStyle}>All tools</span>
                </button>
                <button
                  type="button"
                  onClick={openPortalShortcutCustomization}
                  data-mobile-portal-personalize="open"
                  style={{ ...mobilePortalTileStyle, ...mobilePortalPersonalizeTileStyle }}
                  aria-label="Personalize shortcuts"
                >
                  <span style={mobilePortalTileIconStyle}>
                    <SlidersHorizontalIcon size={27} weight="bold" aria-hidden="true" />
                  </span>
                  <span style={mobilePortalTileLabelStyle}>Edit</span>
                </button>
              </>
            )}
          </nav>
        ) : null}

        {collapseMobilePortal && customizingPortalShortcuts ? (
          <div data-mobile-portal-customizer="true" style={mobilePortalCustomizerStyle}>
            <span aria-live="polite" style={mobilePortalCustomizerCopyStyle}>{portalPersonalizationMessage}</span>
            <span style={mobilePortalCustomizerActionsStyle}>
              {selectedPinnedPortalShortcutId ? (
                <>
                  <button
                    type="button"
                    onClick={(event) => moveSelectedPortalShortcut(event, -1)}
                    disabled={selectedPinnedPortalShortcutPosition <= 1}
                    aria-label={`Move ${getPortalShortcutLabel(selectedPinnedPortalShortcutId)} left`}
                    style={{
                      ...mobilePortalOrderButtonStyle,
                      ...(selectedPinnedPortalShortcutPosition <= 1 ? mobilePortalDisabledButtonStyle : null),
                    }}
                  >←</button>
                  <button
                    type="button"
                    onClick={(event) => moveSelectedPortalShortcut(event, 1)}
                    disabled={selectedPinnedPortalShortcutPosition >= draftPinnedPortalShortcutIds.length}
                    aria-label={`Move ${getPortalShortcutLabel(selectedPinnedPortalShortcutId)} right`}
                    style={{
                      ...mobilePortalOrderButtonStyle,
                      ...(selectedPinnedPortalShortcutPosition >= draftPinnedPortalShortcutIds.length ? mobilePortalDisabledButtonStyle : null),
                    }}
                  >→</button>
                  <button type="button" onClick={unpinSelectedPortalShortcut} style={mobilePortalCustomizerButtonStyle}>Unpin</button>
                </>
              ) : (
                <button type="button" onClick={resetPortalShortcutCustomization} style={mobilePortalCustomizerButtonStyle}>Reset</button>
              )}
              <button type="button" onClick={cancelPortalShortcutCustomization} style={mobilePortalCustomizerButtonStyle}>Cancel</button>
            </span>
          </div>
        ) : null}

        {collapseMobilePortal && showPortalPersonalizationCue && !customizingPortalShortcuts && !showAllPortalLanes ? (
          <div data-portal-personalization-cue="true" style={mobilePortalPersonalizationCueStyle}>
            <span style={mobilePortalPersonalizationCueCopyStyle}>
              <strong>Make this yours.</strong>
              <span>Pin My Lab, Tactics, or the hubs you use most.</span>
            </span>
            <span style={mobilePortalCustomizerActionsStyle}>
              <button type="button" onClick={openPortalShortcutCustomization} style={mobilePortalCuePrimaryButtonStyle}>Choose</button>
              <button type="button" onClick={skipPortalPersonalizationCue} style={mobilePortalCustomizerButtonStyle}>Skip</button>
            </span>
          </div>
        ) : null}

        {collapseMobilePortal
        && portalPinRecommendation
        && !showPortalPersonalizationCue
        && !customizingPortalShortcuts
        && !showAllPortalLanes ? (
          <div data-portal-pin-recommendation="true" style={mobilePortalPersonalizationCueStyle}>
            <span aria-live="polite" style={mobilePortalPersonalizationCueCopyStyle}>
              <strong>Pin {getPortalShortcutLabel(portalPinRecommendation.shortcutId)}?</strong>
              <span>Replaces {getPortalShortcutLabel(portalPinRecommendation.replaceShortcutId)}.</span>
            </span>
            <span style={mobilePortalCustomizerActionsStyle}>
              <button type="button" onClick={applyPortalPinRecommendation} style={mobilePortalCuePrimaryButtonStyle}>Pin it</button>
              <button type="button" onClick={dismissPortalPinRecommendation} style={mobilePortalCustomizerButtonStyle}>Not now</button>
            </span>
          </div>
        ) : null}

        {collapseMobilePortal && mobilePortalScroll.max > 0 ? (
          <span aria-hidden="true" data-mobile-portal-scrollbar="true" style={mobilePortalScrollbarStyle}>
            <span
              style={{
                ...mobilePortalScrollbarThumbStyle,
                marginLeft: mobilePortalScroll.max > 0 ? `${mobilePortalScrollProgress * 66}%` : 0,
                width: '34%',
              }}
            />
          </span>
        ) : null}

        {!collapseMobilePortal ? (
          <>

          <div
            style={{
              ...desktopPortalCommandGridStyle,
              ...(useDenseDesktopPortalRail ? desktopPortalMemberCommandGridStyle : null),
              gap: publicVisitor ? 12 : 16,
            }}
          >
            <aside style={desktopPortalRailStyle}>
              {showExpandedPortalIntro ? (
                <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 6, minWidth: 0 }}>
                  <div style={{ ...portalTitleStyle, ...(publicVisitor ? publicPortalTitleStyle : signedInPortalTitleStyle) }}>{headline}</div>
                  <p style={{ ...portalSubtitleStyle, ...(publicVisitor ? publicPortalSubtitleStyle : null) }}>
                    {authenticated ? 'Choose what you need today.' : PLATFORM_POSITIONING}
                  </p>
                </div>
              ) : null}

              {showPortalBrandRunway && !useCompactPortalControls ? (
                <div
                  aria-hidden="true"
                  style={{
                    ...portalBrandRunwayStyle,
                    minHeight: useCompactPortalControls ? 84 : 132,
                  }}
                >
                  <span
                    style={{
                      ...portalBrandRunwayMarkStyle,
                      width: 'min(100%, 420px)',
                      opacity: 0.34,
                    }}
                  />
                </div>
              ) : null}

              {showPortalLanePicker ? (
                <nav
                  aria-label="Choose a TenAceIQ tool"
                  style={{
                    ...desktopPortalLaneGridStyle,
                    ...(useDenseDesktopPortalRail ? desktopPortalMemberLaneGridStyle : null),
                  }}
                >
                  {personalizedPortalLanes.map((lane) => (
                    <PortalLaneCard
                      key={lane.id}
                      lane={lane}
                      active={lane.id === activeLane.id}
                      access={access}
                      authenticated={authenticated}
                      accessPending={accessPending}
                      profileLinked={profileLinked}
                      compact={useCompactPortalControls}
                      mobileCompact={false}
                      dense={useDenseDesktopPortalRail}
                      attentionCount={lane.id === 'club' ? clubAttentionCount : 0}
                      />
                    ))}
                  </nav>
                ) : null}
            </aside>

            <div style={desktopPortalMainStyle}>
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
                <label style={{ ...searchShellStyle, ...(useCompactPortalControls ? compactSearchShellStyle : null) }}>
                  <SearchIcon />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search players, teams, leagues, tournaments, coaches, resources..."
                    aria-label="Search players, teams, leagues, tournaments, coaches, and resources"
                    style={searchInputStyle}
                  />
                </label>
                <button type="submit" style={{ ...searchButtonStyle, ...(useCompactPortalControls ? compactSearchButtonStyle : null) }}>
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
                      compact={useCompactPortalControls}
                    />
                  ))}
                </div>
              ) : null}
              <div style={desktopPortalSummaryStyle}>
                <span style={summaryKickerStyle}>Active path</span>
                <strong style={summaryTitleStyle}>{activeLane.label}</strong>
                <p style={summaryCopyStyle}>{activeLane.cue}. Start with search, then open the tennis action that matches today.</p>
                <div style={summaryProofGridStyle}>
                  {activeLane.tasks.slice(0, 3).map((task) => (
                    <span key={task.title} style={summaryProofStyle}>
                      <span style={summaryProofMetricStyle}>{task.metric}</span>
                      {task.title}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          </>
        ) : null}
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
  dense,
  attentionCount = 0,
}: {
  lane: PortalLane
  active: boolean
  access: ProductAccessState
  authenticated: boolean
  accessPending: boolean
  profileLinked: boolean
  compact?: boolean
  mobileCompact?: boolean
  dense?: boolean
  attentionCount?: number
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
        ...(dense ? denseDesktopLaneCardStyle : null),
        borderColor: active ? accent : 'rgba(116,190,255,0.15)',
        background: active ? portalActiveCardBackground : 'rgba(255,255,255,0.045)',
        boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(116,190,255,0.08)' : undefined,
      }}
    >
      <TiqFeatureIcon name={lane.icon} size="sm" variant={active ? 'surface' : 'ghost'} />
      <span style={laneCopyStyle}>
        <span style={laneTopStyle}>
          <strong style={laneLabelStyle}>{lane.label}</strong>
          {attentionCount > 0 ? <ClubAttentionBadge count={attentionCount} /> : null}
          {target.locked && !mobileCompact ? (
            <span style={lockBubbleStyle} title={`${lane.label} unlock`}>
              <NavLockIcon size={13} />
            </span>
          ) : null}
        </span>
        <span style={{ ...laneCueStyle, ...(dense ? denseDesktopLaneCueStyle : null) }}>{target.locked ? 'Preview unlock' : lane.cue}</span>
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

function PortalRailTaskLink({
  task,
  access,
  authenticated,
  accessPending,
  active,
  profileLinked,
  accent,
}: {
  task: PortalLane['tasks'][number]
  access: ProductAccessState
  authenticated: boolean
  accessPending: boolean
  active: boolean
  profileLinked: boolean
  accent: string
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
        ...railPortalTaskLinkStyle,
        ...(active ? getRailPortalTaskActiveStyle(accent) : null),
      }}
    >
      <span style={{ ...railPortalTaskDotStyle, background: active ? accent : 'rgba(116,190,255,0.32)' }} aria-hidden="true" />
      <span style={railPortalTaskCopyStyle}>
        <strong style={railPortalTaskTitleStyle}>
          {target.title}
          {target.locked ? (
            <span style={railPortalTaskLockStyle} aria-label={`${target.title} locked`}>
              <NavLockIcon size={11} />
            </span>
          ) : null}
        </strong>
        <span style={railPortalTaskMetaStyle}>{task.metric}</span>
      </span>
    </Link>
  )
}

function MobilePortalShortcutTile({
  shortcut,
  access,
  authenticated,
  accessPending,
  profileLinked,
  active,
  attentionCount = 0,
  onActivate,
}: {
  shortcut: PortalShortcut
  access: ProductAccessState
  authenticated: boolean
  accessPending: boolean
  profileLinked: boolean
  active: boolean
  attentionCount?: number
  onActivate: (event: MouseEvent<HTMLAnchorElement>, shortcut: PortalShortcut, destination: string) => void
}) {
  const target = shortcut.kind === 'action' && shortcut.requiredRoute
    ? getPortalTaskTarget({
        href: shortcut.href,
        requiredRoute: shortcut.requiredRoute,
        title: shortcut.label,
        access,
        authenticated,
        accessPending,
        profileLinked,
      })
    : { href: shortcut.href, title: shortcut.label, locked: false }

  return (
    <Link
      href={target.href}
      onClick={(event) => onActivate(event, shortcut, target.href)}
      data-portal-shortcut={shortcut.id}
      aria-current={active ? 'page' : undefined}
      aria-label={`${target.title}${target.locked ? ' locked' : ''}: ${shortcut.cue}`}
      title={shortcut.cue}
      style={{
        ...mobilePortalTileStyle,
        ...(active ? getActiveTaskCardStyle(getLaneAccent(shortcut.laneId)) : null),
      }}
    >
      <span style={mobilePortalTileIconStyle}>
        <TiqFeatureIcon name={shortcut.icon} size="sm" variant={active ? 'surface' : 'ghost'} />
      </span>
      <span style={mobilePortalTileLabelStyle}>
        {target.title}
        {target.locked ? <NavLockIcon size={10} /> : null}
        {attentionCount > 0 ? <ClubAttentionBadge count={attentionCount} compact /> : null}
      </span>
    </Link>
  )
}

function MobilePortalShortcutEditorTile({
  shortcut,
  pinnedPosition,
  suggested,
  selected,
  onSelect,
}: {
  shortcut: PortalShortcut
  pinnedPosition: number
  suggested: boolean
  selected: boolean
  onSelect: (event: MouseEvent<HTMLButtonElement>, shortcutId: PortalShortcutPreferenceId) => void
}) {
  const pinned = pinnedPosition > 0

  return (
    <button
      type="button"
      onClick={(event) => onSelect(event, shortcut.id)}
      data-portal-shortcut-option={shortcut.id}
      data-portal-shortcut-suggested={suggested ? 'true' : undefined}
      data-portal-shortcut-selected={selected ? 'true' : undefined}
      aria-pressed={pinned}
      aria-label={`${suggested ? 'Suggested. ' : ''}${pinned ? `Edit position ${pinnedPosition} for` : 'Pin'} ${shortcut.label}`}
      title={shortcut.cue}
      style={{
        ...mobilePortalTileStyle,
        borderColor: pinned ? 'rgba(155,225,29,0.76)' : 'rgba(116,190,255,0.15)',
        background: pinned ? 'rgba(155,225,29,0.11)' : 'rgba(255,255,255,0.045)',
        boxShadow: selected ? '0 0 0 2px rgba(116,190,255,0.78), 0 10px 22px rgba(2,10,24,0.24)' : undefined,
      }}
    >
      {pinned ? (
        <span aria-hidden="true" style={mobilePortalPinBadgeStyle}>
          <PushPinSimpleIcon size={10} weight="fill" />
          {pinnedPosition}
        </span>
      ) : null}
      {suggested ? <span style={mobilePortalSuggestionBadgeStyle}>For you</span> : null}
      <span style={mobilePortalTileIconStyle}>
        <TiqFeatureIcon name={shortcut.icon} size="sm" variant={pinned ? 'surface' : 'ghost'} />
      </span>
      <span style={mobilePortalTileLabelStyle}>{shortcut.label}</span>
    </button>
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
      data-mobile-portal-action={getMobileActionKey(target.title)}
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

function MobilePortalLaneButton({
  lane,
  active,
  expanded,
  controlsId,
  onSelect,
  attentionCount = 0,
  customizing = false,
  pinnedPosition = 0,
}: {
  lane: PortalLane
  active: boolean
  expanded: boolean
  controlsId: string
  onSelect: (event: MouseEvent<HTMLButtonElement>, laneId: PortalLaneId) => void
  attentionCount?: number
  customizing?: boolean
  pinnedPosition?: number
}) {
  const label = getMobileLaneLabel(lane.id)
  const pinned = pinnedPosition > 0

  return (
    <button
      type="button"
      onClick={(event) => onSelect(event, lane.id)}
      data-mobile-portal-lane={lane.id}
      style={{
        ...mobilePortalTileStyle,
        borderColor: customizing && pinned ? 'rgba(155,225,29,0.76)' : active ? getLaneAccent(lane.id) : 'rgba(116,190,255,0.15)',
        background: customizing && pinned ? 'rgba(155,225,29,0.11)' : active ? portalActiveCardBackground : 'rgba(255,255,255,0.045)',
      }}
      aria-pressed={customizing ? pinned : active}
      aria-controls={customizing ? undefined : controlsId}
      aria-expanded={customizing ? undefined : expanded}
      aria-label={customizing ? `${pinned ? 'Unpin' : 'Pin'} ${label}` : `${label}: ${lane.cue}`}
    >
      {customizing && pinned ? (
        <span aria-hidden="true" style={mobilePortalPinBadgeStyle}>
          <PushPinSimpleIcon size={10} weight="fill" />
          {pinnedPosition}
        </span>
      ) : null}
      <span style={mobilePortalTileIconStyle}>
        <TiqFeatureIcon name={lane.icon} size="sm" variant={active ? 'surface' : 'ghost'} />
      </span>
      <span style={mobilePortalTileLabelStyle}>{label}{attentionCount > 0 ? <ClubAttentionBadge count={attentionCount} compact /> : null}</span>
    </button>
  )
}

function ClubAttentionBadge({ count, compact = false }: { count: number; compact?: boolean }) {
  const label = `${count} Club ${count === 1 ? 'conversation needs' : 'conversations need'} attention`
  return <span aria-label={label} title={label} style={{ ...clubAttentionBadgeStyle, ...(compact ? compactClubAttentionBadgeStyle : null) }}>{count > 9 ? '9+' : count}</span>
}

const clubAttentionBadgeStyle: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  minWidth: 20,
  height: 20,
  padding: '0 5px',
  borderRadius: 999,
  background: '#7dd3fc',
  color: '#061321',
  fontSize: 11,
  fontWeight: 950,
  lineHeight: 1,
  boxShadow: '0 0 0 2px rgba(6,19,33,0.72)',
}

const compactClubAttentionBadgeStyle: CSSProperties = {
  minWidth: 16,
  height: 16,
  padding: '0 4px',
  fontSize: 9,
  boxShadow: 'none',
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
      data-mobile-portal-action={`${lane.id}-hub`}
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
  if (laneId === 'club') return '#7dd3fc'
  return '#9be11d'
}

function getMobileLaneLabel(laneId: PortalLaneId) {
  if (laneId === 'find') return 'Explore'
  if (laneId === 'you') return 'Improve'
  if (laneId === 'compete') return 'Compete'
  if (laneId === 'coach') return 'Coaches'
  if (laneId === 'team') return 'Captain'
  if (laneId === 'club') return 'Club'
  return 'Leagues'
}

function getMobileHubLabel(laneId: PortalLaneId) {
  if (laneId === 'find') return 'Explore Hub'
  if (laneId === 'you') return 'Improve Hub'
  if (laneId === 'compete') return 'Compete Hub'
  if (laneId === 'coach') return 'Coaches Hub'
  if (laneId === 'team') return 'Team Hub'
  if (laneId === 'club') return 'Club Home'
  return 'Organizer Hub'
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
  if (title === 'Run clinics') return 'Clinics'
  if (title === 'Develop players') return 'Players'
  if (title === 'Host competition') return 'Compete'
  return title
}

function getMobileActionKey(title: string) {
  return getMobileTaskLabel(title).toLowerCase().replace(/\s+/g, '-')
}

function getActiveTaskCardStyle(accent: string): CSSProperties {
  return {
    border: `1px solid ${accent}`,
    background: 'var(--portal-active-card-bg)',
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px color-mix(in srgb, ${accent} 18%, transparent)`,
  }
}

function getRailPortalTaskActiveStyle(accent: string): CSSProperties {
  return {
    borderColor: `color-mix(in srgb, ${accent} 84%, rgba(116,190,255,0.16))`,
    background: `color-mix(in srgb, ${accent} 14%, rgba(255,255,255,0.04))`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px color-mix(in srgb, ${accent} 16%, transparent)`,
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

const railPortalShellStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateRows: 'auto auto auto',
  alignContent: 'start',
  gap: 10,
  width: '100%',
  minHeight: '100%',
  minWidth: 0,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.15)',
  background: portalSurfaceBackground,
  color: 'var(--foreground)',
  boxShadow: '0 28px 80px rgba(2, 10, 24, 0.28), inset 0 1px 0 rgba(255,255,255,0.06)',
  boxSizing: 'border-box',
  overflow: 'hidden',
}

const railPortalHeaderStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: 6,
  minWidth: 0,
}

const railPortalTitleStyle: CSSProperties = {
  fontSize: 'clamp(1.12rem, 1.35vw, 1.45rem)',
  lineHeight: 1.04,
}

const railPortalSubtitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 760,
}

const railPortalSearchFormStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const railPortalSearchShellStyle: CSSProperties = {
  minHeight: 40,
  padding: '0 11px',
}

const railPortalSearchButtonStyle: CSSProperties = {
  width: '100%',
  minHeight: 38,
  borderRadius: 8,
}

const railPortalLaneGridStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 7,
  minWidth: 0,
  width: '100%',
  boxSizing: 'border-box',
}

const railPortalLaneGroupStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 6,
  minWidth: 0,
}

const railPortalTaskListStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  marginLeft: 13,
  padding: '0 0 2px 10px',
  borderLeft: '1px solid rgba(116,190,255,0.16)',
  minWidth: 0,
  boxSizing: 'border-box',
}

const railPortalTaskLinkStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '8px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 8,
  minHeight: 35,
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.032)',
  color: 'var(--foreground)',
  textDecoration: 'none',
  minWidth: 0,
  boxSizing: 'border-box',
}

const railPortalTaskDotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  boxShadow: '0 0 0 3px rgba(255,255,255,0.035)',
}

const railPortalTaskCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
}

const railPortalTaskTitleStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  color: 'var(--foreground-strong)',
  fontSize: 11.5,
  lineHeight: 1.12,
  fontWeight: 920,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const railPortalTaskMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 9.5,
  lineHeight: 1,
  fontWeight: 900,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const railPortalTaskLockStyle: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  flex: '0 0 auto',
  color: 'var(--shell-copy-muted)',
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

const desktopPortalCommandGridStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(min(100%, 240px), 0.52fr) minmax(0, 1.48fr)',
  alignItems: 'stretch',
  minWidth: 0,
}

const desktopPortalMemberCommandGridStyle: CSSProperties = {
  gridTemplateColumns: 'minmax(min(100%, 360px), 0.72fr) minmax(0, 1.28fr)',
}

const desktopPortalRailStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
}

const desktopPortalMainStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
}

const desktopPortalSummaryStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: 8,
  minHeight: 154,
  alignContent: 'start',
  padding: 14,
  borderRadius: 8,
  border: '1px solid rgba(155,225,29,0.16)',
  background:
    'linear-gradient(160deg, rgba(155,225,29,0.08), rgba(116,190,255,0.055) 42%, rgba(7,17,33,0.72))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
}

const summaryKickerStyle: CSSProperties = {
  width: 'fit-content',
  color: 'var(--brand-green)',
  fontSize: 11,
  lineHeight: 1,
  fontWeight: 950,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const summaryTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const summaryCopyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 760,
  overflowWrap: 'anywhere',
}

const summaryProofGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
  minWidth: 0,
}

const summaryProofStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minHeight: 62,
  alignContent: 'center',
  padding: 10,
  borderRadius: 8,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(7,17,33,0.58)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1.2,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const summaryProofMetricStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 10,
  lineHeight: 1,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const desktopPortalLaneGridStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 7,
  minWidth: 0,
  width: '100%',
  boxSizing: 'border-box',
}

const desktopPortalMemberLaneGridStyle: CSSProperties = {
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
}

const publicPortalTitleStyle: CSSProperties = {
  fontSize: 'clamp(1.15rem, 2.2vw, 1.55rem)',
  lineHeight: 1.08,
}

const signedInPortalTitleStyle: CSSProperties = {
  fontSize: 'clamp(1.35rem, 2.4vw, 2.05rem)',
  lineHeight: 1.04,
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
  aspectRatio: '1552 / 1614',
  background: 'url("/brand/web/header-iq-compact.png") center / contain no-repeat',
  pointerEvents: 'none',
}

const mobilePortalPaletteStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 4,
  minWidth: 0,
  width: '100%',
  boxSizing: 'border-box',
  overflow: 'hidden',
  paddingBottom: 0,
}

const mobilePortalActionPaletteStyle: CSSProperties = {
  ...mobilePortalPaletteStyle,
}

const mobilePortalScrollbarStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'none',
  width: 'min(164px, 46%)',
  height: 6,
  margin: '-5px auto 0',
  overflow: 'hidden',
  borderRadius: 999,
  background: 'linear-gradient(90deg, rgba(116,190,255,0.14), rgba(155,225,29,0.12))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 20px rgba(2,10,24,0.22)',
}

const mobilePortalScrollbarThumbStyle: CSSProperties = {
  display: 'block',
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(90deg, rgba(155,225,29,0.96), rgba(116,190,255,0.82))',
  boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 0 16px rgba(155,225,29,0.24)',
  transition: 'margin-left 120ms ease, width 120ms ease',
}

const mobilePortalTileStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateRows: '34px minmax(0, auto)',
  justifyItems: 'center',
  alignContent: 'center',
  gap: 3,
  minHeight: 64,
  padding: '6px 4px',
  borderRadius: 12,
  border: '1px solid rgba(116,190,255,0.20)',
  background: 'rgba(255,255,255,0.055)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  minWidth: 0,
  width: '100%',
  boxSizing: 'border-box',
  cursor: 'pointer',
  touchAction: 'manipulation',
  userSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
  scrollSnapAlign: 'start',
  transition: 'border-color 120ms ease, background 120ms ease, box-shadow 120ms ease',
}

const mobilePortalPersonalizeTileStyle: CSSProperties = {
  borderColor: 'rgba(155,225,29,0.28)',
  background: 'linear-gradient(145deg, rgba(155,225,29,0.08), rgba(116,190,255,0.07))',
  color: 'var(--brand-green)',
}

const mobilePortalPersonalizeDoneStyle: CSSProperties = {
  borderColor: 'rgba(155,225,29,0.62)',
  background: 'linear-gradient(145deg, rgba(155,225,29,0.18), rgba(116,190,255,0.09))',
  color: 'var(--brand-green)',
  boxShadow: '0 0 0 1px rgba(155,225,29,0.08), 0 10px 22px rgba(2,10,24,0.22)',
}

const mobilePortalPinBadgeStyle: CSSProperties = {
  position: 'absolute',
  top: 5,
  right: 5,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  minWidth: 20,
  height: 18,
  padding: '0 4px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.46)',
  background: '#102347',
  color: '#B7F24A',
  fontSize: 9,
  lineHeight: 1,
  fontWeight: 950,
  boxSizing: 'border-box',
}

const mobilePortalSuggestionBadgeStyle: CSSProperties = {
  position: 'absolute',
  top: 5,
  left: 5,
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 18,
  padding: '0 5px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.42)',
  background: '#102347',
  color: '#9FD7FF',
  fontSize: 8,
  lineHeight: 1,
  fontWeight: 950,
  letterSpacing: '0.02em',
  boxSizing: 'border-box',
}

const mobilePortalCustomizerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  minHeight: 38,
  padding: '5px 6px 0',
  color: 'var(--shell-copy-muted)',
  boxSizing: 'border-box',
}

const mobilePortalCustomizerCopyStyle: CSSProperties = {
  minWidth: 0,
  fontSize: 11,
  lineHeight: 1.25,
  fontWeight: 820,
}

const mobilePortalCustomizerActionsStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  flex: '0 0 auto',
}

const mobilePortalCustomizerButtonStyle: CSSProperties = {
  minHeight: 30,
  padding: '0 8px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  fontSize: 10,
  lineHeight: 1,
  fontWeight: 900,
  cursor: 'pointer',
  touchAction: 'manipulation',
}

const mobilePortalOrderButtonStyle: CSSProperties = {
  ...mobilePortalCustomizerButtonStyle,
  minWidth: 36,
  minHeight: 34,
  padding: 0,
  borderColor: 'rgba(116,190,255,0.34)',
  background: 'rgba(116,190,255,0.10)',
  color: '#9FD7FF',
  fontSize: 17,
}

const mobilePortalDisabledButtonStyle: CSSProperties = {
  opacity: 0.34,
  cursor: 'default',
}

const mobilePortalPersonalizationCueStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  minHeight: 48,
  margin: '1px 2px 0',
  padding: '7px 8px',
  borderRadius: 12,
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.10), rgba(116,190,255,0.07))',
  boxSizing: 'border-box',
}

const mobilePortalPersonalizationCueCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 10.5,
  lineHeight: 1.25,
  fontWeight: 760,
}

const mobilePortalCuePrimaryButtonStyle: CSSProperties = {
  ...mobilePortalCustomizerButtonStyle,
  borderColor: 'rgba(155,225,29,0.42)',
  background: 'rgba(155,225,29,0.14)',
  color: 'var(--brand-green)',
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
  width: 32,
  height: 32,
}

const mobilePortalTileLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  color: 'var(--foreground-strong)',
  fontSize: 10.5,
  lineHeight: 1.15,
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
  minHeight: 46,
  padding: '7px 8px',
  borderRadius: 8,
}

const denseDesktopLaneCardStyle: CSSProperties = {
  gridTemplateColumns: '28px minmax(0, 1fr)',
  gap: 7,
  minHeight: 42,
  padding: '6px 8px',
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

const denseDesktopLaneCueStyle: CSSProperties = {
  display: 'none',
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
