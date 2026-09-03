'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import SiteShell from '@/app/components/site-shell'
import SiteHeader from '@/app/components/site-header'
import SiteFooter from '@/app/components/site-footer'
import PortalToolBar from '@/app/components/portal-tool-bar'
import TeamConnectionInvite from '@/app/components/team-connection-invite'
import { useAuth } from '@/app/components/auth-provider'
import {
  buildCaptainScopedHref,
  chooseLatestCaptainResumeState,
  getCaptainResumeHref,
  loadCaptainResumeStateFromCloud,
  readCaptainResumeState,
  syncCaptainResumeState,
} from '@/lib/captain-memory'
import { notifyPlatformResumeUpdated } from '@/lib/platform-resume-events'
import { buildTeamRoomHref } from '@/lib/team-room'
import {
  buildTeamRoomCourtReadiness,
  canRespondToLineupChange,
  type TeamRoomCourtReadiness,
} from '@/lib/team-room-match-flow'
import {
  getTeamRoomLineupAnnouncementStatus,
  type TeamRoomFinalLineupReceipt,
  type TeamRoomLineupAnnouncement,
} from '@/lib/team-room-final-lineup'
import {
  buildTeamRoomMapsHref,
  getTeamRoomMatchDayPhase,
  type TeamRoomMatchDayPhase,
} from '@/lib/team-room-match-day'
import { buildMatchWeekGoogleCalendarHref } from '@/lib/captain-match-week-links'
import { CAPTAIN_AVAILABILITY_REPLY_NOTICE } from '@/lib/captain-reply-alert'
import { buildCaptainLockedLineupId, isCaptainLineupLocked } from '@/lib/captain-lineup-confirmation'
import { buildCaptainLevelUpCardHref, getCaptainLevelUpCardDetails } from '@/lib/captain-level-up-challenge'
import {
  buildTeamRoomArrivalSmsHref,
  buildTeamRoomArrivalCourts,
  buildTeamRoomArrivalPriority,
  buildTeamRoomLateArrivalBuilderHref,
  buildTeamRoomLineupCourtHref,
  findTeamRoomAssignedCourt,
  findTeamRoomArrivalContact,
  findTeamRoomArrivalOutreach,
  readTeamRoomArrivalTextReturn,
  TEAM_ROOM_ARRIVAL_TEXT_RETURN_KEY,
  teamRoomArrivalStatusLabel,
  type TeamRoomArrivalCheckIn,
  type TeamRoomArrivalOutreach,
  type TeamRoomArrivalStatus,
  type TeamRoomArrivalTextReturn,
} from '@/lib/team-room-arrival'
import { supabase } from '@/lib/supabase'
import styles from './team-room.module.css'

type TeamOption = {
  teamName: string
  leagueName: string
  flight: string
  roles: string[]
  isDefault: boolean
  href: string
}

type TeamRoomMember = {
  id: string
  name: string
  playerName: string
  roles: string[]
  muted: boolean
}

type TeamRoomMessage = {
  id: string
  senderUserId: string
  senderName: string
  body: string
  kind: 'message' | 'announcement' | 'system'
  createdAt: string
  editedAt: string
  deletedAt: string
  isMine: boolean
  replyToMessageId: string
  replyTo: { id: string; senderName: string; body: string } | null
  reactions: Array<{
    reaction: 'ack' | 'helpful' | 'celebrate'
    count: number
    profileIds: string[]
    reacted: boolean
  }>
  attachment: {
    name: string
    mimeType: string
    size: number
    url: string
  } | null
  card: TeamRoomMatchCard | null
  levelUpChallenge: TeamRoomLevelUpChallenge | null
  lineupAnnouncement: TeamRoomLineupAnnouncement | null
  response: 'yes' | 'maybe' | 'no' | null
  responseSummary: { yes: number; maybe: number; no: number; total: number }
  responseDetails: Array<{ profileId: string; name: string; response: 'yes' | 'maybe' | 'no'; updatedAt: string }>
}

type TeamRoomLevelUpChallenge = {
  id: string
  title: string
  focus: string
  detail: string
  cardIds: string[]
  completedCardIds: string[]
  completed: boolean
  completedCount: number
  connectedCount: number
  status: 'active' | 'scheduled' | 'cancelled' | 'closed'
  scheduledForDate: string
}

type TeamRoomRosterMember = {
  id: string
  name: string
  phone: string
  email: string
  role: string
  joined: boolean
  memberId: string
}

type TeamRoomMatchCard = {
  cardType: 'availability' | 'projected_lineup'
  title: string
  matchDate: string
  opponent: string
  matchTime: string
  facility: string
  matchId: string
  externalMatchId: string
  lineup: Array<{ label: string; players: string[] }>
  availabilityRequestId: string
  availabilityRequestUrl: string
  state: 'active' | 'upcoming' | 'archived'
  lineupVersion: number
  lineupChanges: string[]
  lineupChangeNotice: {
    courtLabel: string
    outgoingPlayerName: string
    replacementPlayerName: string
    affectedNames: string[]
    beforePlayers: string[]
    afterPlayers: string[]
    pending: boolean
    notifiedAt: string
    notifiedCount: number
    response: '' | 'accepted' | 'declined'
    respondedAt: string
    responderProfileId: string
    responderName: string
    deadlineAt: string
    deadlineStatus: '' | 'scheduled' | 'reminded' | 'answered'
    reminderSentAt: string
    publishedLineupChange: boolean
    previousFinalLineupId: string
    publishedAnnouncementMessageId: string
    publishedAt: string
    publishedByUserId: string
    publishedByName: string
  } | null
  finalLineup: TeamRoomFinalLineupReceipt | null
  arrivalCheckIns: TeamRoomArrivalCheckIn[]
  arrivalOutreach: TeamRoomArrivalOutreach[]
  matchCompletedAt: string
  acknowledged: boolean
  acknowledgmentSummary: { total: number; profileIds: string[] }
  availabilitySummary: {
    yes: number
    maybe: number
    no: number
    waiting: number
    total: number
    yesNames: string[]
    waitingNames: string[]
    maybeNames: string[]
    noNames: string[]
    scenarioId: string
  } | null
  reminder: {
    reminderAt: string
    status: 'scheduled' | 'sent' | 'cancelled'
    sentAt: string
    notificationCount: number
  } | null
}

type TeamRoomFinalResult = {
  matchId: string
  externalMatchId: string
  teamName: string
  opponentName: string
  teamScore: string
  opponentScore: string
  score: string
  outcome: 'win' | 'loss' | 'final'
  unresolvedPlayerCount: number
  lines: Array<{
    id: string
    label: string
    teamPlayers: string[]
    opponentPlayers: string[]
    score: string
    winner: 'team' | 'opponent' | 'final'
    teamMissingPlayerCount: number
    opponentMissingPlayerCount: number
  }>
}

type TeamRoomManagedArrivalStatus = Extract<TeamRoomArrivalStatus, 'on_my_way' | 'here'> | 'waiting'

type TeamRoomActionQueue = {
  messageId: string
  matchDate: string
  waitingCount: number
  waitingNames: string[]
  maybeCount: number
  maybeNames: string[]
  unseenLineupCount: number
  unseenLineupNames: string[]
  lineupChangeCount: number
  unresolvedCount: number
  unresolvedProfileIds: string[]
  reminderAt: string
  reminderStatus: string
  lastReminderAt: string
}

type TeamRoomFinalLineupReview = {
  announcementMessageId: string
  sourceMessageId: string
  requiredCount: number
  seenCount: number
  unseenNames: string[]
  currentUserRequired: boolean
  currentUserSeen: boolean
  reminderSentAt: string
}

type TeamRoomScheduledMatch = {
  id: string
  source: 'usta' | 'tiq'
  matchDate: string
  matchTime: string
  opponent: string
  facility: string
}

type TeamRoom = {
  id: string
  subject: string
  teamName: string
  leagueName: string
  flight: string
  roles: string[]
  canManage: boolean
  muted: boolean
  members: TeamRoomMember[]
  rosterMembers: TeamRoomRosterMember[]
  removedMembers: Array<{ id: string; name: string }>
  activeInviteCount: number
  messages: TeamRoomMessage[]
  href: string
  activeCardId: string
  nextScheduledMatch: TeamRoomScheduledMatch | null
  finalResultCardId: string
  activeLevelUpChallengeId: string
  finalResult: TeamRoomFinalResult | null
  finalLineupReview: TeamRoomFinalLineupReview | null
  actionQueue: TeamRoomActionQueue
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const subscribeToUserAgent = () => () => undefined

function getIsIOSSnapshot() {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent)
}

function getIsStandaloneSnapshot() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
}

function subscribeToStandalone(onStoreChange: () => void) {
  const media = window.matchMedia('(display-mode: standalone)')
  media.addEventListener('change', onStoreChange)
  return () => media.removeEventListener('change', onStoreChange)
}

const QUICK_MESSAGES = [
  { label: 'Match reminder', body: 'Match reminder: please confirm you saw the match details and arrival time.' },
  { label: 'Lineup update', body: 'Projected lineup update: please review your court and let me know if anything changed.' },
  { label: 'Carpool', body: 'Does anyone need a ride or have room in a car for the next match?' },
]

export default function TeamRoomPage() {
  return (
    <SiteShell active="/messages" appMode>
      <Suspense fallback={<TeamRoomLoading />}>
        <TeamRoomContent />
      </Suspense>
    </SiteShell>
  )
}

function TeamRoomContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { authResolved, session, userId } = useAuth()
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [room, setRoom] = useState<TeamRoom | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [respondingId, setRespondingId] = useState('')
  const [acknowledgingId, setAcknowledgingId] = useState('')
  const [notifyingLineupChangeId, setNotifyingLineupChangeId] = useState('')
  const [respondingLineupChangeId, setRespondingLineupChangeId] = useState('')
  const [schedulingLineupChangeDeadlineId, setSchedulingLineupChangeDeadlineId] = useState('')
  const [sendingFinalLineupId, setSendingFinalLineupId] = useState('')
  const [lineupChangeDeadlineDate, setLineupChangeDeadlineDate] = useState('')
  const [reminding, setReminding] = useState(false)
  const [markingFinalLineupSeen, setMarkingFinalLineupSeen] = useState(false)
  const [remindingFinalLineup, setRemindingFinalLineup] = useState(false)
  const [completingMatchDay, setCompletingMatchDay] = useState(false)
  const [savingArrivalStatus, setSavingArrivalStatus] = useState<TeamRoomArrivalStatus | ''>('')
  const [savingManagedArrival, setSavingManagedArrival] = useState('')
  const [arrivalTextReturn, setArrivalTextReturn] = useState<TeamRoomArrivalTextReturn | null>(null)
  const [localDateKey, setLocalDateKey] = useState('')
  const [remindingChallengeId, setRemindingChallengeId] = useState('')
  const [closingChallengeId, setClosingChallengeId] = useState('')
  const [completingChallengeId, setCompletingChallengeId] = useState('')
  const [schedulingReminder, setSchedulingReminder] = useState(false)
  const [reminderAt, setReminderAt] = useState('')
  const [showBrowserAlertPrompt, setShowBrowserAlertPrompt] = useState(false)
  const [messageBody, setMessageBody] = useState('')
  const [announcement, setAnnouncement] = useState(false)
  const [showMatchComposer, setShowMatchComposer] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [replyTo, setReplyTo] = useState<TeamRoomMessage | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [editingId, setEditingId] = useState('')
  const [editBody, setEditBody] = useState('')
  const [onlineProfileIds, setOnlineProfileIds] = useState<string[]>([])
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [draftLoadedRoomId, setDraftLoadedRoomId] = useState('')
  const [roomResumeResolved, setRoomResumeResolved] = useState(false)
  const [matchDraft, setMatchDraft] = useState(() => ({
    matchDate: searchParams.get('date')?.trim() || '',
    opponent: searchParams.get('opponent')?.trim() || '',
    matchTime: searchParams.get('time')?.trim() || '',
    facility: searchParams.get('facility')?.trim() || '',
  }))
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement | null>(null)
  const messagesRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const realtimeRefreshRef = useRef<number | null>(null)
  const draftPendingRef = useRef(false)
  const arrivalMessagePreparedRef = useRef('')
  const matchDraftSeedRef = useRef('')
  const accessToken = session?.access_token || ''
  const requestedQuery = useMemo(() => {
    const params = new URLSearchParams()
    for (const key of ['team', 'league', 'flight', 'date', 'opponent', 'time', 'facility']) {
      const value = searchParams.get(key)?.trim()
      if (value) params.set(key, value)
    }
    const query = params.toString()
    return query ? `?${query}` : ''
  }, [searchParams])

  const focusedMessageId = searchParams.get('message')?.trim() || ''
  const focusedPlayerName = searchParams.get('player')?.trim() || ''
  const focusedCourtLabel = searchParams.get('court')?.trim() || ''
  const focusedReplyStatus = searchParams.get('status')?.trim() || ''
  const focusedArrivalAction = searchParams.get('arrival')?.trim() || ''
  const finalLineupDeliveryIntent = searchParams.get('intent') === 'finalize-lineup'

  const pinnedMessage = useMemo(
    () => room?.messages.find((message) => message.id === focusedMessageId && message.card)
      || room?.messages.find((message) => message.id === room.activeCardId)
      || null,
    [focusedMessageId, room?.activeCardId, room?.messages],
  )
  const activeMatchMessage = useMemo(
    () => room?.messages.find((message) => message.id === room.activeCardId && message.card) || null,
    [room?.activeCardId, room?.messages],
  )
  const hasActiveAvailability = activeMatchMessage?.card?.cardType === 'availability'
    && activeMatchMessage.card.state !== 'archived'
  const finalResultMessage = useMemo(
    () => room?.messages.find((message) => message.id === room.finalResultCardId && message.card) || null,
    [room?.finalResultCardId, room?.messages],
  )
  const pinnedLevelUpChallenge = useMemo(
    () => room?.messages.find((message) => (
      message.id === focusedMessageId
      && message.levelUpChallenge?.status === 'active'
    ))
      || room?.messages.find((message) => message.id === room.activeLevelUpChallengeId)
      || null,
    [focusedMessageId, room?.activeLevelUpChallengeId, room?.messages],
  )
  const currentFinalLineup = activeMatchMessage?.card?.finalLineup || null
  const finalLineupDeliveryCard = pinnedMessage?.card || activeMatchMessage?.card || null
  const finalLineupDeliverySent = Boolean(finalLineupDeliveryCard?.finalLineup)
  const finalLineupDeliveryMatchComplete = Boolean(
    finalLineupDeliveryCard?.matchDate
    && finalResultMessage?.card?.matchDate === finalLineupDeliveryCard.matchDate
    && room?.finalResult,
  )
  const currentFinalLineupPhase = getTeamRoomMatchDayPhase({
    matchDate: activeMatchMessage?.card?.matchDate || '',
    localDateKey,
    matchCompletedAt: activeMatchMessage?.card?.matchCompletedAt,
  })
  const pendingFinalLineupAnnouncementId = activeMatchMessage?.card?.lineupChangeNotice?.publishedLineupChange
    && !activeMatchMessage.card.lineupChangeNotice.response
    ? activeMatchMessage.card.lineupChangeNotice.publishedAnnouncementMessageId
    : ''
  const captainHref = useMemo(() => buildCaptainScopedHref('/captain', {
    team: room?.teamName,
    league: room?.leagueName,
    flight: room?.flight,
    date: pinnedMessage?.card?.matchDate || matchDraft.matchDate,
    opponent: pinnedMessage?.card?.opponent || matchDraft.opponent,
  }), [matchDraft.matchDate, matchDraft.opponent, pinnedMessage?.card?.matchDate, pinnedMessage?.card?.opponent, room?.flight, room?.leagueName, room?.teamName])
  const finalLineupEditHref = useMemo(() => {
    const card = activeMatchMessage?.card
    const baseHref = buildCaptainScopedHref('/captain/lineup-builder', {
      team: room?.teamName,
      league: room?.leagueName,
      flight: room?.flight,
      date: card?.matchDate,
      opponent: card?.opponent,
      scenarioId: card?.availabilitySummary?.scenarioId || undefined,
    })
    const params = new URLSearchParams({ source: 'team_room', availability: 'replies' })
    return `${baseHref}${baseHref.includes('?') ? '&' : '?'}${params.toString()}#captain-lineup-courts`
  }, [activeMatchMessage?.card, room?.flight, room?.leagueName, room?.teamName])
  const scorecardHref = useMemo(() => {
    const card = activeMatchMessage?.card
    const baseHref = buildCaptainScopedHref('/captain/record-result', {
      team: room?.teamName,
      league: room?.leagueName,
      flight: room?.flight,
      date: card?.matchDate || matchDraft.matchDate,
      opponent: card?.opponent || matchDraft.opponent,
    })
    const details = new URLSearchParams()
    const matchTime = card?.matchTime || matchDraft.matchTime
    const facility = card?.facility || matchDraft.facility
    if (matchTime) details.set('time', matchTime)
    if (facility) details.set('facility', facility)
    const query = details.toString()
    return query ? `${baseHref}${baseHref.includes('?') ? '&' : '?'}${query}` : baseHref
  }, [
    activeMatchMessage?.card,
    matchDraft.facility,
    matchDraft.matchDate,
    matchDraft.matchTime,
    matchDraft.opponent,
    room?.flight,
    room?.leagueName,
    room?.teamName,
  ])
  const matchupSheetHref = useMemo(() => scorecardHref.replace('/captain/record-result', '/captain/matchup-sheet'), [scorecardHref])
  const scorecardReturnHref = room?.href || captainHref
  const playerLinksHref = `/data-assist?intent=upload-source&context=Team%20Room&type=team_summary&help=1&returnTo=${encodeURIComponent(scorecardReturnHref)}#upload`
  const resultJustUpdated = searchParams.get('result') === 'updated'
  const focusedFinalResult = Boolean(
    focusedMessageId
    && room?.finalResult
    && focusedMessageId === room.finalResultCardId,
  )
  const activeFinalResultFocused = Boolean(
    focusedFinalResult
    && activeMatchMessage?.id === room?.finalResultCardId,
  )

  useEffect(() => {
    if (!room?.id) return
    const source = room.nextScheduledMatch || activeMatchMessage?.card
    if (!source?.matchDate) return
    const seedKey = [room.id, source.matchDate, source.opponent, source.matchTime, source.facility].join(':')
    if (matchDraftSeedRef.current === seedKey) return
    matchDraftSeedRef.current = seedKey
    setMatchDraft({
      matchDate: searchParams.get('date')?.trim() || source.matchDate,
      opponent: searchParams.get('opponent')?.trim() || source.opponent,
      matchTime: searchParams.get('time')?.trim() || source.matchTime,
      facility: searchParams.get('facility')?.trim() || source.facility,
    })
  }, [activeMatchMessage?.card, room?.id, room?.nextScheduledMatch, searchParams])

  useEffect(() => {
    const updateLocalDate = () => setLocalDateKey(localDateInputKey(new Date()))
    updateLocalDate()
    const interval = window.setInterval(updateLocalDate, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const pinnedMatchDate = pinnedMessage?.card?.matchDate || ''
  const pinnedReminderAt = pinnedMessage?.card?.reminder?.reminderAt || ''
  const pinnedReminderStatus = pinnedMessage?.card?.reminder?.status || ''
  const pinnedLineupChangeDeadlineAt = pinnedMessage?.card?.lineupChangeNotice?.deadlineAt || ''
  useEffect(() => {
    if (!pinnedMatchDate) return
    setReminderAt(toLocalDateTimeInput(
      pinnedReminderStatus === 'scheduled'
        ? pinnedReminderAt
        : defaultReminderTime(pinnedMatchDate),
    ))
  }, [pinnedMatchDate, pinnedReminderAt, pinnedReminderStatus, pinnedMessage?.id])

  useEffect(() => {
    setLineupChangeDeadlineDate(
      pinnedLineupChangeDeadlineAt.slice(0, 10) || defaultLineupChangeDeadlineDate(pinnedMatchDate),
    )
  }, [pinnedLineupChangeDeadlineAt, pinnedMatchDate, pinnedMessage?.id])

  useEffect(() => {
    if (!focusedMessageId) return
    const targetId = focusedFinalResult
      ? `final-result-${focusedMessageId}`
      : pinnedMessage?.id === focusedMessageId
        ? `match-card-${focusedMessageId}`
        : ''
    if (!targetId) return
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId)
      if (!target) return
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      target.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' })
      target.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusedFinalResult, focusedMessageId, pinnedMessage?.id])

  const loadRoom = useCallback(async (options: { quiet?: boolean } = {}) => {
    if (!accessToken) return
    if (!options.quiet) setLoading(true)
    try {
      const response = await fetch(`/api/team-rooms${requestedQuery}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      const payload = await response.json() as {
        ok?: boolean
        message?: string
        teams?: TeamOption[]
        room?: TeamRoom | null
      }
      if (!response.ok || !payload.ok) throw new Error(payload.message || 'Team Room could not be opened.')
      setTeams(payload.teams || [])
      setRoom(payload.room || null)
      setError('')
    } catch (loadError) {
      if (!options.quiet) setError(loadError instanceof Error ? loadError.message : 'Team Room could not be opened.')
    } finally {
      if (!options.quiet) setLoading(false)
    }
  }, [accessToken, requestedQuery])

  useEffect(() => {
    if (!authResolved) return
    if (!accessToken) {
      setLoading(false)
      return
    }
    void loadRoom()
  }, [accessToken, authResolved, loadRoom])

  useEffect(() => {
    if (!authResolved) return
    if (!accessToken || requestedQuery) {
      setRoomResumeResolved(true)
      return
    }
    setRoomResumeResolved(false)
    let active = true
    let redirecting = false
    void (async () => {
      const cloudState = await loadCaptainResumeStateFromCloud(accessToken)
      const resumeState = chooseLatestCaptainResumeState(readCaptainResumeState(userId), cloudState)
      const resumeHref = getCaptainResumeHref(resumeState)
      if (!active || resumeState?.lastTool !== 'team-room' || !resumeHref.startsWith('/team-room?')) return
      redirecting = true
      router.replace(resumeHref)
    })().finally(() => {
      if (active && !redirecting) setRoomResumeResolved(true)
    })
    return () => { active = false }
  }, [accessToken, authResolved, requestedQuery, router, userId])

  useEffect(() => {
    if (!roomResumeResolved || !room?.id || !userId) return
    const matchDate = pinnedMessage?.card?.matchDate || matchDraft.matchDate
    const opponent = pinnedMessage?.card?.opponent || matchDraft.opponent
    const lastHref = buildTeamRoomHref({
      teamName: room.teamName,
      leagueName: room.leagueName,
      flight: room.flight,
      date: matchDate,
      opponent,
      time: pinnedMessage?.card?.matchTime || matchDraft.matchTime,
      facility: pinnedMessage?.card?.facility || matchDraft.facility,
    })
    void syncCaptainResumeState({
      team: room.teamName,
      league: room.leagueName,
      flight: room.flight,
      lastTool: 'team-room',
      lastToolLabel: 'Team Chat',
      lastHref,
      eventDate: matchDate || undefined,
      opponentTeam: opponent || undefined,
      teamRoomId: room.id,
    }, userId, accessToken)
  }, [accessToken, matchDraft.facility, matchDraft.matchDate, matchDraft.matchTime, matchDraft.opponent, pinnedMessage?.card?.facility, pinnedMessage?.card?.matchDate, pinnedMessage?.card?.matchTime, pinnedMessage?.card?.opponent, room?.flight, room?.id, room?.leagueName, room?.teamName, roomResumeResolved, userId])

  useEffect(() => {
    if (!accessToken || !room?.id || !userId) return
    const scheduleRefresh = () => {
      if (realtimeRefreshRef.current !== null) window.clearTimeout(realtimeRefreshRef.current)
      realtimeRefreshRef.current = window.setTimeout(() => void loadRoom({ quiet: true }), 180)
    }
    const channel = supabase
      .channel(`team-room:${room.id}`, { config: { presence: { key: userId } } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_messages', filter: `conversation_id=eq.${room.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_room_message_responses', filter: `conversation_id=eq.${room.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_room_lineup_acknowledgments', filter: `conversation_id=eq.${room.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_room_message_reactions', filter: `conversation_id=eq.${room.id}` }, scheduleRefresh)
      .on('presence', { event: 'sync' }, () => {
        setOnlineProfileIds(Object.keys(channel.presenceState()))
      })
      .subscribe((status) => {
        const connected = status === 'SUBSCRIBED'
        setRealtimeConnected(connected)
        if (connected) void channel.track({ profileId: userId, onlineAt: new Date().toISOString() })
      })

    const fallbackRefresh = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadRoom({ quiet: true })
    }, 25000)
    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') void loadRoom({ quiet: true })
    }
    document.addEventListener('visibilitychange', refreshOnReturn)
    window.addEventListener('pageshow', refreshOnReturn)
    window.addEventListener('focus', refreshOnReturn)
    return () => {
      if (realtimeRefreshRef.current !== null) window.clearTimeout(realtimeRefreshRef.current)
      window.clearInterval(fallbackRefresh)
      document.removeEventListener('visibilitychange', refreshOnReturn)
      window.removeEventListener('pageshow', refreshOnReturn)
      window.removeEventListener('focus', refreshOnReturn)
      setRealtimeConnected(false)
      setOnlineProfileIds([])
      void supabase.removeChannel(channel)
    }
  }, [accessToken, loadRoom, room?.id, userId])

  useEffect(() => {
    if (!room?.id) return
    const draftKey = `tenaceiq-team-room-draft:${room.id}`
    const savedDraft = window.localStorage.getItem(draftKey) || ''
    draftPendingRef.current = Boolean(savedDraft.trim())
    setMessageBody(savedDraft)
    setDraftLoadedRoomId(room.id)

    const scrollKey = `tenaceiq-team-room-scroll:${room.id}`
    const savedScroll = Number(window.sessionStorage.getItem(scrollKey))
    if (savedScroll > 0) {
      window.requestAnimationFrame(() => window.scrollTo({ top: savedScroll, behavior: 'instant' }))
    }
    const saveScroll = () => window.sessionStorage.setItem(scrollKey, String(Math.max(0, Math.round(window.scrollY))))
    window.addEventListener('pagehide', saveScroll)
    return () => {
      saveScroll()
      window.removeEventListener('pagehide', saveScroll)
    }
  }, [room?.id])

  useEffect(() => {
    if (!room?.id || draftLoadedRoomId !== room.id) return
    const draftKey = `tenaceiq-team-room-draft:${room.id}`
    if (messageBody) window.localStorage.setItem(draftKey, messageBody)
    else window.localStorage.removeItem(draftKey)
    const draftPending = Boolean(messageBody.trim())
    if (draftPending !== draftPendingRef.current) {
      draftPendingRef.current = draftPending
      notifyPlatformResumeUpdated('team-chat')
    }
  }, [draftLoadedRoomId, messageBody, room?.id])

  useEffect(() => {
    if (
      focusedArrivalAction !== 'message'
      || !room?.id
      || !activeMatchMessage?.id
      || !focusedPlayerName
      || !focusedCourtLabel
    ) return
    const handoffKey = [room.id, activeMatchMessage.id, focusedCourtLabel, focusedPlayerName].join(':')
    if (arrivalMessagePreparedRef.current === handoffKey) return
    arrivalMessagePreparedRef.current = handoffKey
    setMessageBody(`${focusedPlayerName} — are you still able to make ${focusedCourtLabel}? Please share your ETA.`)
    setNotice(`Message ready for ${focusedPlayerName}.`)
    window.requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      composerRef.current?.focus()
    })
  }, [activeMatchMessage?.id, focusedArrivalAction, focusedCourtLabel, focusedPlayerName, room?.id])

  useEffect(() => {
    const restoreArrivalText = () => {
      try {
        const stored = window.sessionStorage.getItem(TEAM_ROOM_ARRIVAL_TEXT_RETURN_KEY)
        const context = readTeamRoomArrivalTextReturn(stored)
        if (!context) {
          if (stored) window.sessionStorage.removeItem(TEAM_ROOM_ARRIVAL_TEXT_RETURN_KEY)
          setArrivalTextReturn(null)
          return
        }
        setArrivalTextReturn(context)
      } catch {
        setArrivalTextReturn(null)
      }
    }
    restoreArrivalText()
    window.addEventListener('pageshow', restoreArrivalText)
    window.addEventListener('focus', restoreArrivalText)
    return () => {
      window.removeEventListener('pageshow', restoreArrivalText)
      window.removeEventListener('focus', restoreArrivalText)
    }
  }, [])

  useEffect(() => {
    if (!showMembers) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowMembers(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [showMembers])

  async function postAction(input: Record<string, unknown>) {
    if (!accessToken || !room) throw new Error('Open a linked team first.')
    const response = await fetch('/api/team-rooms', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        teamName: room.teamName,
        leagueName: room.leagueName,
        flight: room.flight,
        ...input,
      }),
    })
    const payload = await response.json() as Record<string, unknown>
    if (!response.ok || payload.ok !== true) throw new Error(String(payload.message || 'Team Room action failed.'))
    return payload
  }

  async function sendMessage() {
    if ((!messageBody.trim() && !selectedFile) || sending || !room) return
    setSending(true)
    setError('')
    try {
      if (selectedFile) {
        const form = new FormData()
        form.set('file', selectedFile)
        form.set('body', messageBody)
        form.set('announcement', String(announcement))
        form.set('replyToMessageId', replyTo?.id || '')
        form.set('teamName', room.teamName)
        form.set('leagueName', room.leagueName)
        form.set('flight', room.flight)
        const response = await fetch('/api/team-rooms/attachments', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: form,
        })
        const payload = await response.json() as { ok?: boolean; message?: string }
        if (!response.ok || !payload.ok) throw new Error(payload.message || 'The attachment could not be shared.')
      } else {
        await postAction({ action: 'send', body: messageBody, announcement, replyToMessageId: replyTo?.id || '' })
      }
      setMessageBody('')
      setAnnouncement(false)
      setReplyTo(null)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadRoom({ quiet: true })
      window.requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }))
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Message could not be sent.')
    } finally {
      setSending(false)
    }
  }

  async function postAvailabilityCard() {
    if (!room || !matchDraft.matchDate) {
      setError('Choose the match date first.')
      return
    }
    setSending(true)
    setError('')
    try {
      await postAction({
        action: 'post_match_card',
        card: {
          cardType: 'availability',
          title: 'Can you play?',
          ...matchDraft,
        },
      })
      setShowMatchComposer(false)
      setNotice('Availability check posted. Team replies will update here.')
      await loadRoom({ quiet: true })
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : 'Availability check could not be posted.')
    } finally {
      setSending(false)
    }
  }

  function openAvailability() {
    if (hasActiveAvailability && activeMatchMessage) {
      const target = document.getElementById(`match-card-${activeMatchMessage.id}`)
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      target?.focus({ preventScroll: true })
      return
    }
    setShowMatchComposer((current) => !current)
  }

  async function respondToMatch(messageId: string, response: 'yes' | 'maybe' | 'no') {
    if (!room || respondingId) return
    setRespondingId(messageId)
    setError('')
    try {
      await postAction({ action: 'respond', messageId, response })
      setRoom({
        ...room,
        messages: room.messages.map((message) => {
          if (message.id !== messageId) return message
          const previous = message.response
          return {
            ...message,
            response,
            card: message.card?.cardType === 'projected_lineup' && !message.card.acknowledged
              ? {
                  ...message.card,
                  acknowledged: true,
                  acknowledgmentSummary: {
                    ...message.card.acknowledgmentSummary,
                    total: message.card.acknowledgmentSummary.total + 1,
                  },
                }
              : message.card,
            responseSummary: {
              yes: message.card?.availabilitySummary
                ? message.responseSummary.yes
                : message.responseSummary.yes + (response === 'yes' ? 1 : 0) - (previous === 'yes' ? 1 : 0),
              maybe: message.card?.availabilitySummary
                ? message.responseSummary.maybe
                : message.responseSummary.maybe + (response === 'maybe' ? 1 : 0) - (previous === 'maybe' ? 1 : 0),
              no: message.card?.availabilitySummary
                ? message.responseSummary.no
                : message.responseSummary.no + (response === 'no' ? 1 : 0) - (previous === 'no' ? 1 : 0),
              total: message.card?.availabilitySummary
                ? message.responseSummary.total
                : message.responseSummary.total + (previous ? 0 : 1),
            },
          }
        }),
      })
      setNotice(response === 'yes' ? 'You are marked available.' : response === 'no' ? 'You are marked unavailable.' : 'You are marked maybe.')
      if (room.messages.some((message) => message.id === messageId && message.card?.availabilitySummary)) {
        await loadRoom({ quiet: true })
      }
    } catch (responseError) {
      setError(responseError instanceof Error ? responseError.message : 'Your reply could not be saved.')
    } finally {
      setRespondingId('')
    }
  }

  async function acknowledgeLineup(messageId: string) {
    if (!room || acknowledgingId) return
    setAcknowledgingId(messageId)
    setError('')
    try {
      await postAction({ action: 'acknowledge_lineup', messageId })
      setNotice('The captain can now see that you reviewed this lineup.')
      await loadRoom({ quiet: true })
    } catch (ackError) {
      setError(ackError instanceof Error ? ackError.message : 'Your acknowledgment could not be saved.')
    } finally {
      setAcknowledgingId('')
    }
  }

  async function notifyLineupChange(messageId: string) {
    if (!room || notifyingLineupChangeId) return
    setNotifyingLineupChangeId(messageId)
    setError('')
    try {
      const payload = await postAction({ action: 'notify_lineup_change', messageId })
      const notificationIds = Array.isArray(payload.notificationIds)
        ? payload.notificationIds.filter((id): id is string => typeof id === 'string')
        : []
      if (notificationIds.length) {
        await fetch('/api/internal-notifications/email-fallback', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationIds }),
        }).catch(() => null)
      }
      const directShareNames = Array.isArray(payload.directShareNames)
        ? payload.directShareNames.filter((name): name is string => typeof name === 'string')
        : []
      const shareText = typeof payload.shareText === 'string' ? payload.shareText : ''
      let copiedForDirectShare = false
      if (directShareNames.length && shareText && navigator.clipboard) {
        copiedForDirectShare = await navigator.clipboard.writeText(shareText).then(() => true).catch(() => false)
      }
      const notifiedCount = Math.max(0, Number(payload.notifiedCount) || 0)
      const publishedLineupChange = payload.publishedLineupChange === true
      setNotice(
        `${publishedLineupChange
          ? 'Final lineup change posted in Team Chat.'
          : notifiedCount ? `Notified ${notifiedCount} connected player${notifiedCount === 1 ? '' : 's'}.` : 'Lineup update marked ready to share.'}`
        + (directShareNames.length
          ? copiedForDirectShare
            ? ` Update copied for ${directShareNames.join(', ')}.`
            : ` Share the update directly with ${directShareNames.join(', ')}.`
          : ''),
      )
      await loadRoom({ quiet: true })
    } catch (notifyError) {
      setError(notifyError instanceof Error ? notifyError.message : 'The lineup update could not be sent.')
    } finally {
      setNotifyingLineupChangeId('')
    }
  }

  async function respondToLineupChange(messageId: string, response: 'accepted' | 'declined') {
    if (!room || respondingLineupChangeId) return
    setRespondingLineupChangeId(messageId)
    setError('')
    try {
      const payload = await postAction({ action: 'respond_lineup_change', messageId, response })
      const notificationIds = Array.isArray(payload.notificationIds)
        ? payload.notificationIds.filter((id): id is string => typeof id === 'string')
        : []
      if (notificationIds.length) {
        await fetch('/api/internal-notifications/email-fallback', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationIds }),
        }).catch(() => null)
      }
      setNotice(response === 'accepted'
        ? payload.finalLineupPublished === true
          ? 'You’re confirmed. The revised final lineup is now published.'
          : 'You’re confirmed for this court. The captain has been updated.'
        : 'The captain knows you can’t play and can choose another player.')
      await loadRoom({ quiet: true })
      if (response === 'accepted') {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          const arrival = document.getElementById(`team-room-arrival-${messageId}`)
          if (!arrival) return
          const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          arrival.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
          arrival.focus({ preventScroll: true })
        }))
      }
    } catch (responseError) {
      setError(responseError instanceof Error ? responseError.message : 'Your lineup answer could not be saved.')
    } finally {
      setRespondingLineupChangeId('')
    }
  }

  async function scheduleLineupChangeDeadline(messageId: string) {
    if (!room || !lineupChangeDeadlineDate || schedulingLineupChangeDeadlineId) return
    setSchedulingLineupChangeDeadlineId(messageId)
    setError('')
    try {
      await postAction({
        action: 'schedule_lineup_change_deadline',
        messageId,
        deadlineDate: lineupChangeDeadlineDate,
      })
      setNotice(`Reply-by date set for ${formatDateOnly(lineupChangeDeadlineDate)}. TIQ will check that morning.`)
      await loadRoom({ quiet: true })
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : 'The reply-by date could not be set.')
    } finally {
      setSchedulingLineupChangeDeadlineId('')
    }
  }

  async function remindWaiting(messageId: string) {
    if (!room || reminding) return
    setReminding(true)
    setError('')
    try {
      const payload = await postAction({ action: 'remind_waiting', messageId })
      const notificationIds = Array.isArray(payload.notificationIds)
        ? payload.notificationIds.filter((id): id is string => typeof id === 'string')
        : []
      if (notificationIds.length) {
        await fetch('/api/internal-notifications/email-fallback', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ notificationIds }),
        }).catch(() => null)
      }
      const targetCount = Number(payload.targetCount) || 0
      setNotice(targetCount ? `Reminder sent to ${targetCount} teammate${targetCount === 1 ? '' : 's'}.` : 'Everyone is caught up.')
      await loadRoom({ quiet: true })
    } catch (reminderError) {
      setError(reminderError instanceof Error ? reminderError.message : 'The reminder could not be sent.')
    } finally {
      setReminding(false)
    }
  }

  async function sendFinalLineup(messageId: string, lineupId: string) {
    if (!room || sendingFinalLineupId) return
    setSendingFinalLineupId(messageId)
    setError('')
    try {
      const payload = await postAction({ action: 'send_final_lineup', messageId, lineupId })
      setNotice(payload.alreadySent === true ? 'This lineup is already with the team.' : 'Lineup sent to the team.')
      await loadRoom({ quiet: true })
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'The lineup could not be sent.')
    } finally {
      setSendingFinalLineupId('')
    }
  }

  async function markFinalLineupSeen(messageId: string) {
    if (!room || markingFinalLineupSeen) return
    setMarkingFinalLineupSeen(true)
    setError('')
    try {
      await postAction({ action: 'ack_final_lineup', messageId })
      setNotice('Final lineup marked seen.')
      await loadRoom({ quiet: true })
    } catch (seenError) {
      setError(seenError instanceof Error ? seenError.message : 'Your review could not be saved.')
    } finally {
      setMarkingFinalLineupSeen(false)
    }
  }

  async function saveArrivalStatus(messageId: string, status: TeamRoomArrivalStatus) {
    if (!room || savingArrivalStatus) return
    setSavingArrivalStatus(status)
    setError('')
    try {
      await postAction({ action: 'set_arrival_status', messageId, arrivalStatus: status })
      setNotice(`${teamRoomArrivalStatusLabel(status)} saved for your court.`)
      await loadRoom({ quiet: true })
    } catch (arrivalError) {
      setError(arrivalError instanceof Error ? arrivalError.message : 'Your arrival status could not be saved.')
    } finally {
      setSavingArrivalStatus('')
    }
  }

  async function saveManagedArrivalStatus(
    messageId: string,
    playerName: string,
    status: TeamRoomManagedArrivalStatus,
  ) {
    if (!room || savingManagedArrival) return
    const savingKey = `${playerName}:${status}`
    setSavingManagedArrival(savingKey)
    setError('')
    try {
      await postAction(status === 'waiting'
        ? { action: 'clear_player_arrival_status', messageId, playerName }
        : { action: 'set_player_arrival_status', messageId, playerName, arrivalStatus: status })
      setNotice(status === 'waiting'
        ? `${playerName} reset to waiting.`
        : `${playerName} marked ${teamRoomArrivalStatusLabel(status).toLowerCase()}.`)
      await loadRoom({ quiet: true })
    } catch (arrivalError) {
      setError(arrivalError instanceof Error ? arrivalError.message : `${playerName}'s arrival could not be saved.`)
    } finally {
      setSavingManagedArrival('')
    }
  }

  async function shareArrivalCheckIn(playerNames: string[], card: TeamRoomMatchCard) {
    if (!room || !playerNames.length) return
    const visibleNames = playerNames.slice(0, 3).join(', ')
    const remaining = Math.max(0, playerNames.length - 3)
    const match = [
      card.matchDate ? formatMatchDate(card.matchDate) : 'today\'s match',
      card.opponent ? `vs ${card.opponent}` : '',
    ].filter(Boolean).join(' ')
    const logistics = [card.matchTime, card.facility].filter(Boolean).join(' at ')
    await shareOrCopy({
      title: `${room.teamName} arrival check-in`,
      text: `${visibleNames}${remaining ? ` +${remaining} more` : ''} — please reply Here or On my way for ${match}${logistics ? ` (${logistics})` : ''}.`,
    })
    setNotice('Arrival check-in ready to send by text or another app.')
  }

  function textArrivalPlayer(
    messageId: string,
    playerName: string,
    phone: string,
    courtLabel: string,
    card: TeamRoomMatchCard,
  ) {
    const href = buildTeamRoomArrivalSmsHref(
      phone,
      buildArrivalReplyText([playerName], card),
      getIsIOSSnapshot(),
    )
    if (!href) {
      setError(`${playerName}'s roster phone number is not ready to text.`)
      return
    }
    if (accessToken && room) {
      void fetch('/api/team-rooms', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamName: room.teamName,
          leagueName: room.leagueName,
          flight: room.flight,
          action: 'record_arrival_outreach',
          messageId,
          playerName,
        }),
        keepalive: true,
      }).catch(() => null)
    }
    try {
      window.sessionStorage.setItem(TEAM_ROOM_ARRIVAL_TEXT_RETURN_KEY, JSON.stringify({
        roomId: room?.id || '',
        messageId,
        playerName,
        courtLabel,
        createdAt: new Date().toISOString(),
      }))
    } catch {
      // The SMS handoff still works when private browsing blocks session storage.
    }
    setNotice(`Text ready for ${playerName}. Their reply can be marked here.`)
    window.location.href = href
  }

  function finishArrivalTextReturn(playerName: string) {
    try {
      window.sessionStorage.removeItem(TEAM_ROOM_ARRIVAL_TEXT_RETURN_KEY)
    } catch {
      // The restored controls are still usable when storage is unavailable.
    }
    setArrivalTextReturn(null)
    setNotice(`${playerName} is ready to update. Mark their reply below.`)
  }

  async function remindFinalLineupUnseen(messageId: string) {
    if (!room || remindingFinalLineup) return
    setRemindingFinalLineup(true)
    setError('')
    try {
      const payload = await postAction({ action: 'remind_final_lineup_unseen', messageId })
      const notificationIds = Array.isArray(payload.notificationIds)
        ? payload.notificationIds.filter((id): id is string => typeof id === 'string')
        : []
      if (notificationIds.length) {
        await fetch('/api/internal-notifications/email-fallback', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ notificationIds }),
        }).catch(() => null)
      }
      const targetCount = Number(payload.targetCount) || 0
      const mutedCount = Number(payload.mutedCount) || 0
      setNotice(targetCount
        ? mutedCount
          ? `Reminder sent to ${targetCount}. ${mutedCount} unseen player${mutedCount === 1 ? ' has' : 's have'} alerts muted; follow up directly.`
          : `Reminder sent to ${targetCount} lineup player${targetCount === 1 ? '' : 's'}.`
        : mutedCount
          ? 'The unseen players have Team Chat alerts muted. Follow up directly.'
          : payload.alreadySent === true
            ? 'The final lineup reminder was already sent.'
            : 'Everyone has seen the final lineup.')
      await loadRoom({ quiet: true })
    } catch (reminderError) {
      setError(reminderError instanceof Error ? reminderError.message : 'The lineup reminder could not be sent.')
    } finally {
      setRemindingFinalLineup(false)
    }
  }

  async function completeMatchDay(messageId: string) {
    if (!room || completingMatchDay) return
    setCompletingMatchDay(true)
    setError('')
    try {
      await postAction({ action: 'complete_match_day', messageId })
      setNotice('Match complete. Add the scorecard when it is ready.')
      await loadRoom({ quiet: true })
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : 'The match could not be closed.')
    } finally {
      setCompletingMatchDay(false)
    }
  }

  async function remindLevelUpChallenge(messageId: string) {
    if (!room || remindingChallengeId) return
    setRemindingChallengeId(messageId)
    setError('')
    try {
      const payload = await postAction({ action: 'remind_level_up_challenge', messageId })
      const notificationIds = Array.isArray(payload.notificationIds)
        ? payload.notificationIds.filter((id): id is string => typeof id === 'string')
        : []
      if (notificationIds.length) {
        await fetch('/api/internal-notifications/email-fallback', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ notificationIds }),
        }).catch(() => null)
      }
      const targetCount = Number(payload.targetCount) || 0
      const incompleteCount = Number(payload.incompleteCount) || 0
      setNotice(targetCount
        ? `Challenge reminder sent to ${targetCount} teammate${targetCount === 1 ? '' : 's'}.`
        : incompleteCount
          ? 'Incomplete teammates have Team Room alerts muted.'
          : 'Every connected teammate is caught up.')
      await loadRoom({ quiet: true })
    } catch (reminderError) {
      setError(reminderError instanceof Error ? reminderError.message : 'The challenge reminder could not be sent.')
    } finally {
      setRemindingChallengeId('')
    }
  }

  async function completeLevelUpChallenge(messageId: string) {
    if (!room || completingChallengeId) return
    setCompletingChallengeId(messageId)
    setError('')
    try {
      await postAction({ action: 'complete_level_up_challenge', messageId })
      setNotice('Challenge complete. Your captain can see the team total.')
      await loadRoom({ quiet: true })
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : 'Your challenge completion could not be saved.')
    } finally {
      setCompletingChallengeId('')
    }
  }

  async function closeLevelUpChallenge(messageId: string) {
    if (!room || closingChallengeId) return
    setClosingChallengeId(messageId)
    setError('')
    try {
      await postAction({ action: 'close_level_up_challenge', messageId })
      setNotice('Challenge moved to the team history.')
      await loadRoom({ quiet: true })
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : 'The challenge could not be ended.')
    } finally {
      setClosingChallengeId('')
    }
  }

  async function scheduleReminder(messageId: string) {
    if (!room || !reminderAt || schedulingReminder) return
    setSchedulingReminder(true)
    setError('')
    try {
      const localDate = new Date(reminderAt)
      await postAction({ action: 'schedule_reminder', messageId, reminderAt: localDate.toISOString() })
      setNotice(`Reminder set for ${formatReminderTime(localDate.toISOString())}.`)
      await loadRoom({ quiet: true })
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : 'The reminder could not be scheduled.')
    } finally {
      setSchedulingReminder(false)
    }
  }

  async function enableBrowserAlerts() {
    const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim()
    if (!publicKey || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Background team alerts are not supported on this device yet.')
      return
    }
    const permission = await window.Notification.requestPermission()
    if (permission !== 'granted') {
      setShowBrowserAlertPrompt(true)
      setNotice('Team alerts were not enabled.')
      return
    }
    try {
      await navigator.serviceWorker.register('/team-room-sw.js', { scope: '/' })
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      const serialized = subscription.toJSON()
      const response = await fetch('/api/team-rooms/push', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'subscribe',
          endpoint: subscription.endpoint,
          keys: serialized.keys,
        }),
      })
      const payload = await response.json() as { ok?: boolean; message?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.message || 'Background alerts could not be enabled.')
      setShowBrowserAlertPrompt(false)
      setNotice('Background team alerts are on for this device.')
    } catch (pushError) {
      setShowBrowserAlertPrompt(true)
      setError(pushError instanceof Error ? pushError.message : 'Background alerts could not be enabled.')
    }
  }

  async function shareRoom() {
    if (!room) return
    const url = new URL(room.href, window.location.origin).toString()
    await shareOrCopy({ title: `${room.teamName} Team Room`, text: `Open our ${room.teamName} Team Room in TenAceIQ.`, url })
    setNotice('Team Room link ready to share.')
  }

  async function inviteTeam() {
    if (!room || sharing) return
    setSharing(true)
    setError('')
    try {
      const payload = await postAction({ action: 'create_invite' })
      const inviteUrl = String(payload.inviteUrl || '')
      await shareOrCopy({
        title: `Join ${room.teamName}`,
        text: `Join ${room.teamName} in TenAceIQ to use our Team Room and keep match-week communication together.`,
        url: inviteUrl,
      })
      setNotice('Secure team invite ready to share. It expires in 30 days.')
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Team invite could not be created.')
    } finally {
      setSharing(false)
    }
  }

  async function toggleMute() {
    if (!room) return
    setError('')
    try {
      const nextMuted = !room.muted
      await postAction({ action: 'set_mute', muted: nextMuted })
      setRoom({ ...room, muted: nextMuted })
      setNotice(nextMuted ? 'Team Room notifications muted.' : 'Team Room notifications turned on.')
    } catch (muteError) {
      setError(muteError instanceof Error ? muteError.message : 'Notification setting could not be changed.')
    }
  }

  async function toggleReaction(messageId: string, reaction: 'ack' | 'helpful' | 'celebrate') {
    try {
      await postAction({ action: 'toggle_reaction', messageId, reaction })
      await loadRoom({ quiet: true })
    } catch (reactionError) {
      setError(reactionError instanceof Error ? reactionError.message : 'The acknowledgment could not be saved.')
    }
  }

  async function saveEditedMessage(messageId: string) {
    if (!editBody.trim()) return
    try {
      await postAction({ action: 'edit_message', messageId, body: editBody })
      setEditingId('')
      setEditBody('')
      await loadRoom({ quiet: true })
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : 'The message could not be updated.')
    }
  }

  async function deleteMessage(messageId: string) {
    if (!window.confirm('Remove this message from Team Chat?')) return
    try {
      await postAction({ action: 'delete_message', messageId })
      if (replyTo?.id === messageId) setReplyTo(null)
      await loadRoom({ quiet: true })
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'The message could not be removed.')
    }
  }

  async function removeMember(member: TeamRoomMember) {
    if (!window.confirm(`Remove ${member.name} from Team Chat? Their team link stays intact.`)) return
    try {
      await postAction({ action: 'remove_member', memberId: member.id })
      setNotice(`${member.name} was removed from Team Chat.`)
      await loadRoom({ quiet: true })
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : 'The member could not be removed.')
    }
  }

  async function restoreMember(member: { id: string; name: string }) {
    try {
      await postAction({ action: 'restore_member', memberId: member.id })
      setNotice(`${member.name} can use Team Chat again.`)
      await loadRoom({ quiet: true })
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : 'The member could not be restored.')
    }
  }

  async function revokeInvites() {
    if (!window.confirm('Revoke every active Team Chat invite link? You can create a new link afterward.')) return
    try {
      const payload = await postAction({ action: 'revoke_invites' })
      const count = Number(payload.revokedCount) || 0
      setNotice(count ? `${count} active invite ${count === 1 ? 'link was' : 'links were'} revoked.` : 'There were no active invite links.')
      await loadRoom({ quiet: true })
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Invite links could not be revoked.')
    }
  }

  useEffect(() => {
    let cancelled = false
    async function checkPushStatus() {
      const supported = Boolean(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY)
        && 'Notification' in window
        && 'serviceWorker' in navigator
        && 'PushManager' in window
      if (!supported) return
      if (window.Notification.permission !== 'granted') {
        if (!cancelled) setShowBrowserAlertPrompt(true)
        return
      }
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      if (!cancelled) setShowBrowserAlertPrompt(!subscription)
    }
    void checkPushStatus()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!accessToken || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    let cancelled = false
    async function refreshPushSubscription() {
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      if (!subscription || cancelled) return
      const serialized = subscription.toJSON()
      await fetch('/api/team-rooms/push', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'subscribe', endpoint: subscription.endpoint, keys: serialized.keys }),
      }).catch(() => null)
    }
    void refreshPushSubscription()
    return () => { cancelled = true }
  }, [accessToken])

  useEffect(() => {
    const sentAt = room?.actionQueue.lastReminderAt || ''
    if (!sentAt || !userId || !room?.actionQueue.unresolvedProfileIds.includes(userId)) return
    if (!('Notification' in window) || window.Notification.permission !== 'granted') return
    const storageKey = `tenaceiq-team-reminder:${room.id}:${sentAt}`
    if (window.localStorage.getItem(storageKey)) return
    window.localStorage.setItem(storageKey, 'shown')
    new window.Notification(`${room.teamName} needs your reply`, {
      body: room.actionQueue.matchDate
        ? `Open the ${formatMatchDate(room.actionQueue.matchDate)} match card.`
        : 'Open Team Chat to review the latest match update.',
      icon: '/brand/icons/pwa-192.png',
    })
  }, [room?.actionQueue.lastReminderAt, room?.actionQueue.matchDate, room?.actionQueue.unresolvedProfileIds, room?.id, room?.teamName, userId])

  if (!authResolved || loading) return <TeamRoomLoading />
  if (!accessToken) {
    const next = `/team-room${requestedQuery}`
    return (
      <TeamRoomPortalState>
        <main className={styles.page}>
          <section className={styles.stateCard}>
            <p className={styles.eyebrow}>Team Room</p>
            <h1>Register to access your teams.</h1>
            <p className={styles.helper}>A Free account opens Team Chat, unread messages, availability updates, and announcements for every accepted team connection.</p>
            <div className={styles.roomActions}>
              <Link className={styles.buttonPrimary} href={`/join?next=${encodeURIComponent(next)}`}>Register Free</Link>
              <Link className={styles.buttonSecondary} href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
            </div>
          </section>
        </main>
      </TeamRoomPortalState>
    )
  }

  if (!room) {
    return (
      <TeamRoomPortalState>
        <main className={styles.page}>
          <section className={styles.stateCard}>
            <p className={styles.eyebrow}>Team Room</p>
            <h1>Connect a team first.</h1>
            <p className={styles.helper}>{error || 'Accept or create a team link, then everyone connected to that team can meet here.'}</p>
            <div className={styles.roomActions}>
              <Link className={styles.buttonPrimary} href="/team-connections">Connect team</Link>
              <Link className={styles.buttonSecondary} href="/compete/teams">My Teams</Link>
            </div>
          </section>
        </main>
      </TeamRoomPortalState>
    )
  }

  return (
    <main className={styles.page}>
      <nav className={styles.appBar} aria-label="Team Chat navigation">
        <Link
          className={styles.appBack}
          href="/compete/teams"
          aria-label="Back to My Teams"
        >
          <Image src="/brand/icons/pwa-192.png" alt="" width={32} height={32} />
          <span>My Teams</span>
        </Link>
        <div className={styles.appIdentity}>
          <strong>{room.teamName}</strong>
          <span>{realtimeConnected ? `${Math.max(1, onlineProfileIds.length)} online` : 'Team Chat'}</span>
        </div>
        <button className={styles.appMembersButton} type="button" onClick={() => setShowMembers(true)}>
          Members
        </button>
      </nav>
      <section className={styles.roomShell} aria-label={`${room.teamName} Team Room`}>
        <header className={styles.roomHeader}>
          <div className={styles.headerTop}>
            <div>
              <p className={styles.eyebrow}>Team Room</p>
              <h1>{room.teamName}</h1>
              <p className={styles.scopeLine}>{[room.leagueName, room.flight].filter(Boolean).join(' · ') || 'Linked team conversation'}</p>
            </div>
            <div className={styles.roomActions}>
              {room.canManage ? (
                <button className={styles.buttonPrimary} type="button" onClick={openAvailability}>
                  {hasActiveAvailability ? 'Review availability' : 'Ask availability'}
                </button>
              ) : null}
              <button className={styles.buttonSecondary} type="button" onClick={() => void shareRoom()}>Share room</button>
            </div>
          </div>

          {teams.length > 1 ? (
            <select
              className={styles.teamSelect}
              aria-label="Choose Team Room"
              value={room.href}
              onChange={(event) => router.replace(event.target.value)}
            >
              {teams.map((team) => (
                <option key={team.href} value={team.href}>
                  {team.teamName}{team.isDefault ? ' · Default' : ''}
                </option>
              ))}
            </select>
          ) : null}

          <div className={styles.memberSummary}>
            <button className={styles.memberBadgeButton} type="button" onClick={() => setShowMembers(true)}>
              {room.members.length} connected
            </button>
            <span className={styles.liveBadge}>{realtimeConnected ? 'Live' : 'Syncing'}</span>
            <span className={styles.roleBadge}>{room.roles.join(' + ').replaceAll('_', '-')}</span>
            <button className={styles.buttonQuiet} type="button" onClick={() => void toggleMute()}>
              {room.muted ? 'Turn notifications on' : 'Mute room'}
            </button>
          </div>
          {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
          {error ? <div className={styles.error} role="alert">{error}</div> : null}
        </header>

        {finalLineupDeliveryIntent && room.canManage ? (
          <section className={styles.finalizeLineupGuide} aria-label="Finish final lineup" role="status">
            <p>Finish final lineup</p>
            <strong>{finalLineupDeliveryMatchComplete
              ? 'This match is already complete.'
              : finalLineupDeliverySent ? 'Lineup sent to the team.' : 'Nothing has been sent yet.'}</strong>
            <span>{finalLineupDeliveryMatchComplete
              ? 'A final score is already saved. A pre-match lineup can no longer be sent; open the scorecard to view or print the result.'
              : finalLineupDeliverySent
              ? 'Next, use Share / print confirmed lineup below to send the image or print the scorecard.'
              : 'Step 1: review the pinned lineup and tap Send lineup to team. Step 2: share the image or print the scorecard.'}</span>
            {finalLineupDeliveryMatchComplete ? <Link className={styles.finalizeLineupGuideAction} href={scorecardHref}>Open scorecard</Link> : null}
          </section>
        ) : null}

        {showMatchComposer ? (
          <div className={styles.pinnedArea}>
            <div className={styles.matchComposer}>
              <div className={styles.matchComposerHeader}>
                <strong>{room.nextScheduledMatch ? 'Ready to ask' : 'Next match'}</strong>
                <span>{room.nextScheduledMatch ? 'Match details came from your schedule.' : 'Post one question. Replies stay with this match.'}</span>
              </div>
              {room.nextScheduledMatch ? (
                <div className={styles.matchSummary}>
                  <strong>{formatMatchDate(matchDraft.matchDate)}{matchDraft.opponent ? ` vs ${matchDraft.opponent}` : ''}</strong>
                  <span>{[matchDraft.matchTime, matchDraft.facility].filter(Boolean).join(' · ') || 'Time and courts not set'}</span>
                </div>
              ) : null}
              <details className={styles.matchDetails} open={!room.nextScheduledMatch}>
                <summary>{room.nextScheduledMatch ? 'Edit match details' : 'Add match details'}</summary>
                <div className={styles.matchFields}>
                  <label>Date<input type="date" value={matchDraft.matchDate} onChange={(event) => setMatchDraft((current) => ({ ...current, matchDate: event.target.value }))} /></label>
                  <label>Opponent<input value={matchDraft.opponent} onChange={(event) => setMatchDraft((current) => ({ ...current, opponent: event.target.value }))} placeholder="Opponent" /></label>
                  <label>Time<input value={matchDraft.matchTime} onChange={(event) => setMatchDraft((current) => ({ ...current, matchTime: event.target.value }))} placeholder="Match time" /></label>
                  <label>Location<input value={matchDraft.facility} onChange={(event) => setMatchDraft((current) => ({ ...current, facility: event.target.value }))} placeholder="Courts or facility" /></label>
                </div>
              </details>
              <div className={styles.composerActions}>
                <button className={styles.buttonQuiet} type="button" onClick={() => setShowMatchComposer(false)}>Cancel</button>
                <button className={styles.buttonPrimary} type="button" disabled={sending || !matchDraft.matchDate} onClick={() => void postAvailabilityCard()}>
                  {sending ? 'Posting…' : 'Ask availability'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {finalResultMessage?.card && room.finalResult && finalResultMessage.id !== activeMatchMessage?.id ? (
          <div
            id={`final-result-${finalResultMessage.id}`}
            className={`${styles.pinnedArea} ${focusedFinalResult ? styles.pinnedAreaFocused : ''}`}
            tabIndex={focusedFinalResult ? -1 : undefined}
          >
            <PublishedLineupPin
              messageId={finalResultMessage.id}
              card={finalResultMessage.card}
              receipt={finalResultMessage.card.finalLineup}
              review={null}
              result={room.finalResult}
              canManage={room.canManage}
              phase="post_match"
              scorecardHref={scorecardHref}
              matchupSheetHref={matchupSheetHref}
              playerLinksHref={playerLinksHref}
              lineupHref={finalLineupEditHref}
              markingSeen={false}
              reminding={false}
              completingMatchDay={false}
              currentUserId=""
              currentUserNames={[]}
              savingArrivalStatus=""
              savingManagedArrival=""
              rosterMembers={[]}
              focusedArrivalTextReturn={null}
              focusedCourtLabel=""
              defaultOpen={resultJustUpdated || focusedFinalResult}
              onSeen={() => undefined}
              onRemind={() => undefined}
              onCompleteMatch={() => undefined}
              onArrivalStatus={() => undefined}
              onMessageLatePlayer={() => undefined}
              onMessageWaitingPlayers={() => undefined}
              onShareWaitingPlayers={() => undefined}
              onManageArrivalStatus={() => undefined}
              onTextArrivalPlayer={() => undefined}
              onArrivalTextReturnRestored={() => undefined}
            />
          </div>
        ) : null}

        {activeMatchMessage?.card && (currentFinalLineup || (room.finalResult && room.finalResultCardId === activeMatchMessage.id)) ? (
          <div
            id={room.finalResultCardId === activeMatchMessage.id
              ? `final-result-${activeMatchMessage.id}`
              : `match-plan-${activeMatchMessage.id}`}
            className={`${styles.pinnedArea} ${activeFinalResultFocused ? styles.pinnedAreaFocused : ''}`}
            tabIndex={activeFinalResultFocused ? -1 : undefined}
          >
            <PublishedLineupPin
              messageId={activeMatchMessage.id}
              card={activeMatchMessage.card}
              receipt={currentFinalLineup}
              review={room.finalLineupReview}
              result={room.finalResultCardId === activeMatchMessage.id ? room.finalResult : null}
              canManage={room.canManage}
              phase={currentFinalLineupPhase}
              scorecardHref={scorecardHref}
              matchupSheetHref={matchupSheetHref}
              playerLinksHref={playerLinksHref}
              lineupHref={finalLineupEditHref}
              markingSeen={markingFinalLineupSeen}
              reminding={remindingFinalLineup}
              completingMatchDay={completingMatchDay}
              currentUserId={userId || ''}
              currentUserNames={room.members
                .filter((member) => member.id === userId)
                .flatMap((member) => [member.playerName, member.name])}
              savingArrivalStatus={savingArrivalStatus}
              savingManagedArrival={savingManagedArrival}
              rosterMembers={room.rosterMembers}
              focusedArrivalTextReturn={arrivalTextReturn?.roomId === room.id
                && arrivalTextReturn.messageId === activeMatchMessage.id
                ? arrivalTextReturn
                : null}
              focusedCourtLabel={focusedCourtLabel}
              onSeen={() => currentFinalLineup && void markFinalLineupSeen(currentFinalLineup.announcementMessageId)}
              onRemind={() => currentFinalLineup && void remindFinalLineupUnseen(currentFinalLineup.announcementMessageId)}
              onCompleteMatch={() => currentFinalLineup && void completeMatchDay(currentFinalLineup.announcementMessageId)}
              onArrivalStatus={(status) => void saveArrivalStatus(activeMatchMessage.id, status)}
              onMessageLatePlayer={(playerName, courtLabel) => {
                setMessageBody(`${playerName} — are you still able to make ${courtLabel}? Please share your ETA.`)
                window.requestAnimationFrame(() => {
                  composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  composerRef.current?.focus()
                })
              }}
              onMessageWaitingPlayers={(playerNames) => {
                const visibleNames = playerNames.slice(0, 3).join(', ')
                const remaining = Math.max(0, playerNames.length - 3)
                setMessageBody(`${visibleNames}${remaining ? ` +${remaining} more` : ''} — please update your arrival status for today’s match.`)
                window.requestAnimationFrame(() => {
                  composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  composerRef.current?.focus()
                })
              }}
              onShareWaitingPlayers={(playerNames) => void shareArrivalCheckIn(playerNames, activeMatchMessage.card!)}
              onManageArrivalStatus={(playerName, status) => void saveManagedArrivalStatus(activeMatchMessage.id, playerName, status)}
              onTextArrivalPlayer={(playerName, phone, courtLabel) => textArrivalPlayer(
                activeMatchMessage.id,
                playerName,
                phone,
                courtLabel,
                activeMatchMessage.card!,
              )}
              onArrivalTextReturnRestored={finishArrivalTextReturn}
            />
          </div>
        ) : null}

        {room.canManage
        && pinnedMessage?.card
        && !pinnedMessage.card.finalLineup
        && !pinnedMessage.card.availabilitySummary
        && !(pinnedMessage.card.lineupChangeNotice
          && !pinnedMessage.card.lineupChangeNotice.pending
          && !pinnedMessage.card.lineupChangeNotice.response) ? (
          <div className={styles.pinnedArea}>
            <CaptainActionQueue
              queue={room.actionQueue}
              reminderAt={reminderAt}
              reminding={reminding}
              scheduling={schedulingReminder}
              onReminderAtChange={setReminderAt}
              onRemind={() => void remindWaiting(pinnedMessage.id)}
              onSchedule={() => void scheduleReminder(pinnedMessage.id)}
            />
          </div>
        ) : null}

        {pinnedLevelUpChallenge?.levelUpChallenge ? (
          <div className={styles.pinnedArea}>
            <LevelUpChallengeCard
              message={pinnedLevelUpChallenge}
              pinned
              canManage={room.canManage}
              completing={completingChallengeId === pinnedLevelUpChallenge.id}
              reminding={remindingChallengeId === pinnedLevelUpChallenge.id}
              closing={closingChallengeId === pinnedLevelUpChallenge.id}
              onComplete={() => void completeLevelUpChallenge(pinnedLevelUpChallenge.id)}
              onRemind={() => void remindLevelUpChallenge(pinnedLevelUpChallenge.id)}
              onClose={() => void closeLevelUpChallenge(pinnedLevelUpChallenge.id)}
            />
          </div>
        ) : null}

        {pinnedMessage?.card && !pinnedMessage.card.finalLineup ? (
          <div className={styles.pinnedArea}>
            <MatchCard
              message={pinnedMessage}
              memberCount={room.members.length}
              canManage={room.canManage}
              teamName={room.teamName}
              leagueName={room.leagueName}
              flight={room.flight}
              focused={pinnedMessage.id === focusedMessageId}
              focusedPlayerName={focusedPlayerName}
              focusedCourtLabel={focusedCourtLabel}
              focusedReplyStatus={focusedReplyStatus}
              responding={respondingId === pinnedMessage.id}
              acknowledging={acknowledgingId === pinnedMessage.id}
              notifyingLineupChange={notifyingLineupChangeId === pinnedMessage.id}
              sendingFinalLineup={sendingFinalLineupId === pinnedMessage.id}
              respondingLineupChange={respondingLineupChangeId === pinnedMessage.id}
              schedulingLineupChangeDeadline={schedulingLineupChangeDeadlineId === pinnedMessage.id}
              lineupChangeDeadlineDate={lineupChangeDeadlineDate}
              currentPlayerNames={room.members
                .filter((member) => member.id === userId)
                .flatMap((member) => [member.playerName, member.name])}
              onRespond={(response) => void respondToMatch(pinnedMessage.id, response)}
              onAcknowledge={() => void acknowledgeLineup(pinnedMessage.id)}
              onNotifyLineupChange={() => void notifyLineupChange(pinnedMessage.id)}
              onSendFinalLineup={(lineupId) => void sendFinalLineup(pinnedMessage.id, lineupId)}
              onRespondLineupChange={(response) => void respondToLineupChange(pinnedMessage.id, response)}
              onLineupChangeDeadlineDate={setLineupChangeDeadlineDate}
              onScheduleLineupChangeDeadline={() => void scheduleLineupChangeDeadline(pinnedMessage.id)}
              onAskCaptain={() => {
                setMessageBody(`Question about ${formatMatchDate(pinnedMessage.card?.matchDate || '')}${pinnedMessage.card?.opponent ? ` vs ${pinnedMessage.card.opponent}` : ''}: `)
                window.requestAnimationFrame(() => composerRef.current?.focus())
              }}
            />
          </div>
        ) : null}

        <div ref={messagesRef} className={styles.messages} aria-live="polite">
          {!room.messages.length ? (
            <div className={styles.emptyMessages}>
              Start the team conversation. Match reminders, availability questions, projected lineups, and team updates stay here for everyone to find.
            </div>
          ) : null}
          {room.messages.map((message) => {
            if (message.id === pinnedMessage?.id) return null
            if (message.id === pinnedLevelUpChallenge?.id) return null
            if (message.levelUpChallenge) {
              return (
                <LevelUpChallengeCard
                  key={message.id}
                  message={message}
                  canManage={false}
                  completing={completingChallengeId === message.id}
                  reminding={false}
                  closing={false}
                  onComplete={() => void completeLevelUpChallenge(message.id)}
                  onRemind={() => undefined}
                  onClose={() => undefined}
                />
              )
            }
            const isSystem = message.kind === 'system'
            if (isSystem) return <div key={message.id} className={styles.systemBubble}>{message.body}</div>
            if (message.card?.state === 'archived') return <MatchRecap key={message.id} message={message} />
            if (message.card?.state === 'upcoming') return <UpcomingMatchCard key={message.id} message={message} />
            const lineupStatus = message.lineupAnnouncement
              ? getTeamRoomLineupAnnouncementStatus({
                  announcementMessageId: message.id,
                  sourceMessageId: message.lineupAnnouncement.sourceMessageId,
                  currentReceipt: currentFinalLineup,
                  activeSourceMessageId: activeMatchMessage?.id || '',
                  pendingAnnouncementMessageId: pendingFinalLineupAnnouncementId,
                })
              : null
            const rowClass = [
              styles.messageRow,
              message.isMine ? styles.messageMine : '',
              message.kind === 'announcement' ? styles.messageAnnouncement : '',
              lineupStatus === 'superseded' || lineupStatus === 'past' ? styles.lineupAnnouncementOld : '',
            ].filter(Boolean).join(' ')
            return (
              <article key={message.id} className={rowClass}>
                <div className={styles.messageMeta}>
                  <span>{message.isMine ? 'You' : message.senderName}</span>
                  <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                  {message.editedAt && !message.deletedAt ? <span>Edited</span> : null}
                  {message.kind === 'announcement' ? <span className={styles.announcementBadge}>Announcement</span> : null}
                  {lineupStatus ? (
                    <span className={styles.lineupStatusBadge} data-status={lineupStatus}>
                      {lineupStatus === 'current'
                        ? 'Current lineup'
                        : lineupStatus === 'pending' ? 'Awaiting confirmation' : lineupStatus === 'superseded' ? 'Superseded' : 'Past lineup'}
                    </span>
                  ) : null}
                </div>
                {message.replyTo ? (
                  <div className={styles.replyPreview}>
                    <strong>{message.replyTo.senderName}</strong>
                    <span>{message.replyTo.body}</span>
                  </div>
                ) : null}
                {editingId === message.id ? (
                  <div className={styles.editComposer}>
                    <textarea aria-label="Edit message" value={editBody} onChange={(event) => setEditBody(event.target.value)} />
                    <div className={styles.composerActions}>
                      <button className={styles.buttonQuiet} type="button" onClick={() => { setEditingId(''); setEditBody('') }}>Cancel</button>
                      <button className={styles.buttonPrimary} type="button" disabled={!editBody.trim()} onClick={() => void saveEditedMessage(message.id)}>Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={`${styles.bubble} ${message.deletedAt ? styles.bubbleDeleted : ''}`}>{message.body}</div>
                    {message.attachment?.url ? (
                      <a className={styles.attachmentCard} href={message.attachment.url} target="_blank" rel="noreferrer">
                        {message.attachment.mimeType.startsWith('image/') ? (
                          <span className={styles.attachmentImage}>
                            <Image src={message.attachment.url} alt={message.attachment.name} fill sizes="(max-width: 700px) 82vw, 520px" />
                          </span>
                        ) : null}
                        <span>
                          <strong>{message.attachment.name}</strong>
                          <small>{formatFileSize(message.attachment.size)} · Open file</small>
                        </span>
                      </a>
                    ) : null}
                  </>
                )}
                {!message.deletedAt && editingId !== message.id ? (
                  <div className={styles.messageActions} aria-label={`Actions for ${message.senderName}'s message`}>
                    <button type="button" onClick={() => { setReplyTo(message); window.requestAnimationFrame(() => composerRef.current?.focus()) }}>Reply</button>
                    <details className={styles.messageMoreActions}>
                      <summary>More</summary>
                      <div className={styles.messageMoreMenu}>
                        {message.reactions.map((reaction) => (
                          <button
                            key={reaction.reaction}
                            className={reaction.reacted ? styles.reactionActive : undefined}
                            type="button"
                            onClick={() => void toggleReaction(message.id, reaction.reaction)}
                          >
                            {reactionLabel(reaction.reaction)}{reaction.count ? ` ${reaction.count}` : ''}
                          </button>
                        ))}
                        {message.isMine && !message.lineupAnnouncement ? <button type="button" onClick={() => { setEditingId(message.id); setEditBody(message.body) }}>Edit</button> : null}
                        {(message.isMine || room.canManage) && !message.lineupAnnouncement ? <button type="button" onClick={() => void deleteMessage(message.id)}>Remove</button> : null}
                      </div>
                    </details>
                  </div>
                ) : null}
              </article>
            )
          })}
          <div ref={endRef} />
        </div>

        <div className={styles.composer} aria-label="Team Chat message composer">
          <div className={styles.composerHeading}>
            <strong>Team Chat</strong>
            <span>Reply to the team</span>
          </div>
          <div className={styles.quickActions} aria-label="Quick team messages">
            {room.canManage ? (
              <button className={styles.quickButtonPrimary} type="button" onClick={openAvailability}>
                {hasActiveAvailability ? 'Review availability' : 'Ask availability'}
              </button>
            ) : null}
            <details className={styles.quickMessageTemplates}>
              <summary className={styles.quickMessageTemplatesSummary}>
                Quick notes
              </summary>
              <div className={styles.quickMessageTemplatesBody}>
                {QUICK_MESSAGES.map((quick) => (
                  <button
                    key={quick.label}
                    className={styles.quickButton}
                    type="button"
                    onClick={(event) => {
                      setMessageBody(quick.body)
                      event.currentTarget.closest('details')?.removeAttribute('open')
                      window.requestAnimationFrame(() => composerRef.current?.focus())
                    }}
                  >
                    {quick.label}
                  </button>
                ))}
              </div>
            </details>
          </div>
          {replyTo ? (
            <div className={styles.composerContext}>
              <span><strong>Replying to {replyTo.senderName}</strong>{replyTo.body.slice(0, 100)}</span>
              <button type="button" onClick={() => setReplyTo(null)}>Cancel</button>
            </div>
          ) : null}
          {selectedFile ? (
            <div className={styles.composerContext}>
              <span><strong>{selectedFile.name}</strong>{formatFileSize(selectedFile.size)}</span>
              <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>Remove</button>
            </div>
          ) : null}
          <textarea
            ref={composerRef}
            aria-label="Team Room message"
            placeholder="Message the team…"
            value={messageBody}
            onChange={(event) => setMessageBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void sendMessage()
              }
            }}
          />
          <div className={styles.composerActions}>
            <div className={styles.composerOptions}>
              <input
                ref={fileInputRef}
                className={styles.fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              />
              <button className={styles.buttonSecondary} type="button" onClick={() => fileInputRef.current?.click()}>Add file</button>
              {room.canManage ? (
                <label className={styles.announcementToggle}>
                  <input type="checkbox" checked={announcement} onChange={(event) => setAnnouncement(event.target.checked)} />
                  Announcement
                </label>
              ) : null}
            </div>
            <button className={styles.buttonPrimary} type="button" disabled={sending || (!messageBody.trim() && !selectedFile)} onClick={() => void sendMessage()}>
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </section>

      {showMembers ? (
        <TeamRoomMemberDrawer
          room={room}
          currentUserId={userId || ''}
          onlineProfileIds={onlineProfileIds}
          sharing={sharing}
          onClose={() => setShowMembers(false)}
          onInvite={() => void inviteTeam()}
          onRevokeInvites={() => void revokeInvites()}
          onRemove={(member) => void removeMember(member)}
          onRestore={(member) => void restoreMember(member)}
        />
      ) : null}

      <TeamRoomInstallCard room={room} />
      {showBrowserAlertPrompt ? (
        <button className={styles.browserAlertButton} type="button" onClick={() => void enableBrowserAlerts()}>
          Turn on background alerts
        </button>
      ) : null}
    </main>
  )
}

function PublishedLineupPin({
  messageId,
  card,
  receipt,
  review,
  result,
  canManage,
  phase,
  scorecardHref,
  matchupSheetHref,
  playerLinksHref,
  lineupHref,
  markingSeen,
  reminding,
  completingMatchDay,
  currentUserId,
  currentUserNames,
  savingArrivalStatus,
  savingManagedArrival,
  rosterMembers,
  focusedArrivalTextReturn,
  focusedCourtLabel,
  defaultOpen,
  onSeen,
  onRemind,
  onCompleteMatch,
  onArrivalStatus,
  onMessageLatePlayer,
  onMessageWaitingPlayers,
  onShareWaitingPlayers,
  onManageArrivalStatus,
  onTextArrivalPlayer,
  onArrivalTextReturnRestored,
}: {
  messageId: string
  card: TeamRoomMatchCard
  receipt: TeamRoomFinalLineupReceipt | null
  review: TeamRoomFinalLineupReview | null
  result: TeamRoomFinalResult | null
  canManage: boolean
  phase: TeamRoomMatchDayPhase
  scorecardHref: string
  matchupSheetHref: string
  playerLinksHref: string
  lineupHref: string
  markingSeen: boolean
  reminding: boolean
  completingMatchDay: boolean
  currentUserId: string
  currentUserNames: string[]
  savingArrivalStatus: TeamRoomArrivalStatus | ''
  savingManagedArrival: string
  rosterMembers: TeamRoomRosterMember[]
  focusedArrivalTextReturn: TeamRoomArrivalTextReturn | null
  focusedCourtLabel: string
  defaultOpen?: boolean
  onSeen: () => void
  onRemind: () => void
  onCompleteMatch: () => void
  onArrivalStatus: (status: TeamRoomArrivalStatus) => void
  onMessageLatePlayer: (playerName: string, courtLabel: string) => void
  onMessageWaitingPlayers: (playerNames: string[]) => void
  onShareWaitingPlayers: (playerNames: string[]) => void
  onManageArrivalStatus: (playerName: string, status: TeamRoomManagedArrivalStatus) => void
  onTextArrivalPlayer: (playerName: string, phone: string, courtLabel: string) => void
  onArrivalTextReturnRestored: (playerName: string) => void
}) {
  const [editingArrivalPlayer, setEditingArrivalPlayer] = useState('')
  const arrivalCourtDetailsRef = useRef<HTMLDetailsElement>(null)
  const matchLabel = [
    card.matchDate ? formatMatchDate(card.matchDate) : 'Match',
    card.opponent ? `vs ${card.opponent}` : '',
  ].filter(Boolean).join(' ')
  const mapsHref = buildTeamRoomMapsHref(card.facility)
  const calendarHref = buildMatchWeekGoogleCalendarHref({
    eventDate: card.matchDate,
    eventTime: card.matchTime,
    opponent: card.opponent,
    location: card.facility,
    details: 'Team match from TenAceIQ Team Chat.',
  })
  const isMatchDay = phase === 'match_day'
  const isPostMatch = phase === 'post_match'
  const scoreLabel = result?.teamScore && result.opponentScore
    ? `${result.teamScore}–${result.opponentScore}`
    : result?.score || 'Final'
  const outcomeLabel = result?.outcome === 'win' ? 'Won' : result?.outcome === 'loss' ? 'Lost' : 'Final'
  const resultSummary = scoreLabel === 'Final' ? outcomeLabel : `${outcomeLabel} ${scoreLabel}`
  const resultLines = result?.lines ?? []
  const assignedCourt = findTeamRoomAssignedCourt(card.lineup, currentUserNames)
  const currentArrival = card.arrivalCheckIns.find((item) => item.profileId === currentUserId) || null
  const arrivalCourts = buildTeamRoomArrivalCourts(card.lineup, card.arrivalCheckIns)
  const arrivalPlayers = arrivalCourts.flatMap((court) => court.players)
  const hereCount = arrivalPlayers.filter((player) => player.status === 'here').length
  const onWayCount = arrivalPlayers.filter((player) => player.status === 'on_my_way').length
  const arrivalPriority = buildTeamRoomArrivalPriority(arrivalCourts, focusedCourtLabel, card.arrivalOutreach)
  const lateArrival = arrivalPriority.kind === 'late'
    ? { courtLabel: arrivalPriority.courtLabel, playerName: arrivalPriority.playerName }
    : null
  const followUpContact = arrivalPriority.kind === 'follow_up'
    ? findTeamRoomArrivalContact(arrivalPriority.playerName, rosterMembers)
    : null
  const backupHref = lateArrival ? buildTeamRoomLateArrivalBuilderHref(lineupHref, lateArrival) : ''
  const focusedLineupHref = lateArrival ? buildTeamRoomLineupCourtHref(lineupHref, lateArrival.courtLabel) : lineupHref
  const shareScorecardHref = receipt
    ? `${matchupSheetHref}${matchupSheetHref.includes('?') ? '&' : '?'}confirmed=1`
    : matchupSheetHref
  function openArrivalPlayer(playerName: string, courtLabel: string) {
    setEditingArrivalPlayer(`${courtLabel}:${playerName}`)
    if (arrivalCourtDetailsRef.current) arrivalCourtDetailsRef.current.open = true
    window.requestAnimationFrame(() => {
      const player = document.getElementById(buildArrivalPlayerDomId(messageId, courtLabel, playerName))
      player?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      player?.focus({ preventScroll: true })
    })
  }
  useEffect(() => {
    if (!focusedArrivalTextReturn || focusedArrivalTextReturn.messageId !== messageId) return
    const playerKey = `${focusedArrivalTextReturn.courtLabel}:${focusedArrivalTextReturn.playerName}`
    const frame = window.requestAnimationFrame(() => {
      setEditingArrivalPlayer(playerKey)
      if (arrivalCourtDetailsRef.current) arrivalCourtDetailsRef.current.open = true
      const player = document.getElementById(buildArrivalPlayerDomId(
        messageId,
        focusedArrivalTextReturn.courtLabel,
        focusedArrivalTextReturn.playerName,
      ))
      player?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      player?.focus({ preventScroll: true })
      onArrivalTextReturnRestored(focusedArrivalTextReturn.playerName)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusedArrivalTextReturn, messageId, onArrivalTextReturnRestored])
  return (
    <details className={styles.publishedLineupPin} open={defaultOpen ?? Boolean(result || receipt)}>
      <summary>
        <div>
          <span>{result ? 'Final result' : isPostMatch ? 'After match' : isMatchDay ? 'Match day' : 'Match plan'}</span>
          <strong>{matchLabel}</strong>
          <small>
            {result
              ? `${resultSummary} · Scorecard linked`
              : isPostMatch
              ? canManage ? 'Add the scorecard to close the loop' : 'Result is next'
              : isMatchDay
                ? `Arrive ${card.matchTime || 'time TBD'} · ${mapsHref ? 'Maps ready' : 'Location TBD'}`
                : <>
                    {card.lineup.length} court{card.lineup.length === 1 ? '' : 's'}
                    {review?.requiredCount ? ` · ${review.seenCount}/${review.requiredCount} seen` : ''}
                    {' · Sent to team'}
                  </>}
          </small>
        </div>
        <em>{result ? outcomeLabel : isPostMatch ? 'Scores' : isMatchDay ? 'Today' : 'Sent'}</em>
      </summary>
      {result ? (
        <div className={styles.matchResultBody}>
          <div className={styles.matchResultScore}>
            <div>
              <strong>{result.teamScore || '—'}</strong>
              <span>{result.teamName}</span>
            </div>
            <em>Final</em>
            <div>
              <strong>{result.opponentScore || '—'}</strong>
              <span>{result.opponentName || card.opponent || 'Opponent'}</span>
            </div>
          </div>
          {result.unresolvedPlayerCount ? (
            <div className={styles.matchResultDataGap}>
              <span>{result.unresolvedPlayerCount} player name{result.unresolvedPlayerCount === 1 ? '' : 's'} need linking.</span>
              <Link href={playerLinksHref}>Fix names</Link>
            </div>
          ) : null}
          {resultLines.length ? (
            <details className={styles.matchResultLines}>
              <summary>
                <span>Court results</span>
                <em>{resultLines.length}</em>
              </summary>
              <div className={styles.matchResultLineList}>
                {resultLines.map((line) => (
                  <article className={styles.matchResultLine} key={line.id}>
                    <div className={styles.matchResultLineHeading}>
                      <strong>{line.label}</strong>
                      <span data-outcome={line.winner}>
                        {line.winner === 'team' ? 'Won' : line.winner === 'opponent' ? 'Lost' : 'Final'}
                      </span>
                    </div>
                    <p>{formatResultPlayers(line.teamPlayers, line.teamMissingPlayerCount)}</p>
                    <small>vs {formatResultPlayers(line.opponentPlayers, line.opponentMissingPlayerCount)}</small>
                    <em>{line.score || 'Final'}</em>
                  </article>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : (
        <div className={styles.matchDayLogistics}>
          <div>
            <span>Arrive</span>
            <strong>{card.matchTime || 'Time TBD'}</strong>
          </div>
          <div>
            <span>Location</span>
            <strong>{card.facility || 'Location TBD'}</strong>
          </div>
        </div>
      )}
      {!result ? (
        <div className={styles.matchDayActions}>
          {canManage ? (
            <Link className={styles.buttonSecondary} href={shareScorecardHref}>{receipt ? 'Share / print confirmed lineup' : 'Print scorecard'}</Link>
          ) : null}
          {isPostMatch && canManage ? (
            <Link className={styles.buttonPrimary} href={scorecardHref}>Add scorecard</Link>
          ) : null}
          {mapsHref || calendarHref ? (
            <div className={styles.matchDayTravelActions} aria-label="Match travel actions">
              {mapsHref ? <a className={styles.buttonSecondary} href={mapsHref} target="_blank" rel="noreferrer">Open maps</a> : null}
              {calendarHref ? <a className={styles.buttonSecondary} href={calendarHref} target="_blank" rel="noreferrer">Add to calendar</a> : null}
            </div>
          ) : null}
          {canManage && !isPostMatch ? (
            <Link className={styles.buttonSecondary} href={lineupHref}>Update lineup</Link>
          ) : null}
          {isMatchDay && canManage ? (
            <button className={styles.buttonSecondary} type="button" disabled={completingMatchDay} onClick={onCompleteMatch}>
              {completingMatchDay ? 'Closing…' : 'Match complete'}
            </button>
          ) : null}
        </div>
      ) : null}
      {!result && isMatchDay ? (
        <section
          id={`team-room-arrival-${messageId}`}
          className={styles.arrivalBoard}
          aria-label="Team arrival status"
          tabIndex={-1}
        >
          {canManage && lateArrival ? (
            <div className={styles.lateArrivalActions} role="alert">
              <div>
                <strong>{lateArrival.playerName} is running late</strong>
                <span>{lateArrival.courtLabel} needs the next call.</span>
              </div>
              <div>
                <button className={styles.buttonPrimary} type="button" onClick={() => onMessageLatePlayer(lateArrival.playerName, lateArrival.courtLabel)}>
                  Message player
                </button>
                <Link className={styles.buttonSecondary} href={backupHref}>Prepare backup</Link>
                <Link className={styles.buttonSecondary} href={focusedLineupHref}>Update lineup</Link>
              </div>
            </div>
          ) : (
            <div className={styles.arrivalPriority} data-status={arrivalPriority.kind} aria-live="polite">
              <div>
                <span>{arrivalPriority.kind === 'follow_up' ? 'Needs follow-up' : arrivalPriority.kind === 'waiting' ? 'Next' : 'Arrival'}</span>
                <strong>{arrivalPriority.title}</strong>
                <small>{arrivalPriority.detail}</small>
              </div>
              {canManage && arrivalPriority.kind === 'follow_up' ? (
                <div className={styles.arrivalPriorityActions}>
                  {followUpContact?.phone && followUpContact.joined === false ? (
                    <button
                      className={styles.buttonPrimary}
                      type="button"
                      onClick={() => onTextArrivalPlayer(
                        arrivalPriority.playerName,
                        followUpContact.phone,
                        arrivalPriority.courtLabel,
                      )}
                    >
                      Text again
                    </button>
                  ) : null}
                  <button
                    className={styles.buttonSecondary}
                    type="button"
                    onClick={() => openArrivalPlayer(arrivalPriority.playerName, arrivalPriority.courtLabel)}
                  >
                    Open player
                  </button>
                </div>
              ) : canManage && arrivalPriority.kind === 'waiting' ? (
                <div className={styles.arrivalPriorityActions}>
                  <button className={styles.buttonPrimary} type="button" onClick={() => onMessageWaitingPlayers(arrivalPriority.names)}>
                    Team Chat
                  </button>
                  <button className={styles.buttonSecondary} type="button" onClick={() => onShareWaitingPlayers(arrivalPriority.names)}>
                    Share text
                  </button>
                </div>
              ) : <em>{hereCount}/{arrivalPlayers.length}</em>}
            </div>
          )}
          {assignedCourt ? (
            <div className={styles.arrivalCheckIn}>
              <span>Your status · {assignedCourt.courtLabel}</span>
              <div role="group" aria-label="Set your arrival status">
                {([
                  ['on_my_way', 'On my way'],
                  ['here', 'Here'],
                  ['running_late', 'Running late'],
                ] as const).map(([status, label]) => (
                  <button
                    key={status}
                    type="button"
                    data-status={status}
                    aria-pressed={currentArrival?.status === status}
                    disabled={Boolean(savingArrivalStatus)}
                    onClick={() => onArrivalStatus(status)}
                  >
                    {savingArrivalStatus === status ? 'Saving…' : label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <details className={styles.arrivalCourtDetails} ref={arrivalCourtDetailsRef}>
            <summary>
              <span>Court arrivals</span>
              <em>{hereCount} here · {onWayCount} on my way</em>
            </summary>
            <div className={styles.arrivalCourtGrid}>
              {arrivalCourts.map((court) => (
                <article
                  key={court.label}
                  className={`${styles.arrivalCourt} ${lateArrival?.courtLabel === court.label ? styles.arrivalCourtFocused : ''}`}
                >
                  <strong>{court.label}</strong>
                  {court.players.map((player) => {
                    const playerKey = `${court.label}:${player.name}`
                    const isEditing = editingArrivalPlayer === playerKey
                    const rosterContact = findTeamRoomArrivalContact(player.name, rosterMembers)
                    const arrivalOutreach = findTeamRoomArrivalOutreach(player.name, card.arrivalOutreach)
                    const canTextDirectly = canManage
                      && player.status === null
                      && Boolean(rosterContact?.phone)
                      && rosterContact?.joined === false
                    return (
                      <div
                        id={buildArrivalPlayerDomId(messageId, court.label, player.name)}
                        className={styles.arrivalPlayerRow}
                        key={player.name}
                        tabIndex={-1}
                      >
                        <span className={styles.arrivalPlayerIdentity}>
                          <strong>{player.name}</strong>
                          {player.updatedAt ? (
                            <small>
                              {player.setByCaptain ? 'Captain marked' : 'Player updated'} &middot; {formatArrivalUpdateAge(player.updatedAt)}
                            </small>
                          ) : arrivalOutreach ? (
                            <small>Text opened &middot; {formatArrivalUpdateAge(arrivalOutreach.contactedAt)}</small>
                          ) : null}
                        </span>
                        {canManage ? (
                          <span className={styles.arrivalPlayerControls}>
                            {canTextDirectly && rosterContact ? (
                              <button
                                className={styles.arrivalTextButton}
                                type="button"
                                onClick={() => {
                                  openArrivalPlayer(player.name, court.label)
                                  onTextArrivalPlayer(player.name, rosterContact.phone, court.label)
                                }}
                              >
                                {arrivalOutreach ? 'Text again' : 'Text'}
                              </button>
                            ) : null}
                            <button
                              className={styles.arrivalStatusControl}
                              type="button"
                              data-status={player.status || 'waiting'}
                              aria-expanded={isEditing}
                              title={player.setByCaptain ? 'Last updated by a captain' : undefined}
                              onClick={() => setEditingArrivalPlayer(isEditing ? '' : playerKey)}
                            >
                              {teamRoomArrivalStatusLabel(player.status)}
                            </button>
                          </span>
                        ) : (
                          <em data-status={player.status || 'waiting'}>{teamRoomArrivalStatusLabel(player.status)}</em>
                        )}
                        {canManage && isEditing ? (
                          <div className={styles.arrivalManagerActions} role="group" aria-label={`Update ${player.name}'s arrival`}>
                            {([['here', 'Here'], ['on_my_way', 'On the way'], ['waiting', 'Waiting']] as const).map(([status, label]) => (
                              <button
                                key={status}
                                type="button"
                                aria-pressed={status === 'waiting' ? player.status === null : player.status === status}
                                disabled={Boolean(savingManagedArrival)}
                                onClick={() => {
                                  onManageArrivalStatus(player.name, status)
                                  setEditingArrivalPlayer('')
                                }}
                              >
                                {savingManagedArrival === `${player.name}:${status}` ? 'Saving…' : label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </article>
              ))}
            </div>
          </details>
        </section>
      ) : !result ? (
        <div className={styles.publishedLineupRows}>
          {card.lineup.map((court, index) => (
            <div key={`${court.label}-${index}`}>
              <span>{court.label || `Court ${index + 1}`}</span>
              <strong>{court.players.join(' / ') || 'Open'}</strong>
            </div>
          ))}
        </div>
      ) : null}
      {phase === 'upcoming' && receipt ? <div className={styles.publishedLineupReview}>
        <div>
          <strong>
            {review?.requiredCount && review.seenCount >= review.requiredCount
              ? 'Everyone has seen it.'
              : review?.requiredCount
                ? `${review.seenCount} of ${review.requiredCount} seen`
                : 'Final lineup is ready'}
          </strong>
          {canManage && review?.unseenNames.length ? (
            <span>Waiting on {review.unseenNames.join(', ')}</span>
          ) : null}
        </div>
        <div className={styles.publishedLineupActions}>
          {review?.currentUserRequired ? (
            review.currentUserSeen ? (
              <span className={styles.publishedLineupSeen}>Seen</span>
            ) : (
              <button className={styles.buttonPrimary} type="button" disabled={markingSeen} onClick={onSeen}>
                {markingSeen ? 'Saving…' : 'Mark seen'}
              </button>
            )
          ) : null}
          {canManage && Boolean(review?.unseenNames.length) ? (
            review?.reminderSentAt ? (
              <span className={styles.publishedLineupSeen}>Reminder sent</span>
            ) : (
              <button className={styles.buttonSecondary} type="button" disabled={reminding} onClick={onRemind}>
                {reminding ? 'Sending…' : `Remind ${review?.unseenNames.length || ''}`}
              </button>
            )
          ) : null}
        </div>
      </div> : null}
      {phase === 'upcoming' && receipt ? (
        <p>Published by {receipt.sentByName || 'Team captain'} · {formatMessageTime(receipt.sentAt)}</p>
      ) : null}
    </details>
  )
}

function formatResultPlayers(names: string[], missingCount: number) {
  const labels = names.map((name) => name.trim()).filter(Boolean)
  if (missingCount > 0) {
    labels.push(`${missingCount} name${missingCount === 1 ? '' : 's'} need linking`)
  }
  return labels.join(' / ') || 'Player name needs linking'
}

function LevelUpChallengeCard({
  message,
  pinned = false,
  canManage,
  completing,
  reminding,
  closing,
  onComplete,
  onRemind,
  onClose,
}: {
  message: TeamRoomMessage
  pinned?: boolean
  canManage: boolean
  completing: boolean
  reminding: boolean
  closing: boolean
  onComplete: () => void
  onRemind: () => void
  onClose: () => void
}) {
  const challenge = message.levelUpChallenge
  if (!challenge) return null
  const cards = getCaptainLevelUpCardDetails(challenge)
  const isScheduled = challenge.status === 'scheduled'
  const isCancelledSchedule = challenge.status === 'cancelled'
  const isClosed = challenge.status === 'closed'
  const isInactiveChallenge = isScheduled || isCancelledSchedule || isClosed
  const completedCardIds = new Set(challenge.completedCardIds)
  const completedCardCount = completedCardIds.size
  const progressPercent = cards.length ? Math.round((completedCardCount / cards.length) * 100) : 0
  const nextCard = cards.find((card) => !completedCardIds.has(card.id)) || cards[0]

  return (
    <article className={styles.levelUpChallengeCard}>
      <div className={styles.matchCardTop}>
        <div>
          <p className={styles.matchCardEyebrow}>
            {isScheduled
              ? 'Scheduled team challenge'
              : isCancelledSchedule
                ? 'Removed team challenge'
                : isClosed ? 'Ended team challenge' : pinned ? 'Active team challenge' : 'Team Level Up challenge'}
          </p>
          <h2>{challenge.title}</h2>
        </div>
        <span className={styles.pinnedBadge}>
          {isInactiveChallenge
            ? isCancelledSchedule ? 'Removed' : isClosed ? 'Ended' : formatMatchDate(challenge.scheduledForDate)
            : challenge.connectedCount
              ? `${challenge.completedCount} of ${challenge.connectedCount} complete`
              : `${challenge.completedCount} marked complete`}
        </span>
      </div>
      <p>{challenge.focus}</p>
      {!isInactiveChallenge ? (
        <div className={styles.levelUpPersonalProgress}>
          <div>
            <strong>Your progress</strong>
            <span>{completedCardCount} of {cards.length} cards</span>
          </div>
          <div
            className={styles.levelUpProgressTrack}
            role="progressbar"
            aria-label="Your team challenge progress"
            aria-valuemin={0}
            aria-valuemax={cards.length}
            aria-valuenow={completedCardCount}
          >
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      ) : null}
      {isInactiveChallenge ? (
        <small className={styles.helper}>
          {isCancelledSchedule
            ? 'This challenge was removed before it started.'
            : isClosed
              ? 'This challenge has ended.'
              : 'The captain will start this challenge when match-week preparation begins.'}
        </small>
      ) : pinned ? (
        <details className={styles.levelUpChallengeDetails}>
          <summary>View {cards.length} challenge cards</summary>
          <LevelUpChallengeSteps cards={cards} completedCardIds={completedCardIds} />
        </details>
      ) : <LevelUpChallengeSteps cards={cards} completedCardIds={completedCardIds} />}
      {!isInactiveChallenge ? <div className={styles.levelUpChallengeActions}>
        <Link className={styles.buttonPrimary} href={buildCaptainLevelUpCardHref(nextCard?.id || challenge.cardIds[0])}>
          {challenge.completed ? 'Review challenge' : completedCardCount ? 'Continue challenge' : 'Start challenge'}
        </Link>
        <button
          className={styles.buttonSecondary}
          type="button"
          disabled={challenge.completed || completing}
          onClick={onComplete}
        >
          {completing ? 'Saving…' : challenge.completed ? 'Challenge complete' : 'Mark challenge complete'}
        </button>
        {pinned && canManage ? (
          <>
            <button
              className={styles.buttonSecondary}
              type="button"
              disabled={reminding || closing}
              onClick={onRemind}
            >
              {reminding ? 'Sending…' : 'Remind incomplete'}
            </button>
            <button
              className={styles.buttonQuiet}
              type="button"
              disabled={reminding || closing}
              onClick={onClose}
            >
              {closing ? 'Ending…' : 'End challenge'}
            </button>
          </>
        ) : null}
      </div> : null}
      {!isInactiveChallenge ? (
        <small className={styles.helper}>Only the team completion count is shared. Your proof, scores, and notes stay private.</small>
      ) : null}
    </article>
  )
}

function LevelUpChallengeSteps({ cards, completedCardIds }: {
  cards: Array<{ id: string; title: string }>
  completedCardIds: Set<string>
}) {
  return (
    <div className={styles.levelUpChallengeSteps}>
      {cards.map((card, index) => (
        <Link key={card.id} href={buildCaptainLevelUpCardHref(card.id)}>
          <span>{index + 1}</span>
          <strong>{card.title}</strong>
          <small>{completedCardIds.has(card.id) ? 'Done' : 'Open'}</small>
        </Link>
      ))}
    </div>
  )
}

function TeamRoomMemberDrawer({
  room,
  currentUserId,
  onlineProfileIds,
  sharing,
  onClose,
  onInvite,
  onRevokeInvites,
  onRemove,
  onRestore,
}: {
  room: TeamRoom
  currentUserId: string
  onlineProfileIds: string[]
  sharing: boolean
  onClose: () => void
  onInvite: () => void
  onRevokeInvites: () => void
  onRemove: (member: TeamRoomMember) => void
  onRestore: (member: { id: string; name: string }) => void
}) {
  const onlineIds = new Set(onlineProfileIds)
  const waitingRoster = room.rosterMembers.filter((member) => !member.joined)
  return (
    <div className={styles.drawerBackdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <aside className={styles.memberDrawer} role="dialog" aria-modal="true" aria-label={`${room.teamName} members`}>
        <div className={styles.drawerHeader}>
          <div>
            <p className={styles.eyebrow}>Team members</p>
            <h2>{room.members.length} connected</h2>
          </div>
          <button className={styles.buttonSecondary} type="button" onClick={onClose}>Close</button>
        </div>

        <div className={styles.memberList}>
          {room.members.map((member) => (
            <article key={member.id} className={styles.memberRow}>
              <span className={`${styles.presenceDot} ${onlineIds.has(member.id) ? styles.presenceOnline : ''}`} aria-label={onlineIds.has(member.id) ? 'Online' : 'Offline'} />
              <div>
                <strong>{member.name}{member.id === currentUserId ? ' · You' : ''}</strong>
                <span>{member.roles.join(' + ').replaceAll('_', '-')}</span>
              </div>
              {room.canManage && member.id !== currentUserId && !member.roles.some((role) => ['captain', 'co_captain', 'co-captain'].includes(role)) ? (
                <button className={styles.buttonQuiet} type="button" onClick={() => onRemove(member)}>Remove</button>
              ) : null}
            </article>
          ))}
        </div>

        {room.canManage ? (
          <>
            <div className={styles.drawerSectionHeader}>
              <div>
                <strong>Roster not connected</strong>
                <span>{waitingRoster.length ? `${waitingRoster.length} can still join` : 'Everyone in the imported roster is connected'}</span>
              </div>
              <button className={styles.buttonPrimary} type="button" disabled={sharing} onClick={onInvite}>
                {sharing ? 'Preparing…' : 'Share invite'}
              </button>
            </div>
            {waitingRoster.length ? (
              <div className={styles.memberList}>
                {waitingRoster.map((member) => (
                  <article key={member.id} className={styles.memberRow}>
                    <span className={styles.presenceDot} aria-hidden="true" />
                    <div>
                      <strong>{member.name}</strong>
                      <span>{[member.role, member.phone ? 'Phone ready' : '', member.email ? 'Email ready' : ''].filter(Boolean).join(' · ')}</span>
                    </div>
                    <div className={styles.contactActions}>
                      {member.phone ? <a href={`tel:${member.phone}`}>Call</a> : null}
                      {member.email ? <a href={`mailto:${member.email}`}>Email</a> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            {room.removedMembers.length ? (
              <div className={styles.drawerSection}>
                <strong>Removed from chat</strong>
                {room.removedMembers.map((member) => (
                  <div key={member.id} className={styles.removedMember}>
                    <span>{member.name}</span>
                    <button className={styles.buttonSecondary} type="button" onClick={() => onRestore(member)}>Restore</button>
                  </div>
                ))}
              </div>
            ) : null}
            {room.activeInviteCount ? (
              <button className={styles.revokeButton} type="button" onClick={onRevokeInvites}>
                Revoke {room.activeInviteCount} active invite {room.activeInviteCount === 1 ? 'link' : 'links'}
              </button>
            ) : null}
          </>
        ) : null}
      </aside>
    </div>
  )
}

function CaptainActionQueue({
  queue,
  reminderAt,
  reminding,
  scheduling,
  onReminderAtChange,
  onRemind,
  onSchedule,
}: {
  queue: TeamRoomActionQueue
  reminderAt: string
  reminding: boolean
  scheduling: boolean
  onReminderAtChange: (value: string) => void
  onRemind: () => void
  onSchedule: () => void
}) {
  const needsAttention = queue.unresolvedCount > 0
  const summary = [
    queue.waitingCount ? `${queue.waitingCount} waiting` : '',
    queue.maybeCount ? `${queue.maybeCount} maybe` : '',
    queue.unseenLineupCount ? `${queue.unseenLineupCount} lineup unseen` : '',
  ].filter(Boolean)
  const names = Array.from(new Set([
    ...queue.waitingNames,
    ...queue.maybeNames,
    ...queue.unseenLineupNames,
  ])).slice(0, 5)

  return (
    <section className={`${styles.actionQueue} ${needsAttention ? styles.actionQueueOpen : styles.actionQueueClear}`} aria-label="Captain action queue">
      <div className={styles.actionQueueTop}>
        <div>
          <p className={styles.matchCardEyebrow}>Needs attention</p>
          <h2>{needsAttention ? summary.join(' · ') : 'Everyone is caught up'}</h2>
          {names.length ? <p>{names.join(', ')}{queue.unresolvedCount > names.length ? ` +${queue.unresolvedCount - names.length}` : ''}</p> : null}
        </div>
        <span className={needsAttention ? styles.queueCountOpen : styles.queueCountClear}>{queue.unresolvedCount}</span>
      </div>
      {needsAttention ? (
        <div className={styles.actionQueueActions}>
          <button className={styles.buttonPrimary} type="button" disabled={reminding} onClick={onRemind}>
            {reminding ? 'Sending…' : `Remind ${queue.unresolvedCount}`}
          </button>
          <label className={styles.reminderField}>
            <span>Automatic follow-up</span>
            <input type="datetime-local" value={reminderAt} onChange={(event) => onReminderAtChange(event.target.value)} />
          </label>
          <button className={styles.buttonSecondary} type="button" disabled={scheduling || !reminderAt} onClick={onSchedule}>
            {scheduling ? 'Setting…' : queue.reminderStatus === 'scheduled' ? 'Update reminder' : 'Set reminder'}
          </button>
        </div>
      ) : null}
      {queue.reminderStatus === 'scheduled' && queue.reminderAt ? (
        <p className={styles.reminderStatus}>TIQ will remind only unfinished players {formatReminderTime(queue.reminderAt)}.</p>
      ) : queue.lastReminderAt ? (
        <p className={styles.reminderStatus}>Last reminder sent {formatReminderTime(queue.lastReminderAt)}.</p>
      ) : null}
    </section>
  )
}

function MatchRecap({ message }: { message: TeamRoomMessage }) {
  const card = message.card
  if (!card) return null
  return (
    <details className={styles.matchRecap}>
      <summary>
        <span><strong>{formatMatchDate(card.matchDate)}</strong>{card.opponent ? ` vs ${card.opponent}` : ''}</span>
        <span>{message.responseSummary.yes} yes · {message.responseSummary.maybe} maybe · {message.responseSummary.no} no</span>
      </summary>
      {card.lineup.length ? (
        <div className={styles.lineupPreview}>
          {card.lineup.map((row, index) => <div key={`${row.label}-${index}`} className={styles.lineupRow}><strong>{row.label}</strong><span>{row.players.join(' / ') || 'Open'}</span></div>)}
        </div>
      ) : <p>{message.body}</p>}
    </details>
  )
}

function UpcomingMatchCard({ message }: { message: TeamRoomMessage }) {
  const card = message.card
  if (!card) return null
  return (
    <article className={styles.upcomingMatch}>
      <span>Coming up</span>
      <strong>{formatMatchDate(card.matchDate)}{card.opponent ? ` vs ${card.opponent}` : ''}</strong>
    </article>
  )
}

function MatchCard({
  message,
  memberCount,
  canManage,
  teamName,
  leagueName,
  flight,
  focused,
  focusedPlayerName,
  focusedCourtLabel,
  focusedReplyStatus,
  responding,
  acknowledging,
  notifyingLineupChange,
  sendingFinalLineup,
  respondingLineupChange,
  schedulingLineupChangeDeadline,
  lineupChangeDeadlineDate,
  currentPlayerNames,
  onRespond,
  onAcknowledge,
  onNotifyLineupChange,
  onSendFinalLineup,
  onRespondLineupChange,
  onLineupChangeDeadlineDate,
  onScheduleLineupChangeDeadline,
  onAskCaptain,
}: {
  message: TeamRoomMessage
  memberCount: number
  canManage: boolean
  teamName: string
  leagueName: string
  flight: string
  focused: boolean
  focusedPlayerName: string
  focusedCourtLabel: string
  focusedReplyStatus: string
  responding: boolean
  acknowledging: boolean
  notifyingLineupChange: boolean
  sendingFinalLineup: boolean
  respondingLineupChange: boolean
  schedulingLineupChangeDeadline: boolean
  lineupChangeDeadlineDate: string
  currentPlayerNames: string[]
  onRespond: (response: 'yes' | 'maybe' | 'no') => void
  onAcknowledge: () => void
  onNotifyLineupChange: () => void
  onSendFinalLineup: (lineupId: string) => void
  onRespondLineupChange: (response: 'accepted' | 'declined') => void
  onLineupChangeDeadlineDate: (value: string) => void
  onScheduleLineupChangeDeadline: () => void
  onAskCaptain: () => void
}) {
  const card = message.card
  if (!card) return null
  const waiting = card.availabilitySummary?.waiting ?? Math.max(0, memberCount - message.responseSummary.total)
  const messagingBaseHref = buildCaptainScopedHref('/captain/messaging', {
    team: teamName,
    league: leagueName,
    flight,
    date: card.matchDate,
    opponent: card.opponent,
  })
  const messagingParams = new URLSearchParams({ source: 'team_room', focus: 'waiting' })
  if (card.availabilityRequestId) messagingParams.set('availabilityRequest', card.availabilityRequestId)
  const messagingHref = `${messagingBaseHref}${messagingBaseHref.includes('?') ? '&' : '?'}${messagingParams.toString()}#potential-lineup-confirm-title`
  const lineupBaseHref = buildCaptainScopedHref('/captain/lineup-builder', {
    team: teamName,
    league: leagueName,
    flight,
    date: card.matchDate,
    opponent: card.opponent,
    scenarioId: card.availabilitySummary?.scenarioId || undefined,
  })
  const lineupParams = new URLSearchParams({ source: 'team_room', availability: 'replies' })
  const lineupHref = `${lineupBaseHref}${lineupBaseHref.includes('?') ? '&' : '?'}${lineupParams.toString()}#captain-lineup-courts`
  const focusedStatusLabel = focusedReplyStatus === 'available' || focusedReplyStatus === 'yes'
    ? 'In'
    : focusedReplyStatus === 'unavailable' || focusedReplyStatus === 'no' ? 'Out' : 'Maybe'
  const replyGroups = buildMatchReplyGroups(message, waiting)
  const primaryRisk = findPrimaryLineupRisk(card.lineup, replyGroups)
  const captainReplyHref = primaryRisk ? buildCaptainReplyReviewHref({
    teamName,
    leagueName,
    flight,
    matchDate: card.matchDate,
    opponent: card.opponent,
    messageId: message.id,
    availabilityRequestId: card.availabilityRequestId,
    playerName: primaryRisk.playerName,
    status: primaryRisk.status,
    courtLabel: primaryRisk.courtLabel,
  }) : ''
  const lineupChangeNotice = card.lineupChangeNotice
  const courtReadiness = buildTeamRoomCourtReadiness({
    lineup: card.lineup,
    replies: replyGroups.map((group) => ({ status: group.status, names: group.names })),
    lineupChange: lineupChangeNotice,
  })
  const lineupId = buildCaptainLockedLineupId({ messageId: message.id, lineup: card.lineup })
  const lineupLocked = card.cardType === 'projected_lineup' && isCaptainLineupLocked({
    confirmedCount: courtReadiness.filter((court) => court.status === 'confirmed').length,
    totalCount: courtReadiness.length,
    lineup: card.lineup,
  })
  const canAnswerLineupChange = Boolean(
    lineupChangeNotice
    && !lineupChangeNotice.pending
    && canRespondToLineupChange(lineupChangeNotice.replacementPlayerName, currentPlayerNames),
  )
  const replacementNeedsAnswer = Boolean(lineupChangeNotice && !lineupChangeNotice.pending && !lineupChangeNotice.response)
  const lineupChangeOverdue = replacementNeedsAnswer && lineupChangeNotice?.deadlineStatus === 'reminded'
  const canScheduleLineupChangeDeadline = Boolean(card.matchDate && card.matchDate > localDateInputKey(new Date()))
  const declinedReplacementHref = lineupChangeNotice?.response === 'declined'
    ? buildTeamRoomLateArrivalBuilderHref(lineupBaseHref, {
        playerName: lineupChangeNotice.replacementPlayerName,
        courtLabel: lineupChangeNotice.courtLabel,
      })
    : ''
  const waitingReplacementHref = lineupChangeOverdue && lineupChangeNotice
    ? buildCaptainReplyReviewHref({
        teamName,
        leagueName,
        flight,
        matchDate: card.matchDate,
        opponent: card.opponent,
        messageId: message.id,
        availabilityRequestId: card.availabilityRequestId,
        playerName: lineupChangeNotice.replacementPlayerName,
        status: 'maybe',
        courtLabel: lineupChangeNotice.courtLabel,
      })
    : ''

  return (
    <article
      id={`match-card-${message.id}`}
      className={`${styles.matchCard} ${focused ? styles.matchCardFocused : ''}`}
      aria-label={`${card.title} for ${formatMatchDate(card.matchDate)}`}
      tabIndex={focused ? -1 : undefined}
    >
      <div className={styles.matchCardTop}>
        <div>
          <p className={styles.matchCardEyebrow}>{card.cardType === 'projected_lineup' ? 'Projected lineup' : 'Next match'}</p>
          <h2>{card.title}</h2>
        </div>
        <span className={styles.pinnedBadge}>Pinned</span>
      </div>
      <div className={styles.matchIdentity}>
        <strong>{formatMatchDate(card.matchDate)}</strong>
        {card.opponent ? <span>vs {card.opponent}</span> : null}
        {card.matchTime ? <span>{card.matchTime}</span> : null}
        {card.facility ? <span>{card.facility}</span> : null}
      </div>

      {focused && focusedPlayerName ? (
        <div className={styles.replyFocusNotice} role="status">
          <strong>{focusedPlayerName} replied {focusedStatusLabel}</strong>
          <span>{focusedCourtLabel ? `${focusedCourtLabel} is highlighted below.` : 'Review this response before updating the lineup.'}</span>
        </div>
      ) : null}

      {courtReadiness.length ? (
        <>
          <CourtReadinessStrip messageId={message.id} courts={courtReadiness} />
          <details className={styles.readinessReplyDetails}>
            <summary>Player reply details</summary>
            <MatchReplyDigest groups={replyGroups} primaryRisk={primaryRisk} />
          </details>
        </>
      ) : <MatchReplyDigest groups={replyGroups} primaryRisk={primaryRisk} />}

      {card.lineup.length ? (
        <div className={styles.lineupPreview} aria-label="Projected courts">
          {card.lineup.map((row, index) => {
            const rowIsFocused = focused && (
              normalizeTeamRoomPlayerName(row.label) === normalizeTeamRoomPlayerName(focusedCourtLabel)
              || row.players.some((player) => normalizeTeamRoomPlayerName(player) === normalizeTeamRoomPlayerName(focusedPlayerName))
            )
            return (
              <div
                id={courtReadinessAnchor(message.id, index)}
                key={`${row.label}-${index}`}
                className={`${styles.lineupRow} ${rowIsFocused ? styles.lineupRowFocused : ''}`}
                tabIndex={-1}
              >
                <strong>{row.label || `Court ${index + 1}`}</strong>
                <span>{row.players.join(' / ') || 'Open'}</span>
              </div>
            )
          })}
        </div>
      ) : null}

      {card.lineupChanges.length ? (
        <div className={styles.lineupChanges}>
          <strong>{card.lineupVersion > 1 ? 'What changed' : 'Lineup posted'}</strong>
          {card.lineupChanges.slice(0, 4).map((change) => <span key={change}>{change}</span>)}
        </div>
      ) : null}

      {lineupChangeNotice ? (
        <div className={lineupChangeNotice.pending
          ? styles.lineupChangePending
          : lineupChangeNotice.response === 'declined'
            ? styles.lineupChangeDeclined
            : lineupChangeOverdue ? styles.lineupChangeOverdue : styles.lineupChangeSent}>
          <strong>{lineupChangeNotice.pending
            ? lineupChangeNotice.publishedLineupChange ? 'Final lineup change ready' : 'Ready to notify affected players'
            : lineupChangeNotice.response === 'accepted'
              ? lineupChangeNotice.publishedLineupChange ? 'Published lineup confirmed' : 'Replacement confirmed'
              : lineupChangeNotice.response === 'declined'
                ? 'Replacement can’t play'
                : lineupChangeOverdue
                  ? 'Response overdue'
                  : lineupChangeNotice.publishedLineupChange ? 'Published update sent' : 'Waiting for replacement'}</strong>
          <span>
            {lineupChangeNotice.replacementPlayerName} replaces {lineupChangeNotice.outgoingPlayerName} on {lineupChangeNotice.courtLabel}.
          </span>
          {!lineupChangeNotice.pending ? (
            <small>{lineupChangeNotice.response === 'accepted'
              ? `${lineupChangeNotice.responderName || lineupChangeNotice.replacementPlayerName} accepted this court.${lineupChangeNotice.publishedLineupChange ? ' The revised lineup is published.' : ''}`
              : lineupChangeNotice.response === 'declined'
                ? 'Choose another player for this court.'
                : lineupChangeOverdue
                  ? 'TIQ sent one reminder. Review this court now.'
                  : lineupChangeNotice.deadlineStatus === 'scheduled' && lineupChangeNotice.deadlineAt
                    ? `TIQ will remind them on the morning of ${formatDateOnly(lineupChangeNotice.deadlineAt.slice(0, 10))}.`
                : lineupChangeNotice.notifiedCount
                  ? `${lineupChangeNotice.notifiedCount} connected player${lineupChangeNotice.notifiedCount === 1 ? '' : 's'} notified.`
                  : 'Direct-share update prepared.'}</small>
          ) : null}
          {canManage && replacementNeedsAnswer && !lineupChangeOverdue ? (
            canScheduleLineupChangeDeadline ? (
              <div className={styles.lineupChangeDeadline}>
                <label>
                  <span>Reply by</span>
                  <input
                    type="date"
                    min={defaultLineupChangeDeadlineDate(card.matchDate)}
                    max={card.matchDate}
                    value={lineupChangeDeadlineDate}
                    onChange={(event) => onLineupChangeDeadlineDate(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={schedulingLineupChangeDeadline || !lineupChangeDeadlineDate}
                  onClick={onScheduleLineupChangeDeadline}
                >
                  {schedulingLineupChangeDeadline
                    ? 'Setting…'
                    : lineupChangeNotice.deadlineStatus === 'scheduled' ? 'Update date' : 'Set date'}
                </button>
              </div>
            ) : <small>Match day is too close for an automatic morning reminder. Follow up directly.</small>
          ) : null}
          {canAnswerLineupChange ? (
            <div className={styles.lineupChangeDecision} role="group" aria-label={`Can you play ${lineupChangeNotice.courtLabel}?`}>
              <span>{lineupChangeNotice.response ? 'Your answer' : 'Can you play this court?'}</span>
              <button
                type="button"
                disabled={respondingLineupChange}
                aria-pressed={lineupChangeNotice.response === 'accepted'}
                onClick={() => onRespondLineupChange('accepted')}
              >
                {respondingLineupChange ? 'Saving…' : 'Accept'}
              </button>
              <button
                type="button"
                disabled={respondingLineupChange}
                aria-pressed={lineupChangeNotice.response === 'declined'}
                onClick={() => onRespondLineupChange('declined')}
              >
                Can’t play
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.responseActions} aria-label="Your availability">
        {!canAnswerLineupChange ? ([
          ['yes', 'Confirm'],
          ['maybe', 'Maybe'],
          ['no', "Can't play"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            className={`${styles.responseButton} ${message.response === value ? styles.responseSelected : ''}`}
            type="button"
            disabled={responding}
            aria-pressed={message.response === value}
            onClick={() => onRespond(value)}
          >
            {label}
          </button>
        )) : null}
        {card.cardType === 'projected_lineup' && !canAnswerLineupChange ? (
          <button
            className={`${styles.responseButton} ${card.acknowledged ? styles.responseSelected : ''}`}
            type="button"
            disabled={acknowledging || card.acknowledged}
            aria-pressed={card.acknowledged}
            onClick={onAcknowledge}
          >
            {card.acknowledged ? 'Seen' : acknowledging ? 'Saving…' : 'Mark seen'}
          </button>
        ) : null}
        {!canManage ? <button className={styles.responseButton} type="button" onClick={onAskCaptain}>Ask captain</button> : null}
      </div>
      {card.cardType === 'projected_lineup' ? (
        <p className={styles.ackSummary}>{card.acknowledgmentSummary.total} teammate{card.acknowledgmentSummary.total === 1 ? '' : 's'} saw version {card.lineupVersion}.</p>
      ) : null}
      {canManage ? (
        <div className={styles.captainCardActions}>
          {card.cardType === 'projected_lineup' ? (
            <>
              {lineupChangeNotice?.pending ? (
                <button className={styles.buttonPrimary} type="button" disabled={notifyingLineupChange} onClick={onNotifyLineupChange}>
                  {notifyingLineupChange
                    ? 'Sending…'
                    : lineupChangeNotice.publishedLineupChange
                      ? 'Send lineup change'
                      : `Notify ${lineupChangeNotice.affectedNames.length} affected`}
                </button>
              ) : lineupChangeNotice?.response === 'declined' ? (
                <Link className={styles.buttonPrimary} href={declinedReplacementHref}>Choose another backup</Link>
              ) : lineupChangeOverdue ? (
                <Link className={styles.buttonPrimary} href={waitingReplacementHref}>Review this court</Link>
              ) : card.finalLineup ? (
                <span className={styles.captainActionComplete}>Lineup sent</span>
              ) : lineupLocked ? (
                <button className={styles.buttonPrimary} type="button" disabled={sendingFinalLineup} onClick={() => onSendFinalLineup(lineupId)}>
                  {sendingFinalLineup ? 'Sending…' : 'Send lineup to team'}
                </button>
              ) : primaryRisk ? (
                <Link className={styles.buttonPrimary} href={captainReplyHref}>Find replacement</Link>
              ) : waiting ? (
                <Link className={styles.buttonPrimary} href={messagingHref}>Nudge {waiting} waiting</Link>
              ) : (
                <span className={styles.captainActionComplete}>All replied</span>
              )}
              {lineupChangeNotice?.pending || lineupChangeNotice?.response === 'declined' || lineupChangeOverdue ? (
                <Link className={styles.buttonSecondary} href={lineupHref}>Review lineup</Link>
              ) : primaryRisk && waiting ? (
                <Link className={styles.buttonSecondary} href={messagingHref}>Nudge {waiting} waiting</Link>
              ) : (
                <Link className={styles.buttonSecondary} href={lineupHref}>Update lineup</Link>
              )}
            </>
          ) : (
            <>
              <Link className={styles.buttonPrimary} href={lineupHref}>
                {message.responseSummary.total ? 'Build from replies' : 'Build lineup'}
              </Link>
              <Link className={styles.buttonSecondary} href={messagingHref}>Text players not connected</Link>
            </>
          )}
        </div>
      ) : null}
    </article>
  )
}

type MatchReplyGroup = {
  status: 'yes' | 'no' | 'maybe' | 'waiting'
  label: 'In' | 'Out' | 'Maybe' | 'Waiting'
  count: number
  names: string[]
}

type PrimaryLineupRisk = {
  playerName: string
  status: 'unavailable' | 'maybe'
  statusLabel: 'Out' | 'Maybe'
  courtLabel: string
}

function CourtReadinessStrip({
  messageId,
  courts,
}: {
  messageId: string
  courts: TeamRoomCourtReadiness[]
}) {
  const confirmedCount = courts.filter((court) => court.status === 'confirmed').length
  return (
    <section className={styles.courtReadiness} aria-label="Lineup readiness">
      <div className={styles.courtReadinessTop}>
        <strong>Lineup readiness</strong>
        <span>{confirmedCount}/{courts.length} confirmed</span>
      </div>
      <nav className={styles.courtReadinessGrid} aria-label="Open a projected court">
        {courts.map((court, index) => (
          <a
            key={`${court.label}-${index}`}
            className={`${styles.courtReadinessItem} ${court.status === 'confirmed'
              ? styles.courtReadinessConfirmed
              : court.status === 'needs_captain' ? styles.courtReadinessCaptain : styles.courtReadinessWaiting}`}
            href={`#${courtReadinessAnchor(messageId, index)}`}
          >
            <strong>{court.label || `Court ${index + 1}`}</strong>
            <span>{court.status === 'confirmed'
              ? 'Confirmed'
              : court.status === 'needs_captain' ? 'Needs captain' : 'Waiting'}</span>
          </a>
        ))}
      </nav>
    </section>
  )
}

function TeamRoomPortalState({ children }: { children: ReactNode }) {
  const [compactSiteMenuOpen, setCompactSiteMenuOpen] = useState(false)
  return (
    <>
      <SiteHeader
        active="/messages"
        railLayout={false}
        onCompactMenuOpenChange={setCompactSiteMenuOpen}
      />
      <PortalToolBar suppressed={compactSiteMenuOpen} />
      <TeamConnectionInvite />
      {children}
      <SiteFooter railLayout={false} railWidth={0} />
    </>
  )
}

function courtReadinessAnchor(messageId: string, index: number) {
  return `match-card-${messageId}-court-${index + 1}`
}

function MatchReplyDigest({
  groups,
  primaryRisk,
}: {
  groups: MatchReplyGroup[]
  primaryRisk: PrimaryLineupRisk | null
}) {
  const attentionCount = groups
    .filter((group) => group.status === 'no' || group.status === 'maybe')
    .reduce((total, group) => total + group.count, 0)
  const waitingCount = groups.find((group) => group.status === 'waiting')?.count || 0
  const answeredCount = groups
    .filter((group) => group.status !== 'waiting')
    .reduce((total, group) => total + group.count, 0)
  const namedGroups = groups.filter((group) => group.count > 0 && group.names.length > 0)
  const headline = attentionCount > 0
    ? `${attentionCount} need a decision`
    : waitingCount > 0 ? `${waitingCount} ${waitingCount === 1 ? 'reply' : 'replies'} left` : 'Everyone replied'

  return (
    <section className={styles.replyDigest} aria-label="Match reply summary">
      <div className={styles.replyDigestTop}>
        <div>
          <span>Match replies</span>
          <strong>{headline}</strong>
        </div>
        <small>{answeredCount} answered</small>
      </div>
      <div className={styles.replySummary} aria-live="polite" aria-label="Availability response summary">
        {groups.map((group) => (
          <span key={group.status} className={group.status === 'no' || group.status === 'maybe' ? styles.replySummaryAttention : ''}>
            <strong>{group.count}</strong> {group.label}
          </span>
        ))}
      </div>
      {primaryRisk ? (
        <div className={styles.replyPriority}>
          <strong>{primaryRisk.playerName} is {primaryRisk.statusLabel}</strong>
          <span>{primaryRisk.courtLabel} needs the first decision.</span>
        </div>
      ) : null}
      {namedGroups.length ? (
        <details className={styles.replyDetails}>
          <summary>See player statuses</summary>
          <div>
            {namedGroups.map((group) => (
              <p key={group.status}>
                <strong>{group.label}</strong>
                <span>{formatReplyNames(group.names, group.count)}</span>
              </p>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  )
}

function buildMatchReplyGroups(message: TeamRoomMessage, waiting: number): MatchReplyGroup[] {
  const summary = message.card?.availabilitySummary
  const responseNames = (status: 'yes' | 'maybe' | 'no') => uniqueReplyNames(
    message.responseDetails.filter((detail) => detail.response === status).map((detail) => detail.name),
  )
  return [
    { status: 'yes', label: 'In', count: message.responseSummary.yes, names: summary?.yesNames ?? responseNames('yes') },
    { status: 'no', label: 'Out', count: message.responseSummary.no, names: summary?.noNames ?? responseNames('no') },
    { status: 'maybe', label: 'Maybe', count: message.responseSummary.maybe, names: summary?.maybeNames ?? responseNames('maybe') },
    { status: 'waiting', label: 'Waiting', count: waiting, names: summary?.waitingNames ?? [] },
  ]
}

function findPrimaryLineupRisk(lineup: TeamRoomMatchCard['lineup'], groups: MatchReplyGroup[]): PrimaryLineupRisk | null {
  const riskGroups = groups.filter((group) => group.status === 'no' || group.status === 'maybe')
  for (const group of riskGroups) {
    for (const playerName of group.names) {
      const row = lineup.find((court) => court.players.some((player) => (
        normalizeTeamRoomPlayerName(player) === normalizeTeamRoomPlayerName(playerName)
      )))
      if (!row) continue
      return {
        playerName,
        status: group.status === 'no' ? 'unavailable' : 'maybe',
        statusLabel: group.status === 'no' ? 'Out' : 'Maybe',
        courtLabel: row.label || 'Projected court',
      }
    }
  }
  return null
}

function buildCaptainReplyReviewHref(input: {
  teamName: string
  leagueName: string
  flight: string
  matchDate: string
  opponent: string
  messageId: string
  availabilityRequestId: string
  playerName: string
  status: 'unavailable' | 'maybe'
  courtLabel: string
}) {
  const baseHref = buildCaptainScopedHref('/captain', {
    team: input.teamName,
    league: input.leagueName,
    flight: input.flight,
    date: input.matchDate,
    opponent: input.opponent,
  })
  const params = new URLSearchParams({
    notice: CAPTAIN_AVAILABILITY_REPLY_NOTICE,
    player: input.playerName,
    status: input.status,
    court: input.courtLabel,
    message: input.messageId,
    source: 'team_room',
  })
  if (input.availabilityRequestId) params.set('availabilityRequest', input.availabilityRequestId)
  return `${baseHref}${baseHref.includes('?') ? '&' : '?'}${params.toString()}#captain-reply-alert`
}

function uniqueReplyNames(names: string[]) {
  const byKey = new Map<string, string>()
  for (const name of names) {
    const cleanName = name.trim()
    const key = normalizeTeamRoomPlayerName(cleanName)
    if (key && !byKey.has(key)) byKey.set(key, cleanName)
  }
  return Array.from(byKey.values())
}

function formatReplyNames(names: string[], count: number) {
  const visible = names.slice(0, 4)
  const remaining = Math.max(0, count - visible.length)
  return `${visible.join(', ')}${remaining ? ` +${remaining} more` : ''}`
}

function normalizeTeamRoomPlayerName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function TeamRoomInstallCard({ room }: { room: TeamRoom }) {
  const isIOS = useSyncExternalStore(subscribeToUserAgent, getIsIOSSnapshot, () => false)
  const isStandalone = useSyncExternalStore(subscribeToStandalone, getIsStandaloneSnapshot, () => false)
  const [showIOSSteps, setShowIOSSteps] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', capturePrompt)
    return () => window.removeEventListener('beforeinstallprompt', capturePrompt)
  }, [])

  async function install() {
    if (installPrompt) {
      await installPrompt.prompt()
      await installPrompt.userChoice
      setInstallPrompt(null)
      return
    }
    setShowIOSSteps(true)
  }

  return (
    <section className={styles.installCard} aria-label="Team Room app access">
      <div>
        <h2>Put this Team Room on your Home Screen.</h2>
        <p>Open TenAceIQ like an app and return to your default team conversation in one tap.</p>
      </div>
      <div className={styles.installActions}>
        {isStandalone ? (
          <span className={styles.standaloneBadge}>Home Screen ready</span>
        ) : (
          <button className={styles.buttonPrimary} type="button" onClick={() => void install()}>
            Add to Home Screen
          </button>
        )}
        <button className={styles.buttonSecondary} type="button" onClick={() => void shareOrCopy({
          title: `${room.teamName} Team Room`,
          text: `Open our ${room.teamName} Team Room in TenAceIQ.`,
          url: new URL(room.href, window.location.origin).toString(),
        })}>Share</button>
      </div>
      {showIOSSteps || (isIOS && !isStandalone) ? (
        <div className={styles.iosSteps}>
          On iPhone: open this page in Safari, tap the Share button, choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>. Your TenAceIQ icon will open full screen like an app.
        </div>
      ) : null}
    </section>
  )
}

function TeamRoomLoading() {
  return (
    <main className={styles.page}>
      <section className={styles.stateCard}>
        <p className={styles.eyebrow}>Team Room</p>
        <h1>Opening your team conversation…</h1>
        <p className={styles.helper}>Connecting your linked team, members, and latest messages.</p>
      </section>
    </main>
  )
}

async function shareOrCopy(input: ShareData) {
  if (navigator.share) {
    try {
      await navigator.share(input)
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  const copyText = [input.text, input.url].filter(Boolean).join('\n')
  if (copyText && navigator.clipboard) await navigator.clipboard.writeText(copyText)
}

function formatMessageTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  return sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatArrivalUpdateAge(value: string) {
  const updatedAt = new Date(value).getTime()
  if (!Number.isFinite(updatedAt)) return 'recently'
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - updatedAt) / 60_000))
  if (elapsedMinutes < 1) return 'now'
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours}h ago`
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function buildArrivalReplyText(playerNames: string[], card: TeamRoomMatchCard) {
  const names = playerNames.join(', ')
  const match = [
    card.matchDate ? formatMatchDate(card.matchDate) : 'today\'s match',
    card.opponent ? `vs ${card.opponent}` : '',
  ].filter(Boolean).join(' ')
  const logistics = [card.matchTime, card.facility].filter(Boolean).join(' at ')
  return `${names} — please reply Here or On my way for ${match}${logistics ? ` (${logistics})` : ''}. Reply here and I'll update the team.`
}

function buildArrivalPlayerDomId(messageId: string, courtLabel: string, playerName: string) {
  return `team-room-arrival-player-${encodeURIComponent(messageId)}-${encodeURIComponent(courtLabel)}-${encodeURIComponent(playerName)}`
}

function formatMatchDate(value: string) {
  if (!value) return 'Next match'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

function localDateInputKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultLineupChangeDeadlineDate(matchDate: string) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = localDateInputKey(tomorrow)
  return matchDate && matchDate < tomorrowKey ? matchDate : tomorrowKey
}

function formatDateOnly(value: string) {
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

function defaultReminderTime(matchDate: string) {
  const reminder = new Date(`${matchDate}T18:00:00`)
  reminder.setDate(reminder.getDate() - 1)
  if (Number.isNaN(reminder.getTime()) || reminder.getTime() <= Date.now()) {
    return new Date(Date.now() + (2 * 60 * 60 * 1000)).toISOString()
  }
  return reminder.toISOString()
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60_000))
  return local.toISOString().slice(0, 16)
}

function formatReminderTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function reactionLabel(reaction: 'ack' | 'helpful' | 'celebrate') {
  if (reaction === 'helpful') return 'Helpful'
  if (reaction === 'celebrate') return 'Great'
  return 'Seen'
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'File'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index)
  return output
}
