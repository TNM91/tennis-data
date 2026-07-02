'use client'

import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { LEVEL_UP_CARDS } from '@/lib/level-up/level-up-cards'
import type { LevelUpCard, LevelUpCompletion } from '@/lib/level-up/level-up-types'
import type { PlayerDevelopmentIdentityCourtsideRead } from '@/lib/player-development'
import { MEMBERSHIP_TIERS } from '@/lib/product-story'
import { supabase } from '@/lib/supabase'
import styles from './player-development.module.css'

type TrainingRow = string[]

type LiveFocus = {
  id: string
  title: string
  cue: string
  drills: string[]
  tracker: string[]
}

type WorkType = 'court' | 'physical' | 'mental'
type TrainingContext = 'alone' | 'partner' | 'singles' | 'doubles' | 'coach'
type PlayerFeeling = 'ready' | 'tight' | 'tired' | 'nervous'
type PlayerReadiness = 'fresh' | 'okay' | 'tired'
type AccessMode = 'coach_invited' | 'player_plus' | 'free_preview'
type EditingStep = 'focus' | 'setup' | 'work' | null
type SessionDraft = {
  rating: number | null
  feeling: PlayerFeeling
  note: string
  sharedWithCoach: boolean
}
type RecapCopyStatus = 'idle' | 'copied' | 'manual' | 'shared' | 'unsent'
type RecapMode = 'text' | 'full'
type WakeLockStatus = 'off' | 'active' | 'unsupported' | 'blocked'
type SavedNextCueId = 'smart' | 'repeat' | 'pressure' | 'coach' | 'finish'
type SavedProofMomentId = 'practice' | 'thirty' | 'break' | 'tiebreak'
type SavedCoachAskId = 'next' | 'repeat' | 'fix' | 'film'

type SavedNextCue = {
  id: SavedNextCueId
  label: string
  value: string
  recap: string
}

type SavedProofMoment = {
  id: SavedProofMomentId
  label: string
  value: string
  recap: string
}

type SavedCoachAsk = {
  id: SavedCoachAskId
  label: string
  value: string
  recap: string
}

type SavedRecapCheck = {
  label: string
  value: string
  state: 'ready' | 'missing'
}

type SavedCoachBriefLine = {
  label: 'Changed' | 'Leaked' | 'Next'
  value: string
  state: 'strong' | 'watch' | 'next'
}

type SmartNextAction = {
  title: string
  copy: string
  decision: 'Add pressure' | 'Repeat clean' | 'Recover' | 'Finish'
  reason: string
  load: string
  primaryLabel: string
}

type LiveCourtsideCommand = {
  now: string
  count: string
  stop: string
}

type CourtsideResumeItem = {
  label: string
  value: string
  state: 'active' | 'ready' | 'done'
}

type ActiveSessionResumeStrip = {
  title: string
  detail: string
  action: 'score' | 'drill'
  actionLabel: string
  state: 'draft' | 'timer' | 'proof'
}

type TodayCloseoutRead = {
  bestProof: string
  pressureProof: string
  tomorrow: string
  starterFocusId: string
  starterFocusTitle: string
  starterWorkType: WorkType
  starterContext: TrainingContext
  starterDrillTitle: string
  starterReason: string
}

type TomorrowStarterPlan = {
  focusId: string
  focusTitle: string
  workType: WorkType
  context: TrainingContext
  drillId: string
  drillTitle: string
  cue: string
  reason: string
  createdAt: string
}

type TomorrowStarterCheck = {
  drillTitle: string
  mode: TomorrowStarterCheckMode
  label: string
  scoreLabel: string
  cue: string
  proof: string
  stopRule: string
}

type TomorrowStarterCheckMode = 'first' | 'volume' | 'repeat'

type TomorrowStarterCompletion = {
  drillTitle: string
  rating: number
  next: string
  actionLabel: string
  restoredPlan: TomorrowStarterPlan
}

type LevelUpWakeLockSentinel = EventTarget & {
  released: boolean
  release: () => Promise<void>
}

type LevelUpWakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<LevelUpWakeLockSentinel>
  }
}

type DrillOption = {
  id: string
  title: string
  summary: string
  workType: WorkType
  context: TrainingContext
  duration: string
  timerSeconds: number
  proof: string
  href: string
  sourceCard?: LevelUpCard
}

type SavedSession = {
  id: string
  focusId: string
  focusTitle: string
  workType: WorkType
  context: TrainingContext
  drillTitle: string
  rating: number
  feeling: PlayerFeeling
  accessMode: AccessMode
  note: string
  elapsedSeconds: number
  sharedWithCoach: boolean
  completedAt: string
  assignmentId?: string
  studentLinkId?: string
  assignmentTitle?: string
  starterRead?: SavedSessionStarterRead
}

type SavedSessionStarterRead = Pick<
  PlayerDevelopmentIdentityCourtsideRead,
  'starterRep' | 'starterProofCue' | 'starterLeakWatch' | 'starterSmartNext'
>

type SavedStarterCoachRead = SavedSessionStarterRead & {
  starterProof: string | null
}

type RemoteLevelUpSession = SavedSession & {
  playerUserId: string
  coachUserId: string | null
  studentLinkId: string | null
  assignmentId: string | null
  identitySlug: string
  createdAt: string
  updatedAt: string
}

type CustomQuestForCompletion = {
  id: string
  title: string
  xp: number
  linked_card_id: string | null
}

type SyncState = {
  status: 'idle' | 'syncing' | 'synced' | 'local' | 'error'
  message: string
}

type DrillTimerSnapshot = {
  drillId: string
  elapsedSeconds: number
  running: boolean
  targetSeconds: number
}

type PlayerLiveWorkbenchProps = {
  identitySlug: string
  identityTitle: string
  mantra: string
  identityCourtsideRead: PlayerDevelopmentIdentityCourtsideRead
  focuses: LiveFocus[]
  solo: TrainingRow[]
  partner: TrainingRow[]
  offCourt: TrainingRow[]
  performance: TrainingRow[]
}

const workTypeLabels: Record<WorkType, string> = {
  court: 'On court',
  physical: 'Off court: body',
  mental: 'Off court: mind',
}

const contextLabels: Record<TrainingContext, string> = {
  alone: 'Training alone',
  partner: 'With a partner',
  singles: 'Singles points',
  doubles: 'Doubles',
  coach: 'Coach challenge',
}

const contextOptionsByWorkType: Record<WorkType, TrainingContext[]> = {
  court: ['alone', 'partner', 'singles', 'doubles'],
  physical: ['alone'],
  mental: ['alone'],
}

const feelingLabels: Record<PlayerFeeling, string> = {
  ready: 'Ready',
  tight: 'Tight',
  tired: 'Tired',
  nervous: 'Nervous',
}

const readinessOptions: Record<PlayerReadiness, { label: string; copy: string }> = {
  fresh: { label: 'Fresh', copy: 'Push quality or level up.' },
  okay: { label: 'Okay', copy: 'Bank one clean block.' },
  tired: { label: 'Tired', copy: 'Scale down and protect form.' },
}

const readinessFeeling: Record<PlayerReadiness, PlayerFeeling> = {
  fresh: 'ready',
  okay: 'ready',
  tired: 'tired',
}

const LEVEL_UP_UNDO_WINDOW_MS = 6500
const PLAYER_TIER_NAME = MEMBERSHIP_TIERS.player_plus.name

const accessModes: Record<AccessMode, { label: string; title: string; copy: string; action: string }> = {
  coach_invited: {
    label: 'Coach invite',
    title: 'Included through your coach',
    copy: 'Use assigned challenges, rate the work, and share quick recaps back to the coach who invited you.',
    action: 'Coach can review shared work',
  },
  player_plus: {
    label: PLAYER_TIER_NAME,
    title: 'Full self-guided Level Up',
    copy: 'Use Level Up without a coach invite, save history across devices, and unlock trends, recommendations, and My Lab progress.',
    action: 'Player owns the full plan',
  },
  free_preview: {
    label: 'Free preview',
    title: 'Try the on-court flow',
    copy: `Explore a limited local session. Coach syncing and full history unlock through a coach invite or ${PLAYER_TIER_NAME}.`,
    action: 'Local-only sample',
  },
}

const emptyDraft: SessionDraft = {
  rating: null,
  feeling: 'ready',
  note: '',
  sharedWithCoach: true,
}

export default function PlayerLiveWorkbench({
  identitySlug,
  identityTitle,
  mantra,
  identityCourtsideRead,
  focuses,
  solo,
  partner,
  offCourt,
  performance,
}: PlayerLiveWorkbenchProps) {
  const searchParams = useSearchParams()
  const activityRef = useRef<HTMLElement | null>(null)
  const trackerRef = useRef<HTMLElement | null>(null)
  const savedRef = useRef<HTMLDivElement | null>(null)
  const finishRef = useRef<HTMLDivElement | null>(null)
  const starterCheckRef = useRef<HTMLDivElement | null>(null)
  const didHashAnchorScrollRef = useRef(false)
  const didMobileAutoScrollRef = useRef(false)
  const saveReceiptLockRef = useRef(false)
  const queuedSyncTimersRef = useRef<Map<string, number>>(new Map())
  const assignmentId = searchParams.get('assignmentId')?.trim() ?? ''
  const studentLinkId = searchParams.get('studentLinkId')?.trim() ?? ''
  const assignmentTitle = searchParams.get('assignmentTitle')?.trim() || searchParams.get('title')?.trim() || ''
  const assignmentFocus = searchParams.get('assignmentFocus')?.trim() || searchParams.get('focus')?.trim() || ''
  const assignmentWorkType = normalizeAssignmentWorkType(searchParams.get('workType'))
  const requestedCardId = searchParams.get('card')?.trim() ?? ''
  const customQuestId = searchParams.get('quest')?.trim() ?? ''
  const requestedCard = LEVEL_UP_CARDS.find((card) => card.id === requestedCardId)
  const requestedContext = normalizeTrainingContext(searchParams.get('context'))
  const hasCoachAssignment = Boolean(assignmentId || studentLinkId || searchParams.get('coach') === '1')
  const hasQuickStart = !hasCoachAssignment && Boolean(requestedCardId || customQuestId || searchParams.get('focus') || searchParams.get('workType') || searchParams.get('context'))
  const playableFocuses = useMemo(
    () => focuses.filter((focus) => focus.id !== 'accountability'),
    [focuses],
  )
  const defaultFocusId = playableFocuses.find((focus) => focus.id.includes('serve'))?.id ?? playableFocuses[0]?.id ?? 'focus'
  const assignmentFocusMatch = useMemo(
    () => findAssignmentFocus(playableFocuses, assignmentFocus),
    [assignmentFocus, playableFocuses],
  )
  const initialFocusId = assignmentFocusMatch?.id ?? defaultFocusId
  const initialWorkType = requestedCard ? getCardLiveWorkType(requestedCard) : assignmentWorkType ?? 'court'
  const initialContext = hasCoachAssignment && requestedCard ? 'coach' : requestedContext ?? (requestedCard ? getCardLiveContext(requestedCard, initialWorkType) : 'alone')
  const [activeFocusId, setActiveFocusId] = useState(initialFocusId)
  const [context, setContext] = useState<TrainingContext>(hasCoachAssignment ? 'coach' : initialContext)
  const [workType, setWorkType] = useState<WorkType>(initialWorkType)
  const [accessMode, setAccessMode] = useState<AccessMode>('coach_invited')
  const [activeDrillId, setActiveDrillId] = useState(requestedCard ? `card-${requestedCard.id}` : hasCoachAssignment ? `${initialFocusId}-coach-${initialWorkType}` : '')
  const [sessionDockActive, setSessionDockActive] = useState(hasCoachAssignment || hasQuickStart)
  const [editingStep, setEditingStep] = useState<EditingStep>(hasCoachAssignment || hasQuickStart ? null : 'focus')
  const [draft, setDraft] = useState(() => getEmptySessionDraft(true))
  const [lastSavedSession, setLastSavedSession] = useState<SavedSession | null>(null)
  const [undoSession, setUndoSession] = useState<SavedSession | null>(null)
  const [finishSummary, setFinishSummary] = useState<SavedSession[] | null>(null)
  const [readiness, setReadiness] = useState<PlayerReadiness>('okay')
  const [scoringDrillId, setScoringDrillId] = useState('')
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle', message: '' })
  const [questCreditMessage, setQuestCreditMessage] = useState('')
  const [activeTimerSnapshot, setActiveTimerSnapshot] = useState<DrillTimerSnapshot | null>(null)
  const [proofCounter, setProofCounter] = useState(0)
  const [recapCopyStatus, setRecapCopyStatus] = useState<RecapCopyStatus>('idle')
  const [recapMode, setRecapMode] = useState<RecapMode>('text')
  const [selectedNextCueId, setSelectedNextCueId] = useState<SavedNextCueId>('smart')
  const [selectedProofMomentId, setSelectedProofMomentId] = useState<SavedProofMomentId>('practice')
  const [selectedCoachAskId, setSelectedCoachAskId] = useState<SavedCoachAskId>('next')
  const [timerResetSignal, setTimerResetSignal] = useState(0)
  const [pressureRepeatCue, setPressureRepeatCue] = useState('')
  const storageKey = `tenaceiq:level-up:${identitySlug}`
  const sentProofRecapStorageKey = `tenaceiq:level-up-recap-sent:${identitySlug}`
  const tomorrowStarterStorageKey = `tenaceiq:level-up-tomorrow:${identitySlug}`
  const [sessions, setSessions] = useState<SavedSession[]>([])
  const [sentProofRecapIds, setSentProofRecapIds] = useState<string[]>([])
  const [tomorrowStarterPlan, setTomorrowStarterPlan] = useState<TomorrowStarterPlan | null>(null)
  const [tomorrowStarterCheck, setTomorrowStarterCheck] = useState<TomorrowStarterCheck | null>(null)
  const [tomorrowStarterCompletion, setTomorrowStarterCompletion] = useState<TomorrowStarterCompletion | null>(null)
  const [activeTomorrowStarterMode, setActiveTomorrowStarterMode] = useState<TomorrowStarterCheckMode | null>(null)

  const activeFocus = playableFocuses.find((focus) => focus.id === activeFocusId) ?? playableFocuses[0]
  const drillOptions = useMemo(
    () => {
      const baseOptions = buildDrillOptions(activeFocus, { solo, partner, offCourt, performance })
      return requestedCard ? [buildCardDrillOption(requestedCard, identitySlug, hasCoachAssignment ? 'coach' : undefined), ...baseOptions] : baseOptions
    },
    [activeFocus, hasCoachAssignment, identitySlug, partner, performance, requestedCard, solo, offCourt],
  )
  const filteredDrills = drillOptions.filter((drill) => drill.workType === workType && drill.context === context)
  const visibleDrills = filteredDrills.length
    ? filteredDrills
    : drillOptions.filter((drill) => drill.workType === workType).length
      ? drillOptions.filter((drill) => drill.workType === workType)
      : drillOptions
  const activeDrill = visibleDrills.find((drill) => drill.id === activeDrillId) ?? visibleDrills[0]
  const activeDrillSteps = activeDrill.sourceCard?.routine.slice(0, 3).map(shortenDrillStep) ?? getDrillActionSteps(activeDrill.summary)
  const proofTarget = activeDrill ? getProofCounterTarget(activeDrill) : 10
  const activeCourtsideCommand = getLiveCourtsideCommand(activeDrill, activeDrillSteps, proofTarget, readiness)
  const quickNoteChips = getQuickNoteChips(activeDrill)
  const contextOptions = contextOptionsByWorkType[workType]
  const recentSessions = sessions.slice(0, 4)
  const todaySessions = sessions.filter(isSessionFromToday).slice(0, 4)
  const todayCloseoutRead = getTodayCloseoutRead(todaySessions)
  const tomorrowStarterSaved = Boolean(
    todayCloseoutRead &&
    tomorrowStarterPlan &&
    tomorrowStarterPlan.drillTitle === todayCloseoutRead.starterDrillTitle &&
    tomorrowStarterPlan.cue === todayCloseoutRead.tomorrow,
  )
  const drillDayStreak = getDrillDayStreak(sessions, activeDrill?.title ?? '')
  const activeTimerSeconds = activeTimerSnapshot?.drillId === activeDrill?.id ? activeTimerSnapshot.elapsedSeconds : 0
  const progress = getProgressSummary(sessions, playableFocuses)
  const activeAccess = accessModes[accessMode]
  const suggestedNextDrill = lastSavedSession ? getNextDrillAfterSession(lastSavedSession, visibleDrills) : null
  const smartNextAction = lastSavedSession ? getSmartNextAction(lastSavedSession, suggestedNextDrill, readiness, todaySessions) : null
  const finishStats = finishSummary ? getFinishSummaryStats(finishSummary) : null
  const savedPressureProof = lastSavedSession ? getSavedPressureProofValue(lastSavedSession) : null
  const savedStarterProof = lastSavedSession ? getSavedStarterProofValue(lastSavedSession) : null
  const savedStarterCoachRead = lastSavedSession ? getSavedStarterCoachRead(lastSavedSession) : null
  const savedIdentitySignals = lastSavedSession
    ? [
        { label: 'Identity', value: identityTitle.replace(/^The /, '') },
        { label: 'Player ID signal', value: `${lastSavedSession.rating}/5 ${lastSavedSession.focusTitle}` },
        ...(savedStarterCoachRead ? [{ label: 'Starter cue', value: shortenCoachBriefValue(savedStarterCoachRead.starterProofCue) }] : []),
        ...(savedPressureProof ? [{ label: 'Pressure proof', value: shortenCoachBriefValue(savedPressureProof) }] : []),
        ...(savedStarterProof ? [{ label: 'Starter proof', value: savedStarterProof }] : []),
        { label: 'Next use', value: lastSavedSession.sharedWithCoach ? 'Coach-ready proof' : 'My Lab proof trail' },
      ]
    : []
  const savedDeliverySteps = lastSavedSession
    ? getSavedDeliverySteps(lastSavedSession, syncState, undoSession?.id === lastSavedSession.id)
    : []
  const savedNextSteps = lastSavedSession
    ? getSavedNextSteps(lastSavedSession, smartNextAction)
    : []
  const savedNextCueOptions = lastSavedSession ? getSavedNextCueOptions(lastSavedSession, smartNextAction) : []
  const selectedSavedNextCue = savedNextCueOptions.find((cue) => cue.id === selectedNextCueId) ?? savedNextCueOptions[0] ?? null
  const savedProofMomentOptions = lastSavedSession ? getSavedProofMomentOptions(lastSavedSession) : []
  const selectedSavedProofMoment = savedProofMomentOptions.find((moment) => moment.id === selectedProofMomentId) ?? savedProofMomentOptions[0] ?? null
  const savedCoachAskOptions = lastSavedSession ? getSavedCoachAskOptions(lastSavedSession) : []
  const selectedSavedCoachAsk = savedCoachAskOptions.find((ask) => ask.id === selectedCoachAskId) ?? savedCoachAskOptions[0] ?? null
  const savedCoachBrief = lastSavedSession ? getSavedCoachBrief(lastSavedSession, selectedSavedNextCue, selectedSavedCoachAsk) : []
  const savedRecapChecklist = lastSavedSession
    ? getSavedRecapChecklist(lastSavedSession, selectedSavedNextCue, selectedSavedProofMoment, selectedSavedCoachAsk)
    : []
  const savedProofFullRecap = lastSavedSession ? buildSavedProofRecap(lastSavedSession, selectedSavedNextCue, selectedSavedProofMoment, selectedSavedCoachAsk, savedCoachBrief) : ''
  const savedProofTextRecap = lastSavedSession ? buildSavedProofTextRecap(lastSavedSession, selectedSavedNextCue, selectedSavedProofMoment, selectedSavedCoachAsk, savedCoachBrief) : ''
  const savedProofRecap = recapMode === 'text' ? savedProofTextRecap : savedProofFullRecap
  const savedProofTextHref = savedProofRecap ? buildSavedProofTextHref(savedProofRecap) : ''
  const savedProofRecapSent = lastSavedSession ? sentProofRecapIds.includes(lastSavedSession.id) : false
  const hasActiveSaveReceipt = Boolean(lastSavedSession)
  const hasUnsavedSessionDraft = !hasActiveSaveReceipt && !isEmptySessionDraft(draft, accessMode)
  const courtsideResumeItems = getCourtsideResumeItems(
    activeDrill,
    activeTimerSeconds,
    proofCounter,
    proofTarget,
    scoringDrillId === activeDrill.id,
    hasUnsavedSessionDraft,
    lastSavedSession,
    savedProofRecapSent,
  )
  const courtsideResumeStatus = getCourtsideResumeStatus(
    activeTimerSeconds,
    proofCounter,
    proofTarget,
    scoringDrillId === activeDrill.id,
    hasUnsavedSessionDraft,
    lastSavedSession,
    savedProofRecapSent,
  )
  const activeResumeStrip = getActiveSessionResumeStrip(
    activeDrill,
    activeTimerSeconds,
    proofCounter,
    proofTarget,
    hasUnsavedSessionDraft,
    scoringDrillId === activeDrill.id,
    hasActiveSaveReceipt,
  )

  const handleTimerSnapshotChange = useCallback((snapshot: DrillTimerSnapshot) => {
    setActiveTimerSnapshot((current) => {
      if (
        current?.drillId === snapshot.drillId &&
        current.elapsedSeconds === snapshot.elapsedSeconds &&
        current.running === snapshot.running &&
        current.targetSeconds === snapshot.targetSeconds
      ) {
        return current
      }

      return snapshot
    })
  }, [])

  useEffect(() => {
    if (!hasCoachAssignment) return

    const nextFocusId = assignmentFocusMatch?.id ?? defaultFocusId
    const nextWorkType = requestedCard ? getCardLiveWorkType(requestedCard) : assignmentWorkType ?? 'court'
    const nextDrillId = requestedCard ? `card-${requestedCard.id}` : `${nextFocusId}-coach-${nextWorkType}`
    setAccessMode('coach_invited')
    setContext('coach')
    setWorkType(nextWorkType)
    setDraft((current) => ({ ...current, sharedWithCoach: true }))
    setSyncState({ status: 'idle', message: 'Coach challenge loaded. Rate and save after the work.' })
    setActiveFocusId(nextFocusId)
    setActiveDrillId(nextDrillId)
    setScoringDrillId('')
    setQuestCreditMessage('')
    setEditingStep(null)
  }, [assignmentFocusMatch, assignmentWorkType, defaultFocusId, hasCoachAssignment, requestedCard])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateSessionDock = () => {
      const flowAnchor = document.getElementById('level-up-flow')
      const flowAnchorTop = flowAnchor?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY
      const flowIsInView = flowAnchorTop <= window.innerHeight * 0.2
      setSessionDockActive(window.location.hash === '#level-up-flow' || flowIsInView || hasCoachAssignment || hasQuickStart)
    }

    updateSessionDock()
    const animationId = window.requestAnimationFrame(updateSessionDock)
    const timeoutId = window.setTimeout(updateSessionDock, 260)
    window.addEventListener('hashchange', updateSessionDock)
    window.addEventListener('scroll', updateSessionDock, { passive: true })
    return () => {
      window.cancelAnimationFrame(animationId)
      window.clearTimeout(timeoutId)
      window.removeEventListener('hashchange', updateSessionDock)
      window.removeEventListener('scroll', updateSessionDock)
    }
  }, [hasCoachAssignment, hasQuickStart])

  useEffect(() => {
    if (didHashAnchorScrollRef.current) return
    if (typeof window === 'undefined') return
    if (window.location.hash !== '#level-up-flow') return
    didHashAnchorScrollRef.current = true

    const scrollToFlow = () => {
      document.getElementById('level-up-flow')?.scrollIntoView({ block: 'start' })
    }
    const animationId = window.requestAnimationFrame(scrollToFlow)
    const timeoutId = window.setTimeout(scrollToFlow, 240)

    return () => {
      window.cancelAnimationFrame(animationId)
      window.clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    if (!hasCoachAssignment && !hasQuickStart) return
    if (didMobileAutoScrollRef.current) return
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(max-width: 860px)').matches) return
    if (window.location.hash === '#level-up-flow') return
    didMobileAutoScrollRef.current = true

    const id = window.setTimeout(() => {
      activityRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }, 180)

    return () => window.clearTimeout(id)
  }, [hasCoachAssignment, hasQuickStart])

  useEffect(() => {
    setSessions(readSavedSessions(storageKey))
  }, [storageKey])

  useEffect(() => {
    setSentProofRecapIds(readSentProofRecapIds(sentProofRecapStorageKey))
  }, [sentProofRecapStorageKey])

  useEffect(() => {
    setTomorrowStarterPlan(readTomorrowStarterPlan(tomorrowStarterStorageKey))
  }, [tomorrowStarterStorageKey])

  useEffect(() => {
    if (!activeDrill) {
      setProofCounter(0)
      return
    }

    setProofCounter(getProofCounter(activeDrill.id))
  }, [activeDrill])

  useEffect(() => {
    if (!activeDrill || lastSavedSession) return

    setDraft(readSessionDraft(levelUpDraftStorageKey(activeDrill.id), accessMode === 'coach_invited'))
  }, [activeDrill, lastSavedSession, accessMode])

  useEffect(() => {
    if (!activeDrill || lastSavedSession) return

    const key = levelUpDraftStorageKey(activeDrill.id)
    if (isEmptySessionDraft(draft, accessMode)) {
      window.sessionStorage.removeItem(key)
      return
    }

    window.sessionStorage.setItem(key, JSON.stringify(draft))
  }, [activeDrill, accessMode, draft, lastSavedSession])

  useEffect(() => {
    if (!lastSavedSession) return
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(max-width: 860px)').matches) return

    const id = window.setTimeout(() => {
      savedRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }, 80)

    return () => window.clearTimeout(id)
  }, [lastSavedSession])

  useEffect(() => {
    let active = true

    void (async () => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) return

      try {
        const response = await fetch('/api/player/level-up-sessions', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = (await response.json()) as { ok?: boolean; sessions?: RemoteLevelUpSession[] }
        if (!response.ok || !json.ok || !active) return

        const remoteSessions = (json.sessions ?? [])
          .filter((session) => session.identitySlug === identitySlug)
          .map(remoteToSavedSession)
        const merged = mergeSessions(remoteSessions, readSavedSessions(storageKey)).slice(0, 40)
        setSessions(merged)
        window.localStorage.setItem(storageKey, JSON.stringify(merged))
      } catch {
        if (active) {
          setSyncState({ status: 'local', message: 'Saved work will stay on this device until sync is available.' })
        }
      }
    })()

    return () => {
      active = false
    }
  }, [identitySlug, storageKey])

  useEffect(() => {
    const timers = queuedSyncTimersRef.current
    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId))
      timers.clear()
    }
  }, [])

  function chooseFocus(focusId: string) {
    clearActiveSessionDraft()
    setPressureRepeatCue('')
    setTomorrowStarterCheck(null)
    setActiveTomorrowStarterMode(null)
    setTomorrowStarterCompletion(null)
    setActiveFocusId(focusId)
    setActiveDrillId('')
    setDraft(getEmptySessionDraft(accessMode === 'coach_invited'))
    setSyncState({ status: 'idle', message: '' })
    setQuestCreditMessage('')
    setFinishSummary(null)
    setScoringDrillId('')
    setEditingStep('work')
  }

  function chooseContext(nextContext: TrainingContext) {
    clearActiveSessionDraft()
    setPressureRepeatCue('')
    setTomorrowStarterCheck(null)
    setActiveTomorrowStarterMode(null)
    setTomorrowStarterCompletion(null)
    setContext(nextContext)
    if (nextContext === 'coach') setWorkType('court')
    if (nextContext === 'doubles') setWorkType('court')
    setActiveDrillId('')
    setScoringDrillId('')
    setQuestCreditMessage('')
    setFinishSummary(null)
    showActivity()
  }

  function chooseWorkType(nextWorkType: WorkType) {
    clearActiveSessionDraft()
    setPressureRepeatCue('')
    setTomorrowStarterCheck(null)
    setActiveTomorrowStarterMode(null)
    setTomorrowStarterCompletion(null)
    const nextContextOptions = contextOptionsByWorkType[nextWorkType]
    setWorkType(nextWorkType)
    if (!nextContextOptions.includes(context)) {
      setContext(hasCoachAssignment ? 'coach' : nextContextOptions[0])
    }
    setActiveDrillId('')
    setScoringDrillId('')
    setQuestCreditMessage('')
    setFinishSummary(null)
    setEditingStep(hasCoachAssignment ? null : 'setup')
  }

  function chooseAccessMode(nextMode: AccessMode) {
    clearActiveSessionDraft()
    setPressureRepeatCue('')
    setTomorrowStarterCheck(null)
    setActiveTomorrowStarterMode(null)
    setTomorrowStarterCompletion(null)
    setAccessMode(nextMode)
    if (nextMode === 'coach_invited') {
      setDraft((current) => ({ ...current, sharedWithCoach: true }))
      setContext('coach')
    }
    if (nextMode === 'player_plus') {
      setDraft((current) => ({ ...current, sharedWithCoach: false }))
      if (context === 'coach') setContext('alone')
    }
    if (nextMode === 'free_preview') {
      setDraft((current) => ({ ...current, sharedWithCoach: false }))
      if (context === 'coach') setContext('alone')
    }
    setActiveDrillId('')
    setScoringDrillId('')
    setQuestCreditMessage('')
    setFinishSummary(null)
  }

  function chooseReadiness(nextReadiness: PlayerReadiness) {
    setReadiness(nextReadiness)
    setDraft((current) => ({ ...current, feeling: readinessFeeling[nextReadiness] }))
  }

  function addQuickNoteChip(note: string) {
    setDraft((current) => ({
      ...current,
      note: appendQuickNote(current.note, note),
    }))
  }

  function changeProofCounter(delta: number) {
    if (!activeDrill) return

    setProofCounter((current) => {
      const next = Math.max(0, Math.min(99, current + delta))
      window.sessionStorage.setItem(proofCounterStorageKey(activeDrill.id), String(next))
      return next
    })
  }

  function resetProofCounter() {
    if (!activeDrill) return

    setProofCounter(0)
    window.sessionStorage.removeItem(proofCounterStorageKey(activeDrill.id))
  }

  function saveSession() {
    if (draft.rating === null) return
    saveSessionWithRating(draft.rating)
  }

  function unlockProofSave() {
    saveReceiptLockRef.current = false
  }

  function saveSessionWithRating(rating: number) {
    if (!activeFocus || !activeDrill || hasActiveSaveReceipt || saveReceiptLockRef.current) return
    saveReceiptLockRef.current = true

    const nextDraft = { ...draft, rating }
    const savedSourceCard = activeDrill.sourceCard
    const savedElapsedSeconds = getTimerSeconds(activeDrill.id)
    const savedProofCounter = proofCounter
    const savedProofNote = savedProofCounter > 0 ? getProofCounterNote(savedProofCounter, proofTarget) : ''
    const savedPressureProofNote = pressureRepeatCue ? getPressureProofNote(pressureRepeatCue) : ''
    const completedTomorrowStarter = tomorrowStarterPlan && isTomorrowStarterMatch(tomorrowStarterPlan, activeDrill)
      ? tomorrowStarterPlan
      : null
    const savedStarterProofNote = completedTomorrowStarter ? getStarterProofNote(activeTomorrowStarterMode ?? 'first') : ''
    const savedStarterReadNotes = getStarterReadNotes(identityCourtsideRead)
    const nextSession: SavedSession = {
      id: `${Date.now()}-${activeFocus.id}-${activeDrill.id}`,
      focusId: activeFocus.id,
      focusTitle: activeFocus.title.replace(' Development', ''),
      workType,
      context,
      drillTitle: activeDrill.title,
      rating,
      feeling: nextDraft.feeling,
      accessMode,
      note: mergeProofNotes(nextDraft.note.trim(), savedProofNote, savedPressureProofNote, savedStarterProofNote, ...savedStarterReadNotes),
      elapsedSeconds: savedElapsedSeconds,
      sharedWithCoach: nextDraft.sharedWithCoach,
      completedAt: new Date().toISOString(),
      assignmentId: assignmentId || undefined,
      studentLinkId: studentLinkId || undefined,
      assignmentTitle: assignmentTitle || undefined,
      starterRead: {
        starterRep: identityCourtsideRead.starterRep,
        starterProofCue: identityCourtsideRead.starterProofCue,
        starterLeakWatch: identityCourtsideRead.starterLeakWatch,
        starterSmartNext: identityCourtsideRead.starterSmartNext,
      },
    }
    const nextSessions = [nextSession, ...sessions].slice(0, 40)
    setSessions(nextSessions)
    window.localStorage.setItem(storageKey, JSON.stringify(nextSessions))
    if (customQuestId && savedSourceCard) setQuestCreditMessage('Quest XP queued.')
    setLastSavedSession(nextSession)
    setUndoSession(nextSession)
    setRecapCopyStatus('idle')
    setRecapMode('text')
    setSelectedNextCueId('smart')
    setSelectedProofMomentId('practice')
    setSelectedCoachAskId('next')
    if (completedTomorrowStarter) {
      window.localStorage.removeItem(tomorrowStarterStorageKey)
      setTomorrowStarterPlan(null)
      setTomorrowStarterCheck(null)
      setActiveTomorrowStarterMode(null)
      setTomorrowStarterCompletion(getTomorrowStarterCompletion(completedTomorrowStarter, rating))
    }
    setPressureRepeatCue('')
    setFinishSummary(null)
    setDraft(getEmptySessionDraft(accessMode === 'coach_invited'))
    setScoringDrillId('')
    window.sessionStorage.removeItem(timerStorageKey(activeDrill.id))
    window.sessionStorage.removeItem(proofCounterStorageKey(activeDrill.id))
    window.sessionStorage.removeItem(levelUpDraftStorageKey(activeDrill.id))
    setProofCounter(0)
    setTimerResetSignal((signal) => signal + 1)
    setActiveTimerSnapshot({
      drillId: activeDrill.id,
      elapsedSeconds: 0,
      running: false,
      targetSeconds: activeDrill.timerSeconds,
    })
    setSyncState({ status: 'local', message: 'Saved on this device. Undo is available briefly; sync queues next.' })

    const syncTimerId = window.setTimeout(() => {
      queuedSyncTimersRef.current.delete(nextSession.id)
      setUndoSession((current) => current?.id === nextSession.id ? null : current)
      if (savedSourceCard) appendPortalCompletion(savedSourceCard, nextSession)
      if (customQuestId && savedSourceCard) {
        void syncCustomQuestCompletion(customQuestId, nextSession, savedSourceCard, identitySlug, setQuestCreditMessage)
      }
      setSyncState({ status: 'syncing', message: 'Saved on this device. Syncing now...' })
      void syncLevelUpSession(nextSession)
    }, LEVEL_UP_UNDO_WINDOW_MS)
    queuedSyncTimersRef.current.set(nextSession.id, syncTimerId)
  }

  function goToScore() {
    setEditingStep(null)
    setTomorrowStarterCheck(null)
    setScoringDrillId(activeDrill.id)
    window.setTimeout(() => {
      trackerRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }, 0)
  }

  function showActivity() {
    setEditingStep(null)
    setScoringDrillId('')
    window.setTimeout(() => {
      activityRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }, 0)
  }

  function showSavedRecap() {
    savedRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  function saveTomorrowStarterPlan() {
    if (!todayCloseoutRead) return

    const plannedDrill = drillOptions.find((drill) => drill.title === todayCloseoutRead.starterDrillTitle)
    const nextPlan: TomorrowStarterPlan = {
      focusId: todayCloseoutRead.starterFocusId,
      focusTitle: todayCloseoutRead.starterFocusTitle,
      workType: todayCloseoutRead.starterWorkType,
      context: todayCloseoutRead.starterContext,
      drillId: plannedDrill?.id ?? activeDrill.id,
      drillTitle: todayCloseoutRead.starterDrillTitle,
      cue: todayCloseoutRead.tomorrow,
      reason: todayCloseoutRead.starterReason,
      createdAt: new Date().toISOString(),
    }

    window.localStorage.setItem(tomorrowStarterStorageKey, JSON.stringify(nextPlan))
    setTomorrowStarterPlan(nextPlan)
    setActiveTomorrowStarterMode(null)
  }

  function loadTomorrowStarterPlan() {
    if (!tomorrowStarterPlan) return

    unlockProofSave()
    setLastSavedSession(null)
    setFinishSummary(null)
    setRecapCopyStatus('idle')
    setSelectedNextCueId('smart')
    setSelectedProofMomentId('practice')
    setSelectedCoachAskId('next')
    setPressureRepeatCue('')
    setActiveFocusId(tomorrowStarterPlan.focusId)
    setWorkType(tomorrowStarterPlan.workType)
    setContext(tomorrowStarterPlan.context)
    setActiveDrillId(tomorrowStarterPlan.drillId)
    setTomorrowStarterCheck(getTomorrowStarterCheck(tomorrowStarterPlan))
    setActiveTomorrowStarterMode('first')
    setScoringDrillId('')
    window.requestAnimationFrame(() => {
      starterCheckRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }

  function clearTomorrowStarterPlan() {
    window.localStorage.removeItem(tomorrowStarterStorageKey)
    setTomorrowStarterPlan(null)
    setTomorrowStarterCheck(null)
    setActiveTomorrowStarterMode(null)
  }

  function restoreTomorrowStarterPlan() {
    if (!tomorrowStarterCompletion) return

    const restoredPlan = tomorrowStarterCompletion.restoredPlan
    window.localStorage.setItem(tomorrowStarterStorageKey, JSON.stringify(restoredPlan))
    setTomorrowStarterPlan(restoredPlan)
    setActiveTomorrowStarterMode(null)
    setTomorrowStarterCompletion(null)
  }

  function runTomorrowStarterAgain() {
    if (!tomorrowStarterCompletion) return

    const restoredPlan = tomorrowStarterCompletion.restoredPlan
    window.localStorage.setItem(tomorrowStarterStorageKey, JSON.stringify(restoredPlan))
    unlockProofSave()
    setLastSavedSession(null)
    setFinishSummary(null)
    setRecapCopyStatus('idle')
    setSelectedNextCueId('smart')
    setSelectedProofMomentId('practice')
    setSelectedCoachAskId('next')
    setPressureRepeatCue('')
    setActiveFocusId(restoredPlan.focusId)
    setWorkType(restoredPlan.workType)
    setContext(restoredPlan.context)
    setActiveDrillId(restoredPlan.drillId)
    setTomorrowStarterPlan(restoredPlan)
    const starterMode = tomorrowStarterCompletion.rating >= 4 ? 'volume' : 'repeat'
    setTomorrowStarterCheck(getTomorrowStarterCheck(restoredPlan, starterMode))
    setActiveTomorrowStarterMode(starterMode)
    setTomorrowStarterCompletion(null)
    setScoringDrillId('')
    window.requestAnimationFrame(() => {
      starterCheckRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }

  function chooseDrillOption(drillId: string) {
    if (drillId === activeDrill.id) return
    if (activeTimerSnapshot?.drillId === activeDrill.id && activeTimerSnapshot.running) {
      const shouldSwitch = window.confirm('Switch drills? The current timer will reset to 0:00.')
      if (!shouldSwitch) return
    }
    clearActiveSessionDraft()
    setPressureRepeatCue('')
    setTomorrowStarterCheck(null)
    setActiveTomorrowStarterMode(null)
    setActiveDrillId(drillId)
    setScoringDrillId('')
    window.requestAnimationFrame(() => {
      activityRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }

  function repeatActivity() {
    unlockProofSave()
    setLastSavedSession(null)
    setRecapCopyStatus('idle')
    setSelectedNextCueId('smart')
    setSelectedProofMomentId('practice')
    setSelectedCoachAskId('next')
    setDraft(getEmptySessionDraft(accessMode === 'coach_invited'))
    setScoringDrillId('')
    setPressureRepeatCue('')
    setQuestCreditMessage('')
    setFinishSummary(null)
    activityRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  function pickNewFocus() {
    unlockProofSave()
    setLastSavedSession(null)
    setRecapCopyStatus('idle')
    setSelectedNextCueId('smart')
    setSelectedProofMomentId('practice')
    setSelectedCoachAskId('next')
    setDraft(getEmptySessionDraft(accessMode === 'coach_invited'))
    setActiveDrillId('')
    setScoringDrillId('')
    setPressureRepeatCue('')
    setQuestCreditMessage('')
    setFinishSummary(null)
    setEditingStep('focus')
    window.setTimeout(() => {
      document.getElementById('level-up-flow')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }, 0)
  }

  function moveToSuggestedDrill() {
    if (!suggestedNextDrill) return
    unlockProofSave()
    setLastSavedSession(null)
    setRecapCopyStatus('idle')
    setSelectedNextCueId('smart')
    setSelectedProofMomentId('practice')
    setSelectedCoachAskId('next')
    setPressureRepeatCue('')
    setFinishSummary(null)
    chooseDrillOption(suggestedNextDrill.id)
  }

  function startPressureRepeat() {
    unlockProofSave()
    setLastSavedSession(null)
    setRecapCopyStatus('idle')
    setSelectedNextCueId('smart')
    setSelectedProofMomentId('practice')
    setSelectedCoachAskId('next')
    setDraft(getEmptySessionDraft(accessMode === 'coach_invited'))
    setScoringDrillId('')
    setPressureRepeatCue(getPressureRepeatCue(activeDrill, readiness))
    setQuestCreditMessage('')
    setFinishSummary(null)
    setProofCounter(0)
    window.sessionStorage.removeItem(proofCounterStorageKey(activeDrill.id))
    window.setTimeout(() => {
      activityRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }, 0)
  }

  function runSmartNextPrimary() {
    if (!smartNextAction) {
      repeatActivity()
      return
    }

    if (smartNextAction.decision === 'Add pressure') {
      if (suggestedNextDrill) {
        moveToSuggestedDrill()
        return
      }

      startPressureRepeat()
      return
    }

    if (smartNextAction.decision === 'Recover' || smartNextAction.decision === 'Finish') {
      finishToday()
      return
    }

    repeatActivity()
  }

  function finishToday() {
    unlockProofSave()
    setFinishSummary(sessions.filter(isSessionFromToday).slice(0, 6))
    setLastSavedSession(null)
    setRecapCopyStatus('idle')
    setSelectedNextCueId('smart')
    setSelectedProofMomentId('practice')
    setSelectedCoachAskId('next')
    setPressureRepeatCue('')
    setQuestCreditMessage('')
    window.setTimeout(() => {
      finishRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }, 0)
  }

  function undoLastSave() {
    if (!undoSession) return
    unlockProofSave()

    const sessionId = undoSession.id
    const queuedTimerId = queuedSyncTimersRef.current.get(sessionId)
    if (queuedTimerId) {
      window.clearTimeout(queuedTimerId)
      queuedSyncTimersRef.current.delete(sessionId)
    }

    setSessions((current) => {
      const next = current.filter((session) => session.id !== sessionId)
      window.localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
    removePortalCompletion(sessionId)
    setSentProofRecapIds((current) => {
      const next = current.filter((id) => id !== sessionId)
      window.localStorage.setItem(sentProofRecapStorageKey, JSON.stringify(next))
      return next
    })
    setUndoSession(null)
    setFinishSummary(null)
    setRecapCopyStatus('idle')
    setSelectedNextCueId('smart')
    setSelectedProofMomentId('practice')
    setSelectedCoachAskId('next')
    setPressureRepeatCue('')
    setQuestCreditMessage('')
    setLastSavedSession((current) => current?.id === sessionId ? null : current)
    setSyncState({ status: 'local', message: 'Last log undone before sync.' })
  }

  function clearActiveSessionDraft() {
    if (!activeDrill) return
    window.sessionStorage.removeItem(levelUpDraftStorageKey(activeDrill.id))
  }

  function discardSessionDraft() {
    clearActiveSessionDraft()
    setDraft(getEmptySessionDraft(accessMode === 'coach_invited'))
    setSyncState({ status: 'idle', message: 'Draft cleared on this phone.' })
  }

  async function copySavedProofRecap() {
    if (!savedProofRecap) return

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(savedProofRecap)
      setRecapCopyStatus('copied')
    } catch {
      setRecapCopyStatus('manual')
    }
  }

  async function shareSavedProofRecap() {
    if (!savedProofRecap) return

    if (typeof navigator.share === 'function') {
      try {
        setRecapCopyStatus('shared')
        await navigator.share({
          title: 'Level Up proof recap',
          text: savedProofRecap,
        })
        return
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          setRecapCopyStatus('idle')
          return
        }
      }
    }

    await copySavedProofRecap()
  }

  function chooseSavedNextCue(cueId: SavedNextCueId) {
    setSelectedNextCueId(cueId)
    setRecapCopyStatus('idle')
    clearSentMarkerForLastSavedSession()
  }

  function chooseSavedProofMoment(momentId: SavedProofMomentId) {
    setSelectedProofMomentId(momentId)
    setRecapCopyStatus('idle')
    clearSentMarkerForLastSavedSession()
  }

  function chooseSavedCoachAsk(askId: SavedCoachAskId) {
    setSelectedCoachAskId(askId)
    setRecapCopyStatus('idle')
    clearSentMarkerForLastSavedSession()
  }

  function chooseRecapMode(nextMode: RecapMode) {
    setRecapMode(nextMode)
    setRecapCopyStatus('idle')
    clearSentMarkerForLastSavedSession()
  }

  function clearSentMarkerForLastSavedSession() {
    if (!lastSavedSession) return
    setSentProofRecapIds((current) => {
      if (!current.includes(lastSavedSession.id)) return current

      const next = current.filter((id) => id !== lastSavedSession.id)
      window.localStorage.setItem(sentProofRecapStorageKey, JSON.stringify(next))
      return next
    })
  }

  function markSavedProofRecapSent() {
    if (!lastSavedSession) return

    setSentProofRecapIds((current) => {
      if (current.includes(lastSavedSession.id)) return current

      const next = [lastSavedSession.id, ...current].slice(0, 60)
      window.localStorage.setItem(sentProofRecapStorageKey, JSON.stringify(next))
      return next
    })
  }

  function undoSavedProofRecapSent() {
    if (!lastSavedSession) return

    setSentProofRecapIds((current) => {
      if (!current.includes(lastSavedSession.id)) return current

      const next = current.filter((id) => id !== lastSavedSession.id)
      window.localStorage.setItem(sentProofRecapStorageKey, JSON.stringify(next))
      return next
    })
    setRecapCopyStatus('unsent')
  }

  async function syncLevelUpSession(session: SavedSession) {
    if (session.accessMode === 'free_preview') {
      setSyncState({ status: 'local', message: `Free preview saved locally. Coach invite or ${PLAYER_TIER_NAME} turns on cloud history.` })
      return
    }

    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      setSyncState({ status: 'local', message: `Saved locally. Sign in from a coach invite or ${PLAYER_TIER_NAME} to sync it.` })
      return
    }

    try {
      const response = await fetch('/api/player/level-up-sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session: { ...session, identitySlug } }),
      })
      const json = (await response.json()) as { ok?: boolean; message?: string }
      if (!response.ok || !json.ok) {
        throw new Error(json.message || 'Could not sync this Level Up log yet.')
      }

      setSyncState({
        status: 'synced',
        message:
          session.assignmentId
            ? 'Synced. Coach assignment progress updated for review.'
            : session.accessMode === 'coach_invited' && session.sharedWithCoach
            ? 'Synced. Your linked coach can use this for the next lesson.'
            : 'Synced to your Level Up history.',
      })
    } catch (error) {
      setSyncState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Saved locally. Cloud sync can retry next time.',
      })
    }
  }

  if (!activeFocus || !activeDrill) return null

  const assignmentStatusSteps = hasCoachAssignment
    ? [
        {
          label: 'Assigned',
          detail: assignmentTitle || activeDrill.title,
          done: true,
        },
        {
          label: 'Started',
          detail: activeTimerSeconds > 0 ? formatClock(activeTimerSeconds) : lastSavedSession ? 'Proof saved' : 'Ready to begin',
          done: activeTimerSeconds > 0 || Boolean(lastSavedSession),
        },
        {
          label: 'Logged',
          detail: lastSavedSession ? `${lastSavedSession.rating}/5 saved` : 'Save proof to log',
          done: Boolean(lastSavedSession),
        },
        {
          label: 'Shared with coach',
          detail: syncState.status === 'synced' ? 'Synced' : 'Syncs after save',
          done: syncState.status === 'synced' && Boolean(lastSavedSession?.sharedWithCoach),
        },
      ]
    : []
  const assignmentPlayerIdRead = hasCoachAssignment
    ? [
        {
          label: 'Train first',
          detail: assignmentFocus || activeDrill.summary || activeFocus.cue,
        },
        {
          label: 'Proof target',
          detail: activeDrill.proof || 'Rate the rep 0-5 and save the one visible tennis signal.',
        },
        {
          label: 'Coach follow-up',
          detail: 'Send what changed, what leaked, and the next rep you want assigned.',
        },
      ]
    : []

  return (
    <section className={styles.liveWorkbench} data-assignment={hasCoachAssignment ? 'true' : 'false'} aria-labelledby="live-workbench-title">
      <div className={styles.liveWorkbenchHero}>
        <div>
          <span>Level Up</span>
          <h2 id="live-workbench-title">What do you want to level up right now?</h2>
          <p>{identityTitle.replace(/^The /, '')}: {mantra}</p>
        </div>
        <div className={styles.liveHeroActions}>
          <a className="button-primary" href="#level-up-flow">Start level up</a>
          <a className="button-secondary" href="/mylab#coach-assignments">Coach challenges</a>
        </div>
      </div>

      <div id="level-up-flow" className={styles.liveFlowAnchor} aria-hidden="true" />

      {activeResumeStrip ? (
        <div className={styles.liveActiveResumeStrip} data-state={activeResumeStrip.state} aria-label="Active courtside session resume">
          <div>
            <span>Resume session</span>
            <strong>{activeResumeStrip.title}</strong>
            <p>{activeResumeStrip.detail}</p>
          </div>
          <button
            type="button"
            className={activeResumeStrip.action === 'score' ? 'button-primary' : 'button-secondary'}
            onClick={activeResumeStrip.action === 'score' ? goToScore : showActivity}
          >
            {activeResumeStrip.actionLabel}
          </button>
        </div>
      ) : tomorrowStarterPlan ? (
        <div className={styles.liveActiveResumeStrip} data-state="starter" aria-label="Saved starter courtside resume">
          <div>
            <span>Saved starter</span>
            <strong>{tomorrowStarterPlan.drillTitle}</strong>
            <p>{tomorrowStarterPlan.cue}</p>
          </div>
          <button type="button" className="button-primary" onClick={loadTomorrowStarterPlan}>
            Load rep
          </button>
        </div>
      ) : null}

      <div className={styles.liveCompactSummary} aria-label="Current Level Up path">
        <span>{hasCoachAssignment ? 'Coach challenge' : 'Ready now'}</span>
        <strong>{hasCoachAssignment ? assignmentTitle || activeDrill.title : activeFocus.title.replace(' Development', '')}</strong>
        <p>{workTypeLabels[workType]} / {contextLabels[context]}</p>
        <div className={styles.liveCompactEdits} aria-label="Change Level Up choices">
          <button type="button" data-active={editingStep === 'focus' ? 'true' : 'false'} onClick={() => setEditingStep('focus')}>
            Focus
          </button>
          <button type="button" data-active={editingStep === 'work' ? 'true' : 'false'} onClick={() => setEditingStep('work')}>
            Work
          </button>
          <button type="button" data-active={editingStep === 'setup' ? 'true' : 'false'} onClick={() => setEditingStep('setup')}>
            Setup
          </button>
        </div>
      </div>

      <div className={styles.liveIdentityCourtRead} aria-label="Player ID courtside read">
        <article>
          <span>First rep</span>
          <strong>{identityCourtsideRead.starterRep}</strong>
        </article>
        <article>
          <span>Proof cue</span>
          <strong>{identityCourtsideRead.starterProofCue}</strong>
        </article>
        <article data-state="watch">
          <span>Leak watch</span>
          <strong>{identityCourtsideRead.starterLeakWatch}</strong>
        </article>
        <article data-state="next">
          <span>Smart next</span>
          <strong>{identityCourtsideRead.starterSmartNext}</strong>
        </article>
      </div>

      <div className={styles.liveCourtsideResume} data-state={hasActiveSaveReceipt ? 'saved' : scoringDrillId === activeDrill.id ? 'scoring' : 'active'} aria-label="Courtside resume card">
        <div>
          <span>Courtside resume</span>
          <strong>{hasActiveSaveReceipt ? 'Proof saved. Choose repeat or new focus.' : activeDrill.title}</strong>
          <p>{shortenDrillStep(activeDrill.proof)}</p>
          <small className={styles.liveCourtsideResumeStatus} role="status" aria-live="polite">
            {courtsideResumeStatus}
          </small>
        </div>
        <div className={styles.liveCourtsideResumeGrid}>
          {courtsideResumeItems.map((item) => (
            <article key={item.label} data-state={item.state}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
        <div className={styles.liveCourtsideResumeActions}>
          {hasActiveSaveReceipt ? (
            <>
              <button type="button" className="button-primary" onClick={repeatActivity}>
                Repeat
              </button>
              <button type="button" className="button-secondary" onClick={pickNewFocus}>
                New focus
              </button>
              <button type="button" className="button-secondary" onClick={showSavedRecap}>
                {savedProofRecapSent ? 'Sent recap' : 'Recap'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="button-secondary" onClick={showActivity}>
                Drill
              </button>
              <button type="button" className="button-primary" onClick={goToScore}>
                Score
              </button>
            </>
          )}
        </div>
      </div>

      <div className={styles.liveTodayCommandCenter} aria-label="One-thumb Level Up today mode">
        <div className={styles.liveTodayCommandHeader}>
          <div>
            <span>Today mode</span>
            <strong>{activeDrill.title}</strong>
            <p>{readinessOptions[readiness].copy}</p>
          </div>
          <div className={styles.liveTodayStreakPill}>
            <span>Streak</span>
            <strong>{drillDayStreak || '-'}</strong>
          </div>
        </div>
        <div className={styles.liveReadinessToggle} aria-label="Choose today's readiness">
          {(Object.keys(readinessOptions) as PlayerReadiness[]).map((key) => (
            <button
              type="button"
              key={key}
              data-active={readiness === key ? 'true' : 'false'}
              onClick={() => chooseReadiness(key)}
            >
              {readinessOptions[key].label}
            </button>
          ))}
        </div>
        <div className={styles.liveTodayCommandStats} aria-label="Today command stats">
          <article>
            <span>Timer</span>
            <strong>{formatClock(activeTimerSeconds)}</strong>
          </article>
          <article>
            <span>Done</span>
            <strong>{todaySessions.length}</strong>
          </article>
          <article>
            <span>Clean</span>
            <strong>{proofCounter}/{proofTarget}</strong>
          </article>
          <article>
            <span>Next</span>
            <strong>{smartNextAction ? 'Ready' : 'Start'}</strong>
          </article>
        </div>
        <div className={styles.liveTodayCommandActions}>
          <button type="button" className="button-primary" onClick={showActivity}>
            Start work
          </button>
          <button type="button" className="button-secondary" onClick={goToScore}>
            Score
          </button>
          <button type="button" className="button-secondary" disabled={!todaySessions.length} onClick={finishToday}>
            Finish
          </button>
        </div>
        {todayCloseoutRead ? (
          <div className={styles.liveTodayCloseoutRead} aria-label="Today closeout read">
            <span>Today read</span>
            <div>
              <article>
                <span>Best proof</span>
                <strong>{todayCloseoutRead.bestProof}</strong>
              </article>
              <article data-state={todayCloseoutRead.pressureProof === 'No pressure proof yet' ? 'quiet' : 'pressure'}>
                <span>Pressure</span>
                <strong>{todayCloseoutRead.pressureProof}</strong>
              </article>
              <article>
                <span>Tomorrow</span>
                <strong>{todayCloseoutRead.tomorrow}</strong>
              </article>
            </div>
            <div className={styles.liveTodayCloseoutActions}>
              <button type="button" className="button-primary" disabled={tomorrowStarterSaved} onClick={saveTomorrowStarterPlan}>
                {tomorrowStarterSaved ? 'Saved starter' : 'Save starter'}
              </button>
            </div>
          </div>
        ) : null}
        {tomorrowStarterPlan ? (
          <div className={styles.liveTomorrowStarterPlan} aria-label="Saved tomorrow starter">
            <div>
              <span>Tomorrow starter</span>
              <strong>{tomorrowStarterPlan.drillTitle}</strong>
              <p>{tomorrowStarterPlan.cue}</p>
              <small>{tomorrowStarterPlan.reason}</small>
            </div>
            <div className={styles.liveTomorrowStarterActions}>
              <button type="button" className="button-primary" onClick={loadTomorrowStarterPlan}>
                Load rep
              </button>
              <button type="button" className="button-secondary" onClick={clearTomorrowStarterPlan}>
                Clear
              </button>
            </div>
          </div>
        ) : null}
        {tomorrowStarterCheck ? (
          <div ref={starterCheckRef} className={styles.liveTomorrowStarterCheck} aria-label="Loaded starter first rep check">
            <div>
              <span>{tomorrowStarterCheck.label}</span>
              <strong>{tomorrowStarterCheck.drillTitle}</strong>
            </div>
            <div className={styles.liveTomorrowStarterCheckGrid}>
              <article>
                <span>Cue</span>
                <strong>{tomorrowStarterCheck.cue}</strong>
              </article>
              <article>
                <span>Proof</span>
                <strong>{tomorrowStarterCheck.proof}</strong>
              </article>
              <article>
                <span>Stop</span>
                <strong>{tomorrowStarterCheck.stopRule}</strong>
              </article>
            </div>
            <div className={styles.liveTomorrowStarterCheckActions}>
              <button type="button" className="button-primary" onClick={goToScore}>
                {tomorrowStarterCheck.scoreLabel}
              </button>
              <button type="button" className="button-secondary" onClick={() => setTomorrowStarterCheck(null)}>
                Hide
              </button>
            </div>
          </div>
        ) : null}
        {tomorrowStarterCompletion ? (
          <div className={styles.liveTomorrowStarterDone} aria-label="Tomorrow starter completed">
            <div>
              <span>Starter done</span>
              <strong>{tomorrowStarterCompletion.drillTitle} {tomorrowStarterCompletion.rating}/5</strong>
              <p>{tomorrowStarterCompletion.next}</p>
            </div>
            <div className={styles.liveTomorrowStarterDoneActions}>
              <button type="button" className="button-primary" onClick={runTomorrowStarterAgain}>
                {tomorrowStarterCompletion.actionLabel}
              </button>
              <button type="button" className="button-secondary" onClick={restoreTomorrowStarterPlan}>
                Restore starter
              </button>
              <button type="button" className="button-secondary" onClick={() => setTomorrowStarterCompletion(null)}>
                Clear
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <nav className={styles.liveSessionDock} data-active={sessionDockActive ? 'true' : 'false'} aria-label="Level Up bottom session dock">
        <a href="#level-up-flow">Today</a>
        <button type="button" onClick={showActivity}>Drill</button>
        <button type="button" onClick={goToScore}>Score</button>
        <button type="button" disabled={!todaySessions.length} onClick={finishToday}>Finish</button>
      </nav>

      {todaySessions.length ? (
        <div className={styles.liveTodayStack} aria-label="Today's completed drill stack">
          <span>Today&apos;s stack</span>
          <div>
            {todaySessions.map((session) => (
              <article key={session.id}>
                <strong>{session.drillTitle}</strong>
                <small>{session.rating}/5 - {formatClock(session.elapsedSeconds)}</small>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {!hasCoachAssignment ? (
        <div className={styles.liveCoachChallengeEntry}>
          <div>
            <span>Coach challenges</span>
            <strong>Assigned work lives separately.</strong>
          </div>
          <a className="button-secondary" href="/mylab#coach-assignments">Open</a>
        </div>
      ) : null}

      <div className={styles.liveCoachLoop} aria-label="Coach linked training loop">
        <article>
          <span>Coach invite</span>
          <strong>Text link connects player, coach, and identity.</strong>
          <p>Free players can accept the link, see assigned work, and send simple check-ins.</p>
        </article>
        <article>
          <span>Shared plan</span>
          <strong>Coach and player agree on the focus map.</strong>
          <p>Serve, movement, fitness, mental routine, doubles, and match habits all pull into one plan.</p>
        </article>
        <article>
          <span>{PLAYER_TIER_NAME} unlock</span>
          <strong>Saved history, trends, and recommendations.</strong>
          <p>{PLAYER_TIER_NAME} turns quick logs into My Lab progress, match evidence, and next-focus intelligence.</p>
        </article>
      </div>

      {hasCoachAssignment ? (
        <div className={styles.liveAssignmentBanner} role="status">
          <div>
            <span>Coach challenge loaded</span>
            <strong>{assignmentTitle || activeDrill.title}</strong>
            <p>{workTypeLabels[workType]} is ready. Do the work, rate it 0-5, add one tiny note if it helps, and save. When linked, this marks the assignment complete for your coach.</p>
          </div>
          <a className="button-secondary" href="/mylab#coach-assignments">Back to My Lab</a>
        </div>
      ) : null}

      {assignmentPlayerIdRead.length ? (
        <div className={styles.liveAssignmentPlayerIdRead} aria-label="Level Up coach assignment Player ID read">
          <div>
            <span>Player ID assignment read</span>
            <strong>Turn the coach link into one train / proof / ask loop.</strong>
            <p>Stay on the assigned rep, save the proof, then give the coach a clear next action.</p>
          </div>
          <div className={styles.liveAssignmentPlayerIdGrid}>
            {assignmentPlayerIdRead.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong>{item.detail}</strong>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {assignmentStatusSteps.length ? (
        <div className={styles.liveAssignmentStatusRail} aria-label="Player assignment status">
          {assignmentStatusSteps.map((step) => (
            <article key={step.label} data-done={step.done ? 'true' : 'false'}>
              <span>{step.label}</span>
              <strong>{step.detail}</strong>
            </article>
          ))}
        </div>
      ) : null}

      <div className={styles.liveAccessPanel} aria-label="Choose Level Up access path">
        <div>
          <span>Access path</span>
          <strong>{activeAccess.title}</strong>
          <p>{activeAccess.copy}</p>
        </div>
        <div className={styles.liveAccessGrid}>
          {(Object.keys(accessModes) as AccessMode[]).map((mode) => (
            <button
              type="button"
              key={mode}
              data-active={accessMode === mode ? 'true' : 'false'}
              onClick={() => chooseAccessMode(mode)}
            >
              <span>{accessModes[mode].label}</span>
              <strong>{accessModes[mode].action}</strong>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.liveModeStrip} aria-label="Phone first training steps">
        <span>Focus</span>
        <span>On / Off court</span>
        <span>Setup</span>
        <span>Go</span>
      </div>

      <div className={styles.liveTrainingFlow}>
        <div className={styles.liveStepPanel} data-collapsed={editingStep !== 'focus' ? 'true' : 'false'}>
          <span>1. Focus</span>
          <strong>Choose today&apos;s target.</strong>
          <div className={styles.liveFocusRail} aria-label="Choose a training focus">
            {playableFocuses.map((focus) => (
              <button
                type="button"
                key={focus.id}
                className={styles.liveFocusButton}
                data-active={focus.id === activeFocus.id ? 'true' : 'false'}
                onClick={() => chooseFocus(focus.id)}
              >
                <strong>{focus.title.replace(' Development', '')}</strong>
                <span>{focus.cue}</span>
              </button>
            ))}
            <a className={styles.liveFocusButton} href="/mylab#coach-assignments">
              <strong>Coach challenges</strong>
              <span>Go to assigned modules from your linked coach.</span>
            </a>
          </div>
        </div>

        <div className={styles.liveStepPanel} data-collapsed={editingStep !== 'setup' ? 'true' : 'false'}>
          <span>3. Setup</span>
          <strong>Who is training with you?</strong>
          <div className={styles.liveContextGrid} aria-label="Choose training setup">
            {contextOptions.map((key) => (
              <button
                type="button"
                key={key}
                data-active={context === key ? 'true' : 'false'}
                onClick={() => chooseContext(key)}
              >
                {contextLabels[key]}
              </button>
            ))}
          </div>
          <div className={styles.liveSetupActions}>
            <span>Selected: {contextLabels[context]}</span>
            <button type="button" className="button-primary" onClick={showActivity}>
              Start activity
            </button>
          </div>
        </div>

        <div className={styles.liveWorkbenchBody} data-flow-state={editingStep ?? 'drill'} data-scoring={scoringDrillId === activeDrill.id ? 'true' : 'false'}>
          <div className={styles.liveLaneColumn} data-collapsed={editingStep !== 'work' ? 'true' : 'false'}>
            <div className={styles.liveCurrentGoal}>
              <span>2. On court / off court</span>
              <strong>{activeFocus.title}</strong>
              <p>{activeFocus.cue}</p>
            </div>
            <div className={styles.liveLaneTabs} aria-label="Choose work type">
              {(Object.keys(workTypeLabels) as WorkType[]).map((key) => (
                <button
                  type="button"
                  key={key}
                  data-active={workType === key ? 'true' : 'false'}
                  onClick={() => chooseWorkType(key)}
                >
                  {workTypeLabels[key]}
                </button>
              ))}
            </div>
          </div>

          <article ref={activityRef} className={styles.liveActionCard} id="level-up-activity">
            <span>{workTypeLabels[activeDrill.workType]} / {contextLabels[activeDrill.context]}</span>
            <h3>{activeDrill.title}</h3>
            <p>{activeDrill.summary}</p>
            <div className={styles.liveCourtsideCommand} aria-label="Current courtside command">
              <article data-state="now">
                <span>Now</span>
                <strong>{activeCourtsideCommand.now}</strong>
              </article>
              <article data-state="count">
                <span>Count</span>
                <strong>{activeCourtsideCommand.count}</strong>
              </article>
              <article data-state="stop">
                <span>Stop</span>
                <strong>{activeCourtsideCommand.stop}</strong>
              </article>
            </div>
            <div className={styles.liveDrillSteps} aria-label="Drill actions">
              {activeDrillSteps.map((step, index) => (
                <div key={`${activeDrill.id}-${step}`}>
                  <span>{getActionStepLabel(index)}</span>
                  <strong>{step}</strong>
                </div>
              ))}
            </div>
            <div className={styles.liveMicroPlan}>
              <span>{activeDrill.sourceCard ? 'Cue' : 'Watch'}</span>
              <strong>{activeDrill.sourceCard?.cue ?? activeFocus.tracker[0] ?? 'Proof rating'}</strong>
              {activeDrill.sourceCard ? <p>{activeDrill.sourceCard.reward}</p> : null}
            </div>
            {activeDrill.sourceCard ? (
              <div className={styles.liveQualityGrid} aria-label="Quality standards for this activity">
                <div>
                  <span>Work block</span>
                  <strong>{getCardWorkBlock(activeDrill.sourceCard)}</strong>
                </div>
                <div>
                  <span>Counts when</span>
                  <strong>{getCardQualityStandard(activeDrill.sourceCard)}</strong>
                </div>
                <div>
                  <span>Fix first</span>
                  <strong>{getCardCommonMiss(activeDrill.sourceCard)}</strong>
                </div>
              </div>
            ) : null}
            {activeDrill.sourceCard ? (
              <div className={styles.liveAdjustmentPanel}>
                <div>
                  <span>Level up</span>
                  <p>{activeDrill.sourceCard.progression}</p>
                </div>
                <div>
                  <span>Scale down</span>
                  <p>{activeDrill.sourceCard.regression}</p>
                </div>
                {activeDrill.sourceCard.safetyNote ? <small>{activeDrill.sourceCard.safetyNote}</small> : null}
              </div>
            ) : null}
            {pressureRepeatCue ? (
              <div className={styles.livePressureRepeatCue} aria-label="Pressure repeat cue">
                <div>
                  <span>Pressure repeat</span>
                  <strong>{pressureRepeatCue}</strong>
                  <p>Run one score-pressure rep, then save the next proof.</p>
                </div>
                <button type="button" className="button-secondary" onClick={goToScore}>
                  Score it
                </button>
              </div>
            ) : null}
            <div className={styles.liveProofCounter} data-complete={proofCounter >= proofTarget ? 'true' : 'false'} aria-label="One-thumb proof counter">
              <div>
                <span>Proof counter</span>
                <strong>{proofCounter}/{proofTarget} clean</strong>
                <p>Tap +1 only when the proof behavior shows up. The count is saved into the proof note.</p>
              </div>
              <div className={styles.liveProofCounterActions}>
                <button type="button" className="button-secondary" disabled={proofCounter === 0} onClick={() => changeProofCounter(-1)} aria-label="Remove one clean proof rep">
                  -1
                </button>
                <button type="button" className="button-primary" onClick={() => changeProofCounter(1)} aria-label="Add one clean proof rep">
                  +1
                </button>
                <button type="button" className="button-secondary" disabled={proofCounter === 0} onClick={resetProofCounter}>
                  Reset
                </button>
              </div>
            </div>
            <div className={styles.liveActionGuide}>
              <strong>Time</strong>
              <p>{activeDrill.duration}</p>
            </div>
            <DrillTimer
              drillId={activeDrill.id}
              drillTitle={activeDrill.title}
              targetSeconds={activeDrill.timerSeconds}
              resetSignal={timerResetSignal}
              onDone={goToScore}
              onSnapshotChange={handleTimerSnapshotChange}
            />
            <div className={`${styles.liveActionGuide} ${styles.liveScoreGuide}`}>
              <div>
                <strong>Score this</strong>
                <p>{activeDrill.proof}</p>
              </div>
              <button type="button" className="button-primary" onClick={goToScore}>
                Score now
              </button>
            </div>
            <div className={styles.liveDrillChoices}>
              {visibleDrills.map((drill) => (
                <button
                  type="button"
                  key={drill.id}
                  data-active={drill.id === activeDrill.id ? 'true' : 'false'}
                  onClick={() => chooseDrillOption(drill.id)}
                >
                  <strong>{drill.title}</strong>
                  <span>{drill.duration}</span>
                  <small>{shortenDrillStep(drill.proof)}</small>
                </button>
              ))}
            </div>
            <div className={styles.liveActionLinks}>
              <a className="button-primary" href={activeDrill.href}>Guide</a>
              <a className="button-secondary" href="/mylab#coach-assignments">Send to coach</a>
            </div>
          </article>

          <aside ref={trackerRef} className={styles.liveTracker} aria-label="Quick tracking">
            <span>3. Submit</span>
            <strong>Score and save.</strong>
            <div className={styles.liveQuickScoreDock} aria-label="One tap score and save">
              <div>
                <span>Quick score</span>
                <strong>{activeDrill.title}</strong>
              </div>
              {[5, 4, 3].map((value) => (
                <button
                  type="button"
                  key={value}
                  className={value === 5 ? 'button-primary' : 'button-secondary'}
                  disabled={hasActiveSaveReceipt}
                  onClick={() => saveSessionWithRating(value)}
                >
                  {value}/5
                </button>
              ))}
            </div>
            <div className={styles.liveProofRubric} aria-label="Proof rating guide">
              {getLiveProofRubric(activeDrill.sourceCard).map((item) => (
                <div key={item.value}>
                  <span>{item.value}</span>
                  <strong>{item.label}</strong>
                </div>
              ))}
            </div>
            <div className={styles.liveFeelingGrid} aria-label="How do you feel right now?">
              {(Object.keys(feelingLabels) as PlayerFeeling[]).map((feeling) => (
                <button
                  type="button"
                  key={feeling}
                  data-active={draft.feeling === feeling ? 'true' : 'false'}
                  onClick={() => setDraft({ ...draft, feeling })}
                >
                  {feelingLabels[feeling]}
                </button>
              ))}
            </div>
            <div className={styles.liveRatingButtons} aria-label="Rate this work from 0 to 5">
              {[0, 1, 2, 3, 4, 5].map((value) => (
                <button
                  type="button"
                  key={value}
                  data-active={draft.rating === value ? 'true' : 'false'}
                  onClick={() => setDraft({ ...draft, rating: value })}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className={styles.liveQuickNoteChips} aria-label="One tap tracking notes">
              <span>Tap note</span>
              <div>
                {quickNoteChips.map((chip) => (
                  <button
                    type="button"
                    key={chip}
                    className="button-secondary"
                    data-active={draft.note.includes(chip) ? 'true' : 'false'}
                    onClick={() => addQuickNoteChip(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={draft.note}
              maxLength={220}
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
              placeholder="Optional: what helped, what to repeat."
              aria-label="Tiny tracking note"
            />
            <label className={styles.liveShareToggle}>
              <input
                type="checkbox"
                checked={accessMode === 'coach_invited' ? draft.sharedWithCoach : false}
                disabled={accessMode !== 'coach_invited'}
                onChange={(event) => setDraft({ ...draft, sharedWithCoach: event.target.checked })}
              />
              <span>{accessMode === 'coach_invited' ? 'Share this recap with my coach when linked' : 'Coach sharing unlocks when invited by a coach'}</span>
            </label>
            <div className={styles.liveDraftActions}>
              <button type="button" className="button-primary" disabled={draft.rating === null || hasActiveSaveReceipt} onClick={saveSession}>
                {hasActiveSaveReceipt ? 'Saved' : syncState.status === 'syncing' ? 'Saving...' : draft.rating === null ? 'Pick rating' : `Save ${draft.rating}/5`}
              </button>
              {hasUnsavedSessionDraft && !hasActiveSaveReceipt ? (
                <button type="button" className="button-secondary" aria-label="Clear saved scoring draft" onClick={discardSessionDraft}>
                  Clear draft
                </button>
              ) : null}
            </div>
            <small>{hasActiveSaveReceipt ? 'Use Repeat or New focus before logging another proof.' : draft.rating === null ? 'Pick a 0-5 rating before saving.' : 'It saves locally first, then syncs when your access path is connected.'}</small>
          </aside>
        </div>
      </div>

      {lastSavedSession ? (
        <>
          <div className={styles.liveSessionToast} role="status" aria-label="Saved session summary">
            <div>
              <span>+ Work logged</span>
              <strong>{lastSavedSession.rating}/5 - {formatClock(lastSavedSession.elapsedSeconds)}</strong>
              <small>{lastSavedSession.drillTitle}</small>
            </div>
            <button type="button" className="button-secondary" onClick={repeatActivity}>
              Repeat
            </button>
            {undoSession?.id === lastSavedSession.id ? (
              <button type="button" className="button-secondary" onClick={undoLastSave}>
                Undo
              </button>
            ) : null}
            <button type="button" className="button-primary" onClick={pickNewFocus}>
              New
            </button>
          </div>
          {smartNextAction ? (
            <div className={styles.liveNextActionCard} aria-label="Next best action">
              <div>
                <span>Next best action</span>
                <strong>{smartNextAction.title}</strong>
                <p>{smartNextAction.copy}</p>
                <div className={styles.liveNextActionSignals} aria-label="Next action decision signals">
                  <article data-state={smartNextAction.decision.toLowerCase().replace(' ', '-')}>
                    <span>Decision</span>
                    <strong>{smartNextAction.decision}</strong>
                  </article>
                  <article>
                    <span>Why</span>
                    <strong>{smartNextAction.reason}</strong>
                  </article>
                  <article>
                    <span>Load</span>
                    <strong>{smartNextAction.load}</strong>
                  </article>
                </div>
              </div>
              <div className={styles.liveNextActionButtons}>
                <button type="button" className="button-primary" onClick={runSmartNextPrimary}>
                  {smartNextAction.primaryLabel}
                </button>
                {suggestedNextDrill ? (
                  <button type="button" className="button-secondary" onClick={moveToSuggestedDrill}>
                    Paired drill
                  </button>
                ) : null}
                <button type="button" className="button-secondary" onClick={finishToday}>
                  Finish
                </button>
              </div>
            </div>
          ) : null}
          <div ref={savedRef} className={styles.liveSavedBanner} role="status">
            <div>
              <span>Saved</span>
              <strong>{lastSavedSession.focusTitle}: {lastSavedSession.drillTitle}</strong>
              <p>
                {lastSavedSession.rating}/5, {formatClock(lastSavedSession.elapsedSeconds)}, feeling {feelingLabels[lastSavedSession.feeling].toLowerCase()}.
                {' '}
                {syncState.message || (lastSavedSession.accessMode === 'coach_invited' && lastSavedSession.sharedWithCoach
                  ? 'Ready to sync to your coach when linked.'
                  : lastSavedSession.accessMode === 'player_plus'
                    ? `Ready for ${PLAYER_TIER_NAME} history and trends.`
                    : 'Kept as a local preview for now.')}
                {questCreditMessage ? ` ${questCreditMessage}` : ''}
              </p>
              <div className={styles.liveSavedIdentitySignals} aria-label="Saved proof identity signals">
                {savedIdentitySignals.map((signal) => (
                  <article key={signal.label}>
                    <span>{signal.label}</span>
                    <strong>{signal.value}</strong>
                  </article>
                ))}
              </div>
              <div className={styles.liveSavedDeliveryRail} aria-label="Saved proof delivery status">
                {savedDeliverySteps.map((step) => (
                  <article key={step.label} data-state={step.state}>
                    <span>{step.label}</span>
                    <strong>{step.value}</strong>
                  </article>
                ))}
              </div>
              {selectedSavedNextCue ? (
                <div className={styles.liveSavedCueRail} aria-label="Choose next rep cue">
                  <div>
                    <span>Next cue</span>
                    <strong>{selectedSavedNextCue.label}</strong>
                    <p>{selectedSavedNextCue.value}</p>
                  </div>
                  <div className={styles.liveSavedCueButtons}>
                    {savedNextCueOptions.map((cue) => (
                      <button
                        type="button"
                        key={cue.id}
                        className={cue.id === selectedSavedNextCue.id ? 'button-primary' : 'button-secondary'}
                        data-active={cue.id === selectedSavedNextCue.id ? 'true' : 'false'}
                        aria-pressed={cue.id === selectedSavedNextCue.id}
                        onClick={() => chooseSavedNextCue(cue.id)}
                      >
                        {cue.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedSavedProofMoment ? (
                <div className={styles.liveSavedMomentRail} aria-label="Tag proof match moment">
                  <div>
                    <span>Moment</span>
                    <strong>{selectedSavedProofMoment.label}</strong>
                    <p>{selectedSavedProofMoment.value}</p>
                  </div>
                  <div className={styles.liveSavedMomentButtons}>
                    {savedProofMomentOptions.map((moment) => (
                      <button
                        type="button"
                        key={moment.id}
                        className={moment.id === selectedSavedProofMoment.id ? 'button-primary' : 'button-secondary'}
                        data-active={moment.id === selectedSavedProofMoment.id ? 'true' : 'false'}
                        aria-pressed={moment.id === selectedSavedProofMoment.id}
                        onClick={() => chooseSavedProofMoment(moment.id)}
                      >
                        {moment.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedSavedCoachAsk ? (
                <div className={styles.liveSavedAskRail} aria-label="Choose coach question">
                  <div>
                    <span>Coach ask</span>
                    <strong>{selectedSavedCoachAsk.label}</strong>
                    <p>{selectedSavedCoachAsk.value}</p>
                  </div>
                  <div className={styles.liveSavedAskButtons}>
                    {savedCoachAskOptions.map((ask) => (
                      <button
                        type="button"
                        key={ask.id}
                        className={ask.id === selectedSavedCoachAsk.id ? 'button-primary' : 'button-secondary'}
                        data-active={ask.id === selectedSavedCoachAsk.id ? 'true' : 'false'}
                        aria-pressed={ask.id === selectedSavedCoachAsk.id}
                        onClick={() => chooseSavedCoachAsk(ask.id)}
                      >
                        {ask.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {savedRecapChecklist.length ? (
                <div className={styles.liveSavedChecklist} aria-label="Coach recap send checklist">
                  <span>Send check</span>
                  <div>
                    {savedRecapChecklist.map((item) => (
                      <article key={item.label} data-state={item.state}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className={styles.liveSavedNextSteps} aria-label="Saved proof next steps">
                {savedNextSteps.map((step) => (
                  <article key={step.label}>
                    <span>{step.label}</span>
                    <strong>{step.value}</strong>
                    <a href={step.href}>{step.cta}</a>
                  </article>
                ))}
              </div>
              <div className={styles.liveSavedProofRecap} data-copy-status={recapCopyStatus} data-sent={savedProofRecapSent ? 'true' : 'false'} aria-label="Copyable saved proof recap">
                <div>
                  <span>Coach-ready recap</span>
                  <strong>{savedProofRecapSent ? 'Marked sent' : recapMode === 'text' ? 'Text-short recap ready' : lastSavedSession.sharedWithCoach ? 'Ready to send back' : 'Ready for Player ID notes'}</strong>
                  <div className={styles.liveSavedRecapMode} aria-label="Choose recap length">
                    <button type="button" data-active={recapMode === 'text' ? 'true' : 'false'} aria-pressed={recapMode === 'text'} onClick={() => chooseRecapMode('text')}>
                      Text
                    </button>
                    <button type="button" data-active={recapMode === 'full' ? 'true' : 'false'} aria-pressed={recapMode === 'full'} onClick={() => chooseRecapMode('full')}>
                      Full
                    </button>
                  </div>
                  <div className={styles.liveSavedCoachBrief} aria-label="Coach text proof brief">
                    {savedCoachBrief.map((line) => (
                      <article key={line.label} data-state={line.state}>
                        <span>{line.label}</span>
                        <strong>{line.value}</strong>
                      </article>
                    ))}
                  </div>
                  <p>{savedProofRecap}</p>
                  <small>{recapMode === 'text' ? 'Compact SMS version.' : 'Full coach context.'} {savedProofRecap.length} chars.</small>
                  {recapCopyStatus === 'manual' ? <small>Clipboard is blocked here. The recap is still visible.</small> : null}
                  {recapCopyStatus === 'copied' ? <small>Recap copied.</small> : null}
                  {recapCopyStatus === 'shared' ? <small>Share sheet opened.</small> : null}
                  {recapCopyStatus === 'unsent' ? <small>Sent marker cleared. Check the recap, then send again.</small> : null}
                  {savedProofRecapSent ? <small>Sent marker saved on this phone.</small> : null}
                </div>
                <div className={styles.liveSavedProofRecapActions}>
                  <a className="button-secondary" href={savedProofTextHref}>
                    Text recap
                  </a>
                  <button type="button" className="button-primary" onClick={shareSavedProofRecap}>
                    {recapCopyStatus === 'shared' ? 'Shared' : 'Share'}
                  </button>
                  <button type="button" className="button-secondary" onClick={copySavedProofRecap}>
                    {recapCopyStatus === 'copied' ? 'Copied' : 'Copy recap'}
                  </button>
                  {savedProofRecapSent ? (
                    <button type="button" className="button-secondary" onClick={undoSavedProofRecapSent}>
                      Undo sent
                    </button>
                  ) : (
                    <button type="button" className="button-secondary" onClick={markSavedProofRecapSent}>
                      Mark sent
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.liveSavedActions}>
              <button type="button" className="button-primary" onClick={repeatActivity}>
                Repeat
              </button>
              <button type="button" className="button-secondary" onClick={pickNewFocus}>
                New focus
              </button>
              <a className="button-secondary" href={lastSavedSession.accessMode === 'player_plus' ? '/pricing' : '/mylab#coach-assignments'}>
                {lastSavedSession.accessMode === 'player_plus' ? PLAYER_TIER_NAME : 'My Lab'}
              </a>
            </div>
          </div>
        </>
      ) : null}

      {finishStats ? (
        <div ref={finishRef} className={styles.liveFinishSummary} role="status" aria-label="Today banked summary">
          <div>
            <span>Today banked</span>
            <strong>{finishStats.count ? `${finishStats.count} drill${finishStats.count === 1 ? '' : 's'} logged` : 'Ready for the first log'}</strong>
            <p>{finishStats.count ? `${finishStats.average}/5 average proof. ${finishStats.bestDrill} led today.` : 'Start with one short block and save a proof score.'}</p>
          </div>
          <div className={styles.liveFinishStats}>
            <article>
              <span>Time</span>
              <strong>{finishStats.time}</strong>
            </article>
            <article>
              <span>Top score</span>
              <strong>{finishStats.bestRating || '-'}</strong>
            </article>
            <article>
              <span>Next</span>
              <strong>{progress.nextMove}</strong>
            </article>
          </div>
          <div className={styles.liveFinishActions}>
            <button type="button" className="button-primary" onClick={repeatActivity}>
              Add another
            </button>
            <a className="button-secondary" href="/mylab">
              My Lab
            </a>
          </div>
        </div>
      ) : null}

      <aside className={styles.liveSyncProofPanel} aria-label="Level Up local sync proof">
        <div>
          <span>Level Up local sync proof</span>
          <strong>Know what follows you.</strong>
          <p>Level Up saves the court work first, then syncs only when the access path is connected.</p>
        </div>
        <div className={styles.liveSyncProofGrid}>
          <article>
            <span>Saved first</span>
            <p>Rating, tiny note, timer, focus, and proof history stay in this browser immediately.</p>
          </article>
          <article>
            <span>Syncs when connected</span>
            <p>{PLAYER_TIER_NAME} history or coach-invited proof can reach Level Up sessions after sign-in.</p>
          </article>
          <article>
            <span>Local-only in v1</span>
            <p>Favorites and copied coach-update sent markers stay on this device for now.</p>
          </article>
        </div>
      </aside>

      <div className={styles.liveProgressPanel} aria-label="Training progress summary">
        <article>
          <span>Overall</span>
          <strong>{sessions.length ? `${progress.average}/5` : 'First log'}</strong>
          <p>{sessions.length ? `${sessions.length} saved sessions in this browser.` : 'Save one session to start the progress trail.'}</p>
        </article>
        <article>
          <span>Over / under</span>
          <strong>{progress.topFocus || 'No pattern yet'}</strong>
          <p>{progress.lowFocus ? `Next under-indexed area: ${progress.lowFocus}.` : 'Balanced work appears after more logs.'}</p>
        </article>
        <article>
          <span>Coach visibility</span>
          <strong>{progress.sharedCount} shared</strong>
          <p>Shared logs are the signal a coach can use to shape the next lesson or challenge.</p>
        </article>
        <article>
          <span>Next lesson</span>
          <strong>{progress.nextMove}</strong>
          <p>Coach scheduling can connect lesson reminders to this same focus and phone calendar flow.</p>
        </article>
      </div>

      <div className={styles.liveUnlockPanel} aria-label={`${PLAYER_TIER_NAME} unlock path`}>
        <div>
          <span>{PLAYER_TIER_NAME} unlock</span>
          <strong>Turn on-court logs into a shared development plan.</strong>
          <p>
            Coach-invited players get assigned Level Up work through the coach tier. Players without an invite use {PLAYER_TIER_NAME}
            for full self-guided history, trends, recommendations, calendar-linked lessons, and progress ownership.
          </p>
        </div>
        <div className={styles.liveUnlockGrid}>
          <span>Sync across devices</span>
          <span>Coach challenge history</span>
          <span>Over / under training trends</span>
          <span>Lesson calendar reminders</span>
        </div>
      </div>

      {recentSessions.length ? (
        <div className={styles.liveRecentList}>
          <span>Recent work</span>
          {recentSessions.map((session) => (
            <article key={session.id}>
              <strong>{session.focusTitle}: {session.drillTitle}</strong>
              <p>{getRecentSessionDetail(session)}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function DrillTimer({
  drillId,
  drillTitle,
  targetSeconds,
  resetSignal,
  onDone,
  onSnapshotChange,
}: {
  drillId: string
  drillTitle: string
  targetSeconds: number
  resetSignal: number
  onDone: () => void
  onSnapshotChange: (snapshot: DrillTimerSnapshot) => void
}) {
  const timerRef = useRef<HTMLDivElement>(null)
  const wakeLockRef = useRef<LevelUpWakeLockSentinel | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const [keepAwakeEnabled, setKeepAwakeEnabled] = useState(false)
  const [wakeLockStatus, setWakeLockStatus] = useState<WakeLockStatus>('off')
  const progress = targetSeconds > 0 ? Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100)) : 0
  const targetLabel = targetSeconds > 0 ? formatClock(targetSeconds) : 'Open'
  const timerState = running ? 'running' : elapsedSeconds > 0 ? 'paused' : 'idle'
  const showStickyDock = running || elapsedSeconds > 0
  const wakeLockLabel = getWakeLockLabel(wakeLockStatus, keepAwakeEnabled, running)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setRunning(false)
      setElapsedSeconds(getTimerSeconds(drillId))
    })

    return () => window.cancelAnimationFrame(id)
  }, [drillId])

  useEffect(() => {
    if (resetSignal === 0) return

    const id = window.requestAnimationFrame(() => {
      setRunning(false)
      setElapsedSeconds(getTimerSeconds(drillId))
    })

    return () => window.cancelAnimationFrame(id)
  }, [drillId, resetSignal])

  useEffect(() => {
    onSnapshotChange({ drillId, elapsedSeconds, running, targetSeconds })
  }, [drillId, elapsedSeconds, onSnapshotChange, running, targetSeconds])

  useEffect(() => {
    if (!running) return

    const id = window.setInterval(() => {
      setElapsedSeconds((current) => {
        const next = current + 1
        window.sessionStorage.setItem(timerStorageKey(drillId), String(next))
        return next
      })
    }, 1000)

    return () => window.clearInterval(id)
  }, [drillId, running])

  useEffect(() => {
    let cancelled = false

    async function requestWakeLock() {
      if (!keepAwakeEnabled || !running) {
        const sentinel = wakeLockRef.current
        wakeLockRef.current = null
        await releaseWakeLock(sentinel)
        setWakeLockStatus('off')
        return
      }

      const wakeLockNavigator = navigator as LevelUpWakeLockNavigator
      if (!wakeLockNavigator.wakeLock?.request) {
        setWakeLockStatus('unsupported')
        return
      }

      try {
        const sentinel = await wakeLockNavigator.wakeLock.request('screen')
        if (cancelled) {
          await releaseWakeLock(sentinel)
          return
        }

        wakeLockRef.current = sentinel
        setWakeLockStatus('active')
        sentinel.addEventListener('release', () => {
          if (wakeLockRef.current === sentinel) {
            wakeLockRef.current = null
            setWakeLockStatus((current) => current === 'active' ? 'off' : current)
          }
        }, { once: true })
      } catch {
        if (!cancelled) setWakeLockStatus('blocked')
      }
    }

    void requestWakeLock()

    return () => {
      cancelled = true
      const sentinel = wakeLockRef.current
      wakeLockRef.current = null
      void releaseWakeLock(sentinel)
    }
  }, [keepAwakeEnabled, running])

  function resetTimer(event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault()
    event?.stopPropagation()
    setRunning(false)
    setElapsedSeconds(0)
    window.sessionStorage.removeItem(timerStorageKey(drillId))
  }

  function toggleTimer() {
    setRunning((value) => {
      const nextRunning = !value
      if (nextRunning) {
        window.requestAnimationFrame(() => {
          timerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
      }
      return nextRunning
    })
  }

  function toggleKeepAwake() {
    setKeepAwakeEnabled((enabled) => {
      const next = !enabled
      if (!next) setWakeLockStatus('off')
      return next
    })
  }

  function finishTimer() {
    setRunning(false)
    onDone()
  }

  return (
    <>
      <div ref={timerRef} className={styles.liveTimerPanel} data-timer-state={timerState}>
        <div>
          <span>Timer</span>
          <strong>{formatClock(elapsedSeconds)}</strong>
          <p>Goal: {targetLabel}. Use this for the work block. Keep quality clean before adding speed.</p>
        </div>
        <div className={styles.liveTimerTrack} aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.liveWakeLockControl} data-status={wakeLockStatus} data-enabled={keepAwakeEnabled ? 'true' : 'false'} aria-label="Keep phone screen awake">
          <div>
            <span>Phone screen</span>
            <strong>{wakeLockLabel}</strong>
          </div>
          <button type="button" className={keepAwakeEnabled ? 'button-primary' : 'button-secondary'} onClick={toggleKeepAwake}>
            {keepAwakeEnabled ? 'Awake on' : 'Keep awake'}
          </button>
        </div>
        {!running && elapsedSeconds > 0 ? (
          <div className={styles.liveTimerResumePrompt} role="status">
            <div>
              <span>Resume last drill</span>
              <strong>{drillTitle} at {formatClock(elapsedSeconds)}</strong>
            </div>
            <button type="button" className="button-primary" onClick={toggleTimer}>
              Resume
            </button>
            <button type="button" className="button-secondary" aria-label="Start this drill fresh" onClick={resetTimer}>
              Fresh
            </button>
          </div>
        ) : null}
        <div className={styles.liveTimerActions}>
          <button type="button" className="button-primary" onClick={toggleTimer}>
            {running ? 'Pause' : 'Start'}
          </button>
          <button type="button" className="button-secondary" aria-label="Reset drill timer to 0" onClick={resetTimer}>
            Reset timer
          </button>
          {elapsedSeconds > 0 ? (
            <button type="button" className="button-primary" data-action="done" onClick={finishTimer}>
              Done
            </button>
          ) : null}
        </div>
      </div>
      <div className={styles.liveTimerDock} data-visible={showStickyDock ? 'true' : 'false'} aria-label="Sticky drill timer controls">
        <div>
          <span>{running ? 'Running' : 'Paused'}</span>
          <strong>{formatClock(elapsedSeconds)}</strong>
        </div>
        <button type="button" className="button-secondary" onClick={toggleTimer}>
          {running ? 'Pause' : 'Resume'}
        </button>
        <button type="button" className="button-secondary" aria-label="Reset drill timer to 0" onClick={resetTimer}>
          Reset
        </button>
        <button type="button" className="button-primary" disabled={elapsedSeconds === 0} onClick={finishTimer}>
          Done
        </button>
      </div>
    </>
  )
}

async function releaseWakeLock(sentinel: LevelUpWakeLockSentinel | null) {
  if (!sentinel || sentinel.released) return

  try {
    await sentinel.release()
  } catch {
    // The browser can release a wake lock before our cleanup runs.
  }
}

function getWakeLockLabel(status: WakeLockStatus, enabled: boolean, running: boolean) {
  if (status === 'active') return 'Screen awake'
  if (status === 'unsupported') return 'Not supported'
  if (status === 'blocked') return 'Tap after unlock'
  if (enabled && !running) return 'Ready on start'
  return 'Sleep allowed'
}

function buildDrillOptions(
  focus: LiveFocus | undefined,
  menus: { solo: TrainingRow[]; partner: TrainingRow[]; offCourt: TrainingRow[]; performance: TrainingRow[] },
): DrillOption[] {
  const focusId = focus?.id ?? 'focus'
  const tracker = focus?.tracker[0] ?? 'proof'
  const soloTool = pickRow(menus.solo, focusId, focus?.drills[0] ?? 'Solo rep block')
  const partnerTool = pickRow(menus.partner, focusId, menus.partner[0]?.[0] ?? 'Partner drill')
  const physicalTool = pickPerformanceTool(focusId, menus.performance)
  const mentalTool = pickMentalTool(focusId, menus.offCourt)
  const coachTitle = focus?.drills[0] ?? soloTool[0]

  return [
    drill(`${focusId}-alone-court`, soloTool[0], soloTool[1], 'court', 'alone', '12-20 minutes', 900, `Rate ${tracker.toLowerCase()} 0-5 and record reps or targets made.`, '#solo-training'),
    drill(`${focusId}-partner-court`, partnerTool[0], partnerTool[1], 'court', 'partner', '15-25 minutes', 1200, `Rate ${tracker.toLowerCase()} 0-5 and note the constraint score.`, '#partner-training'),
    drill(`${focusId}-singles-court`, `${coachTitle} pressure set`, `Start every point with the ${focus?.cue.toLowerCase() ?? 'focus cue'} and score the drill to 7. Reset after every miss.`, 'court', 'singles', '15 minutes', 900, `Rate whether the habit showed up under score pressure.`, '#match-card'),
    drill(`${focusId}-doubles-court`, partnerTool[0], `${partnerTool[1]} Add a partner call before the serve or return and review one communication cue after each game.`, 'court', 'doubles', '15-25 minutes', 1200, 'Rate partner clarity, first move, and recovery after the ball.', '#partner-training'),
    drill(`${focusId}-coach-court`, `Coach challenge: ${coachTitle}`, `Complete the coach-assigned version of this focus, then send the rating and note back through My Lab.`, 'court', 'coach', 'Coach assigned', 900, 'Rate completion honestly and write the one cue your coach should know.', '/mylab#coach-assignments'),
    drill(`${focusId}-alone-physical`, physicalTool[0], physicalTool[1], 'physical', 'alone', '8-15 minutes', 600, `Rate body readiness and ${tracker.toLowerCase()} after the block.`, '#performance-upgrade'),
    drill(`${focusId}-coach-physical`, `Coach challenge: ${physicalTool[0]}`, `${physicalTool[1]} Send the readiness score back if this was assigned.`, 'physical', 'coach', '8-15 minutes', 600, 'Rate readiness 0-5 and note any limitation before the next lesson.', '/mylab#coach-assignments'),
    drill(`${focusId}-mental`, mentalTool[0], mentalTool[1], 'mental', 'alone', '5 minutes', 300, 'Rate routine clarity 0-5 and write the next cue only if it helps.', '#off-court-work'),
    drill(`${focusId}-coach-mental`, 'Coach challenge reflection', `Use the coach assignment prompt, write one proof, one leak, and one request for the next lesson.`, 'mental', 'coach', '3-5 minutes', 240, 'Rate plan clarity and share the recap when linked.', '/mylab#coach-assignments'),
  ]
}

function drill(
  id: string,
  title: string,
  summary: string,
  workType: WorkType,
  context: TrainingContext,
  duration: string,
  timerSeconds: number,
  proof: string,
  href: string,
  sourceCard?: LevelUpCard,
): DrillOption {
  return { id, title, summary, workType, context, duration, timerSeconds, proof, href, sourceCard }
}

function buildCardDrillOption(card: LevelUpCard, identitySlug: string, contextOverride?: TrainingContext): DrillOption {
  const workType = getCardLiveWorkType(card)
  const context = contextOverride ?? getCardLiveContext(card, workType)
  return drill(
    `card-${card.id}`,
    card.title,
    card.tennisGoal,
    workType,
    context,
    `${card.durationMinutes} minutes`,
    card.durationMinutes * 60,
    card.proof,
    `/player-development/${identitySlug}/level-up#all-cards`,
    card,
  )
}

function appendPortalCompletion(card: LevelUpCard, session: SavedSession) {
  const key = 'tiq-level-up-completions'
  let existing: LevelUpCompletion[] = []

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
    existing = Array.isArray(parsed) ? parsed : []
  } catch {
    existing = []
  }

  const next: LevelUpCompletion = {
    id: session.id,
    playerId: 'local-player',
    cardId: card.id,
    completedAt: session.completedAt,
    proofRating: session.rating,
    note: session.note,
    durationMinutes: Math.max(1, Math.round(session.elapsedSeconds / 60)) || card.durationMinutes,
    assignmentId: session.assignmentId,
  }

  window.localStorage.setItem(key, JSON.stringify([next, ...existing.filter((completion) => completion.id !== next.id)].slice(0, 40)))
}

function removePortalCompletion(sessionId: string) {
  const key = 'tiq-level-up-completions'

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]') as LevelUpCompletion[]
    const existing = Array.isArray(parsed) ? parsed : []
    window.localStorage.setItem(key, JSON.stringify(existing.filter((completion) => completion.id !== sessionId)))
  } catch {
    window.localStorage.setItem(key, JSON.stringify([]))
  }
}

async function syncCustomQuestCompletion(
  customQuestId: string,
  session: SavedSession,
  card: LevelUpCard,
  identitySlug: string,
  setQuestCreditMessage: (message: string) => void,
) {
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) {
    setQuestCreditMessage('Sign in to record quest XP.')
    return
  }

  const { data: questData, error: questError } = await supabase
    .from('level_up_custom_quests')
    .select('id,title,xp,linked_card_id')
    .eq('id', customQuestId)
    .eq('active', true)
    .maybeSingle()

  if (questError || !questData) {
    setQuestCreditMessage('Quest XP could not be matched.')
    return
  }

  const quest = questData as CustomQuestForCompletion
  if (quest.linked_card_id && quest.linked_card_id !== card.id) {
    setQuestCreditMessage('Quest XP skipped because the linked drill changed.')
    return
  }

  const { error } = await supabase
    .from('level_up_custom_quest_completions')
    .upsert({
      user_id: userId,
      custom_quest_id: customQuestId,
      level_up_session_id: session.id,
      identity_slug: identitySlug,
      card_id: card.id,
      completed_on: session.completedAt.slice(0, 10),
      completed_at: session.completedAt,
      xp: Math.min(100, Math.max(0, quest.xp)),
      proof_rating: session.rating,
      note: session.note,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'custom_quest_id,completed_on' })

  setQuestCreditMessage(error ? 'Quest XP could not sync yet.' : `Quest XP recorded for ${quest.title}.`)
}

function getCardLiveWorkType(card: LevelUpCard): WorkType {
  if (card.category === 'mental-routine') return 'mental'
  if (['strength-stability', 'conditioning', 'mobility-stretch', 'recovery-reset'].includes(card.category)) return 'physical'
  return 'court'
}

function getCardLiveContext(card: LevelUpCard, workType: WorkType): TrainingContext {
  if (workType !== 'court') return 'alone'
  if (card.category === 'doubles-drill' || card.tags.includes('doubles') || card.tags.includes('doubles-communication')) return 'doubles'
  if (card.category === 'partner-drill' || card.equipment.includes('partner')) return 'partner'
  return 'alone'
}

function pickRow(rows: TrainingRow[], focusId: string, fallback: string): TrainingRow {
  const keyword = focusId === 'strokes' ? 'attack' : focusId
  return rows.find(([title, text]) => `${title} ${text}`.toLowerCase().includes(keyword)) ?? [fallback, 'Do one focused block and rate the proof 0-5.']
}

function pickPerformanceTool(focusId: string, rows: TrainingRow[]): TrainingRow {
  const preferences: Record<string, string[]> = {
    serve: ['shoulder', 'dynamic'],
    movement: ['cone', 'jump rope', 'dynamic'],
    strokes: ['cone', 'shadow', 'mobility'],
    conditioning: ['conditioning', 'wall sit', 'lower-body'],
    doubles: ['jump rope', 'dynamic', 'cone'],
  }
  const keywords = preferences[focusId] ?? ['dynamic', 'mobility']
  return rows.find(([title, text]) => keywords.some((keyword) => `${title} ${text}`.toLowerCase().includes(keyword))) ?? rows[0] ?? ['Dynamic warm-up', 'Prepare the body, then rate readiness 0-5.']
}

function pickMentalTool(focusId: string, rows: TrainingRow[]): TrainingRow {
  const preferences: Record<string, string[]> = {
    serve: ['pressure breath', 'routine'],
    movement: ['match note', 'coach handoff'],
    strokes: ['opponent plan', 'match note'],
    conditioning: ['match note', 'coach handoff'],
    doubles: ['coach handoff', 'opponent plan'],
  }
  const keywords = preferences[focusId] ?? ['match note', 'routine']
  return rows.find(([title, text]) => keywords.some((keyword) => `${title} ${text}`.toLowerCase().includes(keyword))) ?? rows[0] ?? ['Five-minute match note', 'Write one proof, one leak, and one next action.']
}

function readSavedSessions(storageKey: string): SavedSession[] {
  if (typeof window === 'undefined') return []

  const saved = window.localStorage.getItem(storageKey)
  if (!saved) return []

  try {
    const parsed = JSON.parse(saved) as SavedSession[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readSentProofRecapIds(storageKey: string): string[] {
  if (typeof window === 'undefined') return []

  const saved = window.localStorage.getItem(storageKey)
  if (!saved) return []

  try {
    const parsed = JSON.parse(saved) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function readTomorrowStarterPlan(storageKey: string): TomorrowStarterPlan | null {
  if (typeof window === 'undefined') return null

  const saved = window.localStorage.getItem(storageKey)
  if (!saved) return null

  try {
    const parsed = JSON.parse(saved) as Partial<TomorrowStarterPlan>
    if (!parsed || typeof parsed !== 'object') return null
    if (
      typeof parsed.focusId !== 'string' ||
      typeof parsed.focusTitle !== 'string' ||
      !isWorkType(parsed.workType) ||
      !isTrainingContext(parsed.context) ||
      typeof parsed.drillId !== 'string' ||
      typeof parsed.drillTitle !== 'string' ||
      typeof parsed.cue !== 'string' ||
      typeof parsed.reason !== 'string' ||
      typeof parsed.createdAt !== 'string'
    ) {
      return null
    }

    return {
      focusId: parsed.focusId,
      focusTitle: parsed.focusTitle.slice(0, 80),
      workType: parsed.workType,
      context: parsed.context,
      drillId: parsed.drillId,
      drillTitle: parsed.drillTitle.slice(0, 80),
      cue: parsed.cue.slice(0, 160),
      reason: parsed.reason.slice(0, 120),
      createdAt: parsed.createdAt,
    }
  } catch {
    return null
  }
}

function getTomorrowStarterCheck(plan: TomorrowStarterPlan, mode: TomorrowStarterCheckMode = 'first'): TomorrowStarterCheck {
  const title = plan.drillTitle.toLowerCase()
  const isServe = title.includes('serve') || plan.cue.toLowerCase().includes('serve')
  const firstCue = isServe
    ? 'Call target and plus-one before the toss.'
    : plan.context === 'doubles'
      ? 'Call the partner read before the point starts.'
      : plan.workType === 'mental'
        ? 'Say the reset cue before the next score moment.'
        : 'Name the behavior before the first rep.'
  const firstProof = isServe
    ? 'Score only if the serve target and next ball stayed clear.'
    : plan.context === 'doubles'
      ? 'Score only if the call happened early enough to help the point.'
      : plan.workType === 'physical'
        ? 'Score only if posture stayed clean through the last rep.'
        : 'Score only if the same cue showed up under pressure.'
  const firstStopRule = plan.workType === 'physical'
    ? 'Stop if posture breaks twice.'
    : plan.context === 'doubles'
      ? 'Stop after one clean service game.'
      : 'Stop after one honest score.'

  if (mode === 'volume') {
    return {
      drillTitle: plan.drillTitle,
      mode,
      label: 'Add volume check',
      scoreLabel: 'Score volume rep',
      cue: isServe ? 'Add serves only while the target call stays automatic.' : 'Add reps only while the same cue stays clean.',
      proof: 'Score only if the cue survives the added volume.',
      stopRule: 'Stop when the cue slips twice.',
    }
  }

  if (mode === 'repeat') {
    return {
      drillTitle: plan.drillTitle,
      mode,
      label: 'Repeat slower check',
      scoreLabel: 'Score slower rep',
      cue: isServe ? 'Slow the routine, call target, then toss.' : 'Drop speed 20%, name the cue, then run one rep.',
      proof: 'Score only if the cue returns cleaner than the last save.',
      stopRule: 'Stop after one slower honest score.',
    }
  }

  return {
    drillTitle: plan.drillTitle,
    mode,
    label: 'First rep check',
    scoreLabel: 'Score first rep',
    cue: firstCue,
    proof: firstProof,
    stopRule: firstStopRule,
  }
}

function getStarterProofLabel(mode: TomorrowStarterCheckMode) {
  if (mode === 'volume') return 'Add volume check'
  if (mode === 'repeat') return 'Repeat slower check'
  return 'First rep check'
}

function isTomorrowStarterMatch(plan: TomorrowStarterPlan, drill: DrillOption) {
  return plan.drillId === drill.id || plan.drillTitle === drill.title
}

function getTomorrowStarterCompletion(plan: TomorrowStarterPlan, rating: number): TomorrowStarterCompletion {
  return {
    drillTitle: plan.drillTitle,
    rating,
    next: rating >= 4
      ? 'Starter banked. Add volume only if the same cue stays clean.'
      : 'Starter exposed a leak. Repeat once slower before adding volume.',
    actionLabel: rating >= 4 ? 'Add volume' : 'Repeat slower',
    restoredPlan: plan,
  }
}

function remoteToSavedSession(session: RemoteLevelUpSession): SavedSession {
  return {
    id: session.id,
    focusId: session.focusId,
    focusTitle: session.focusTitle,
    workType: session.workType,
    context: session.context,
    drillTitle: session.drillTitle,
    rating: session.rating,
    feeling: session.feeling,
    accessMode: session.accessMode,
    note: session.note,
    elapsedSeconds: session.elapsedSeconds,
    sharedWithCoach: session.sharedWithCoach,
    completedAt: session.completedAt,
    assignmentId: session.assignmentId ?? undefined,
    studentLinkId: session.studentLinkId ?? undefined,
    starterRead: session.starterRead ?? undefined,
  }
}

function findAssignmentFocus(focuses: LiveFocus[], assignmentFocus: string) {
  const normalized = assignmentFocus.toLowerCase()
  if (!normalized) return null

  return focuses.find((focus) => {
    const title = focus.title.toLowerCase()
    return normalized.includes(focus.id.toLowerCase()) || normalized.includes(title.replace(' development', '')) || title.includes(normalized)
  }) ?? null
}

function normalizeAssignmentWorkType(value: string | null): WorkType | null {
  return value === 'physical' || value === 'mental' || value === 'court' ? value : null
}

function normalizeTrainingContext(value: string | null): TrainingContext | null {
  return value === 'alone' || value === 'partner' || value === 'singles' || value === 'doubles' || value === 'coach' ? value : null
}

function mergeSessions(remoteSessions: SavedSession[], localSessions: SavedSession[]) {
  const byId = new Map<string, SavedSession>()
  for (const session of [...remoteSessions, ...localSessions]) {
    byId.set(session.id, session)
  }
  return [...byId.values()].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
}

function timerStorageKey(drillId: string) {
  return `tenaceiq:level-up-timer:${drillId}`
}

function getTimerSeconds(drillId: string) {
  if (typeof window === 'undefined') return 0
  const saved = window.sessionStorage.getItem(timerStorageKey(drillId))
  const parsed = saved ? Number.parseInt(saved, 10) : 0
  return Number.isFinite(parsed) ? parsed : 0
}

function proofCounterStorageKey(drillId: string) {
  return `tenaceiq:level-up-proof-counter:${drillId}`
}

function getProofCounter(drillId: string) {
  if (typeof window === 'undefined') return 0
  const saved = window.sessionStorage.getItem(proofCounterStorageKey(drillId))
  const parsed = saved ? Number.parseInt(saved, 10) : 0
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function levelUpDraftStorageKey(drillId: string) {
  return `tenaceiq:level-up-draft:${drillId}`
}

function getEmptySessionDraft(sharedWithCoachDefault: boolean): SessionDraft {
  return { ...emptyDraft, sharedWithCoach: sharedWithCoachDefault }
}

function readSessionDraft(storageKey: string, sharedWithCoachDefault: boolean): SessionDraft {
  if (typeof window === 'undefined') return getEmptySessionDraft(sharedWithCoachDefault)

  try {
    const saved = window.sessionStorage.getItem(storageKey)
    if (!saved) return getEmptySessionDraft(sharedWithCoachDefault)

    const parsed = JSON.parse(saved) as Partial<SessionDraft>
    const rating = typeof parsed.rating === 'number' && parsed.rating >= 0 && parsed.rating <= 5 ? parsed.rating : null
    const feeling = isPlayerFeeling(parsed.feeling) ? parsed.feeling : 'ready'
    const note = typeof parsed.note === 'string' ? parsed.note.slice(0, 220) : ''
    const sharedWithCoach = typeof parsed.sharedWithCoach === 'boolean' ? parsed.sharedWithCoach : sharedWithCoachDefault

    return { rating, feeling, note, sharedWithCoach }
  } catch {
    return getEmptySessionDraft(sharedWithCoachDefault)
  }
}

function isEmptySessionDraft(draft: SessionDraft, accessMode: AccessMode) {
  return draft.rating === null &&
    draft.feeling === 'ready' &&
    draft.note.trim() === '' &&
    draft.sharedWithCoach === (accessMode === 'coach_invited')
}

function isPlayerFeeling(value: unknown): value is PlayerFeeling {
  return value === 'ready' || value === 'tight' || value === 'tired' || value === 'nervous'
}

function isWorkType(value: unknown): value is WorkType {
  return value === 'court' || value === 'physical' || value === 'mental'
}

function isTrainingContext(value: unknown): value is TrainingContext {
  return value === 'alone' || value === 'partner' || value === 'singles' || value === 'doubles' || value === 'coach'
}

function getProofCounterTarget(drill: DrillOption) {
  if (drill.sourceCard?.tags.includes('serve-target') || drill.sourceCard?.tags.includes('serve-routine')) return 6
  if (drill.sourceCard?.tags.includes('doubles') || drill.sourceCard?.tags.includes('doubles-communication')) return 8
  if (drill.sourceCard?.category === 'mental-routine') return 3
  if (drill.workType === 'physical') return 6
  if (drill.workType === 'mental') return 3
  return 10
}

function getProofCounterNote(count: number, target: number) {
  return `Clean proof reps: ${count}/${target}.`
}

function getPressureProofNote(cue: string) {
  return `[Pressure proof: ${cue.replace(/\s+/g, ' ').trim()}]`
}

function getStarterProofNote(mode: TomorrowStarterCheckMode) {
  return `[Starter proof: ${getStarterProofLabel(mode)}]`
}

function getStarterReadNotes(starterRead: SavedSessionStarterRead) {
  return [
    getStarterReadNote('Starter rep', starterRead.starterRep),
    getStarterReadNote('Starter proof cue', starterRead.starterProofCue),
    getStarterReadNote('Starter leak watch', starterRead.starterLeakWatch),
    getStarterReadNote('Starter smart next', starterRead.starterSmartNext),
  ]
}

function getStarterReadNote(label: string, value: string) {
  return `[${label}: ${value.replace(/\s+/g, ' ').replace(/\]/g, '').trim()}]`
}

function mergeProofNotes(note: string, ...systemNotes: string[]) {
  const cleanedSystemNotes = systemNotes.map((systemNote) => systemNote.trim()).filter(Boolean)
  const cleanedNote = note.trim()

  return [...cleanedSystemNotes, cleanedNote].filter(Boolean).join(' ')
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function isSessionFromToday(session: SavedSession) {
  const completedAt = new Date(session.completedAt)
  if (Number.isNaN(completedAt.getTime())) return false

  const today = new Date()
  return completedAt.getFullYear() === today.getFullYear() &&
    completedAt.getMonth() === today.getMonth() &&
    completedAt.getDate() === today.getDate()
}

function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getDrillDayStreak(sessions: SavedSession[], drillTitle: string) {
  if (!drillTitle) return 0

  const drillDays = new Set(
    sessions
      .filter((session) => session.drillTitle === drillTitle)
      .map((session) => {
        const completedAt = new Date(session.completedAt)
        return Number.isNaN(completedAt.getTime()) ? '' : getLocalDateKey(completedAt)
      })
      .filter(Boolean),
  )

  let streak = 0
  const cursor = new Date()
  while (drillDays.has(getLocalDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

function getNextDrillAfterSession(session: SavedSession, drills: DrillOption[]) {
  if (drills.length < 2) return null

  const currentIndex = drills.findIndex((drill) => drill.title === session.drillTitle)
  if (currentIndex === -1) return drills[0]

  return drills[(currentIndex + 1) % drills.length] ?? null
}

function getSmartNextAction(
  session: SavedSession,
  suggestedNextDrill: DrillOption | null,
  readiness: PlayerReadiness,
  todaySessions: SavedSession[],
): SmartNextAction {
  const todayAverage = todaySessions.length
    ? todaySessions.reduce((total, savedSession) => total + savedSession.rating, 0) / todaySessions.length
    : session.rating
  const tightOrTiredCount = todaySessions.filter((savedSession) => savedSession.feeling === 'tight' || savedSession.feeling === 'tired').length
  const lowScoreCount = todaySessions.filter((savedSession) => savedSession.rating <= 3).length
  const todayProofLabel = todaySessions.length > 1 ? `${todaySessions.length} logs today` : 'First log today'
  const pressureProofValue = getSavedPressureProofValue(session)

  if (pressureProofValue && session.rating >= 4) {
    return {
      title: 'Bank the pressure proof',
      copy: 'You tested the same cue under score pressure. Save the signal and leave the next rep clean.',
      decision: 'Finish',
      reason: 'Pressure proof logged.',
      load: 'Done or one easy rep',
      primaryLabel: 'Finish',
    }
  }

  if (readiness === 'tired' || session.feeling === 'tired') {
    return {
      title: 'Recover before more reps',
      copy: suggestedNextDrill
        ? `You logged this while tired. Skip pressure unless posture is clean; ${suggestedNextDrill.title} can wait.`
        : 'You logged this while tired. Finish today or repeat at lower speed with clean posture.',
      decision: 'Recover',
      reason: `${todayProofLabel}; tired signal logged.`,
      load: 'Light or done',
      primaryLabel: 'Recover',
    }
  }

  if (session.rating >= 5 && readiness === 'fresh' && tightOrTiredCount === 0) {
    return {
      title: suggestedNextDrill ? `Add pressure with ${suggestedNextDrill.title}` : 'Add pressure to this proof',
      copy: suggestedNextDrill
        ? 'Clean proof plus fresh readiness. Take the paired drill while the pattern is warm.'
        : 'Clean proof plus fresh readiness. Repeat it once with a pressure score.',
      decision: 'Add pressure',
      reason: `${session.rating}/5 and fresh.`,
      load: todayAverage >= 4.5 ? 'Pressure rep' : 'Controlled pressure',
      primaryLabel: 'Add pressure',
    }
  }

  if (session.rating <= 3 || lowScoreCount >= 2) {
    return {
      title: 'Repeat clean before pressure',
      copy: 'Keep the same drill and make the next rep cleaner before adding speed or pressure.',
      decision: 'Repeat clean',
      reason: lowScoreCount >= 2 ? `${lowScoreCount} lower scores today.` : `${session.rating}/5 proof needs one cleaner rep.`,
      load: 'Same drill, simpler cue',
      primaryLabel: 'Repeat clean',
    }
  }

  if (tightOrTiredCount >= 2 || todaySessions.length >= 3) {
    return {
      title: 'Bank it and finish strong',
      copy: 'You have enough signal for today. Save the proof trail and leave the next rep clean.',
      decision: 'Finish',
      reason: tightOrTiredCount >= 2 ? `${tightOrTiredCount} tight/tired signals today.` : `${todaySessions.length} proof logs banked today.`,
      load: 'Done or one easy rep',
      primaryLabel: 'Repeat easy',
    }
  }

  return {
    title: suggestedNextDrill ? `Repeat, then try ${suggestedNextDrill.title}` : 'Repeat once or finish strong',
    copy: suggestedNextDrill
      ? 'Good work logged. Repeat this once if you want a cleaner score, then move to the paired drill.'
      : 'Good work logged. Repeat once or finish today with a clean proof trail.',
    decision: 'Repeat clean',
    reason: `${session.rating}/5 with ${feelingLabels[session.feeling].toLowerCase()} feel.`,
    load: todayAverage >= 4 ? 'Moderate' : 'Keep it simple',
    primaryLabel: 'Repeat clean',
  }
}

function getPressureRepeatCue(drill: DrillOption, readiness: PlayerReadiness) {
  if (readiness === 'tired') return 'One easy pressure rep only. Stop if form fades.'

  const title = drill.title.toLowerCase()
  if (title.includes('serve')) return 'Play one 30-30 serve point. Same target, no extra motion.'
  if (drill.context === 'doubles') return 'Play one 30-30 doubles point with the same call.'
  if (drill.workType === 'mental') return 'Use one miss or 30-30 point. Reset first, then score it.'
  if (drill.workType === 'physical') return 'One controlled pressure set. Stop before posture breaks.'

  return 'Run one 30-30 point or one clean pressure rep with the same cue.'
}

function getSavedDeliverySteps(session: SavedSession, syncState: SyncState, inUndoWindow: boolean) {
  const destination = session.assignmentId
    ? 'Coach assignment'
    : session.accessMode === 'coach_invited' && session.sharedWithCoach
      ? 'Coach review'
      : session.accessMode === 'player_plus'
        ? 'My Lab history'
        : session.accessMode === 'coach_invited'
          ? 'Private log'
          : 'Local preview'
  const delivery =
    syncState.status === 'synced'
      ? 'Delivered'
      : syncState.status === 'syncing'
        ? 'Syncing now'
        : syncState.status === 'error'
          ? 'Needs retry'
          : inUndoWindow
            ? 'Undo window'
            : session.accessMode === 'free_preview'
              ? 'Local only'
              : 'Queued'

  return [
    { label: 'Saved first', value: 'This device', state: 'saved' },
    { label: 'Destination', value: destination, state: session.sharedWithCoach ? 'coach' : 'local' },
    { label: 'Delivery', value: delivery, state: syncState.status },
  ]
}

function getSavedNextSteps(session: SavedSession, smartNextAction: ReturnType<typeof getSmartNextAction> | null) {
  const coachLinked = Boolean(session.assignmentId || (session.accessMode === 'coach_invited' && session.sharedWithCoach))
  return [
    {
      label: 'Proof meaning',
      value: `${session.rating}/5 proof now belongs to ${session.focusTitle}.`,
      href: '/mylab#level-up-proof',
      cta: 'Open My Lab',
    },
    {
      label: coachLinked ? 'Coach note' : 'Player ID note',
      value: coachLinked
        ? 'Send what changed and ask for the next assigned rep.'
        : 'Keep the proof attached to your next Player ID read.',
      href: coachLinked ? buildSavedCoachFollowUpHref(session) : '/player-development',
      cta: coachLinked ? 'Message coach' : 'Read Player ID',
    },
    {
      label: 'Next rep',
      value: smartNextAction?.title ?? 'Repeat once or finish with a clean proof trail.',
      href: '#level-up-flow',
      cta: 'Back to drill',
    },
  ]
}

function getSavedNextCueOptions(session: SavedSession, smartNextAction: ReturnType<typeof getSmartNextAction> | null): SavedNextCue[] {
  const coachLinked = Boolean(session.assignmentId || (session.accessMode === 'coach_invited' && session.sharedWithCoach))
  const smartRecap = smartNextAction?.title ?? 'Repeat once or finish with a clean proof trail'
  const pressureCopy = session.rating >= 4
    ? 'Run the same proof at 30-30, one serve, or one clean pressure point.'
    : 'Keep the same drill, slow the setup down, then score the proof again.'

  return [
    {
      id: 'smart',
      label: 'Smart next',
      value: smartNextAction?.copy ?? 'Use the score, readiness, and drill history to choose the next move.',
      recap: smartRecap,
    },
    {
      id: 'repeat',
      label: 'Repeat',
      value: 'Run one more proof rep before changing the drill.',
      recap: 'Repeat the same drill once and chase one cleaner proof score',
    },
    {
      id: 'pressure',
      label: session.rating >= 4 ? 'Add pressure' : 'Slow down',
      value: pressureCopy,
      recap: session.rating >= 4 ? 'Add a pressure rep before moving on' : 'Slow the setup down and repeat the proof',
    },
    coachLinked
      ? {
          id: 'coach',
          label: 'Ask coach',
          value: 'Send the recap and ask for the next assigned rep.',
          recap: 'Send this to coach and ask for the next assigned rep',
        }
      : {
          id: 'finish',
          label: 'Finish clean',
          value: 'Bank the proof and keep the next Player ID read honest.',
          recap: 'Finish clean and keep this proof attached to the next Player ID read',
        },
  ]
}

function getSavedProofMomentOptions(session: SavedSession): SavedProofMoment[] {
  const tiebreakLabel = session.context === 'doubles' ? 'Doubles TB' : 'Tiebreak'
  const tiebreakValue = session.context === 'doubles'
    ? 'Use this when the behavior showed up in a tight doubles tiebreak or 10-point breaker.'
    : 'Use this when the proof came from a tiebreak, breaker, or match-play finish.'
  const tiebreakRecap = session.context === 'doubles' ? 'Doubles tiebreak' : 'Tiebreak pressure'

  return [
    {
      id: 'practice',
      label: 'Practice',
      value: 'Clean practice block, warm-up, lesson, or basket rep.',
      recap: 'Practice block',
    },
    {
      id: 'thirty',
      label: '30-30',
      value: 'Use this when the behavior held up at a tight game score.',
      recap: '30-30 pressure',
    },
    {
      id: 'break',
      label: 'Break point',
      value: 'Use this when the proof connected to a break-point chance or save.',
      recap: 'Break-point moment',
    },
    {
      id: 'tiebreak',
      label: tiebreakLabel,
      value: tiebreakValue,
      recap: tiebreakRecap,
    },
  ]
}

function getSavedCoachAskOptions(session: SavedSession): SavedCoachAsk[] {
  const fixValue = session.rating >= 4
    ? 'Ask what should get harder next, not what went wrong.'
    : 'Ask which miss to clean up before adding more pressure.'
  const fixRecap = session.rating >= 4
    ? 'What should I make harder next?'
    : 'What should I fix first?'

  return [
    {
      id: 'next',
      label: 'Next rep',
      value: 'Ask for the next assigned rep or the next match-use cue.',
      recap: 'What should I run next?',
    },
    {
      id: 'repeat',
      label: 'Repeat?',
      value: 'Ask whether this proof should repeat or progress.',
      recap: 'Should I repeat this or progress?',
    },
    {
      id: 'fix',
      label: 'Fix first',
      value: fixValue,
      recap: fixRecap,
    },
    {
      id: 'film',
      label: 'Film',
      value: 'Ask what short clip would help the coach read the next rep.',
      recap: 'What should I film next time?',
    },
  ]
}

function getSavedRecapChecklist(
  session: SavedSession,
  selectedNextCue: SavedNextCue | null,
  selectedProofMoment: SavedProofMoment | null,
  selectedCoachAsk: SavedCoachAsk | null,
): SavedRecapCheck[] {
  const starterRead = getSavedStarterCoachRead(session)

  return [
    {
      label: 'Score',
      value: `${session.rating}/5 proof`,
      state: 'ready',
    },
    {
      label: 'Starter',
      value: starterRead ? 'Captured' : 'Legacy log',
      state: starterRead ? 'ready' : 'missing',
    },
    {
      label: 'Moment',
      value: selectedProofMoment?.label ?? 'Pick moment',
      state: selectedProofMoment ? 'ready' : 'missing',
    },
    {
      label: 'Next',
      value: selectedNextCue?.label ?? 'Pick cue',
      state: selectedNextCue ? 'ready' : 'missing',
    },
    {
      label: 'Ask',
      value: selectedCoachAsk?.label ?? 'Pick ask',
      state: selectedCoachAsk ? 'ready' : 'missing',
    },
  ]
}

function getSavedCoachBrief(
  session: SavedSession,
  selectedNextCue: SavedNextCue | null,
  selectedCoachAsk: SavedCoachAsk | null,
): SavedCoachBriefLine[] {
  const cleanProofValue = getSavedProofCounterValue(session)
  const pressureProofValue = getSavedPressureProofValue(session)
  const starterProofValue = getSavedStarterProofValue(session)
  const starterRead = getSavedStarterCoachRead(session)
  const playerNote = getPlayerProofNote(session.note)
  const pressureProofBrief = pressureProofValue ? pressureProofValue.replace(/[.!?]+$/, '') : ''
  const starterProofBrief = starterRead
    ? `${starterRead.starterRep} ${starterProofValue ? `${starterProofValue} ` : ''}scored ${session.rating}/5 in ${session.drillTitle}${cleanProofValue ? ` (${cleanProofValue} clean)` : ''}${pressureProofBrief ? ` under pressure: ${pressureProofBrief}` : ''}.`
    : starterProofValue
    ? `${starterProofValue} scored ${session.rating}/5 in ${session.drillTitle}${cleanProofValue ? ` (${cleanProofValue} clean)` : ''}${pressureProofBrief ? ` under pressure: ${pressureProofBrief}` : ''}.`
    : ''
  const starterLeakBrief = starterRead && session.rating < 4
    ? starterRead.starterLeakWatch
    : starterProofValue && session.rating < 4
    ? `${starterProofValue} still needs a cleaner rep before pressure.`
    : ''
  const changed = starterProofBrief || (session.rating >= 4
    ? `${session.focusTitle} held up in ${session.drillTitle}${cleanProofValue ? ` (${cleanProofValue} clean)` : ''}${pressureProofBrief ? ` under pressure: ${pressureProofBrief}` : ''}.`
    : `${session.focusTitle} got a live proof read in ${session.drillTitle}.`)
  const leaked = playerNote
    ? shortenCoachBriefValue(playerNote)
    : starterLeakBrief
      ? starterLeakBrief
    : session.feeling === 'ready'
      ? 'No major leak logged; test it under pressure next.'
      : `${feelingLabels[session.feeling]} showed up. Watch setup speed before adding pressure.`
  const next = selectedNextCue
    ? selectedNextCue.recap
    : selectedCoachAsk
      ? 'Ask for the next assigned rep'
      : starterRead
      ? starterRead.starterSmartNext
      : 'Repeat once, then ask for the next rep.'

  return [
    { label: 'Changed', value: shortenCoachBriefValue(changed), state: 'strong' },
    { label: 'Leaked', value: shortenCoachBriefValue(leaked), state: session.rating >= 4 && session.feeling === 'ready' && !playerNote ? 'strong' : 'watch' },
    { label: 'Next', value: shortenCoachBriefValue(next), state: 'next' },
  ]
}

function getCourtsideResumeItems(
  drill: DrillOption,
  activeTimerSeconds: number,
  proofCounter: number,
  proofTarget: number,
  isScoring: boolean,
  hasUnsavedSessionDraft: boolean,
  lastSavedSession: SavedSession | null,
  savedProofRecapSent: boolean,
): CourtsideResumeItem[] {
  const hasActiveSaveReceipt = Boolean(lastSavedSession)
  const savedCleanProofValue = lastSavedSession ? getSavedProofCounterValue(lastSavedSession) : null
  const nextTap = hasActiveSaveReceipt
    ? savedProofRecapSent
      ? 'Sent recap'
      : 'Repeat or new'
    : isScoring
      ? 'Pick score'
      : hasUnsavedSessionDraft
        ? 'Finish score'
      : proofCounter >= proofTarget
        ? 'Score now'
        : activeTimerSeconds > 0 || proofCounter > 0
          ? '+1 proof'
          : 'Start work'

  return [
    {
      label: 'Clock',
      value: activeTimerSeconds > 0 ? formatClock(activeTimerSeconds) : drill.duration,
      state: activeTimerSeconds > 0 ? 'active' : 'ready',
    },
    {
      label: 'Clean',
      value: savedCleanProofValue ?? (lastSavedSession ? 'Saved' : `${proofCounter}/${proofTarget}`),
      state: lastSavedSession || proofCounter >= proofTarget ? 'done' : proofCounter > 0 ? 'active' : 'ready',
    },
    {
      label: 'Next tap',
      value: nextTap,
      state: hasActiveSaveReceipt || proofCounter >= proofTarget ? 'done' : isScoring || hasUnsavedSessionDraft ? 'active' : 'ready',
    },
  ]
}

function getCourtsideResumeStatus(
  activeTimerSeconds: number,
  proofCounter: number,
  proofTarget: number,
  isScoring: boolean,
  hasUnsavedSessionDraft: boolean,
  lastSavedSession: SavedSession | null,
  savedProofRecapSent: boolean,
) {
  if (lastSavedSession) {
    if (savedProofRecapSent) return 'Recap marked sent on this phone. Repeat or change focus when ready.'

    const savedCleanProofValue = getSavedProofCounterValue(lastSavedSession)
    return savedCleanProofValue
      ? `${lastSavedSession.rating}/5 proof saved with ${savedCleanProofValue} clean. Repeat, change focus, or send the recap.`
      : `${lastSavedSession.rating}/5 proof saved. Repeat, change focus, or send the recap.`
  }
  if (isScoring && hasUnsavedSessionDraft) return 'Draft restored. Finish the proof rating, then save.'
  if (isScoring) return 'Score panel is open. Pick the honest proof rating.'
  if (hasUnsavedSessionDraft) return 'Draft saved on this phone. Tap Score to finish.'
  if (proofCounter >= proofTarget) return 'Proof target hit. Score this block before adding more.'
  if (proofCounter > 0) return `${proofCounter} clean proof ${proofCounter === 1 ? 'rep' : 'reps'} logged. Keep the same standard.`
  if (activeTimerSeconds > 0) return `${formatClock(activeTimerSeconds)} in. Count only the reps that match the cue.`
  return 'Ready courtside. Run the rep, then log clean proof.'
}

function getActiveSessionResumeStrip(
  drill: DrillOption,
  activeTimerSeconds: number,
  proofCounter: number,
  proofTarget: number,
  hasUnsavedSessionDraft: boolean,
  isScoring: boolean,
  hasActiveSaveReceipt: boolean,
): ActiveSessionResumeStrip | null {
  if (hasActiveSaveReceipt) return null

  if (hasUnsavedSessionDraft) {
    return {
      title: drill.title,
      detail: isScoring
        ? 'Draft score is open. Finish the proof save.'
        : `Draft score saved on this phone. ${proofCounter}/${proofTarget} clean.`,
      action: 'score',
      actionLabel: isScoring ? 'Keep scoring' : 'Resume score',
      state: 'draft',
    }
  }

  if (activeTimerSeconds > 0) {
    return {
      title: drill.title,
      detail: `${formatClock(activeTimerSeconds)} running here. ${proofCounter}/${proofTarget} clean.`,
      action: 'drill',
      actionLabel: 'Resume drill',
      state: 'timer',
    }
  }

  if (proofCounter > 0) {
    return {
      title: drill.title,
      detail: `${proofCounter}/${proofTarget} clean proof ${proofCounter === 1 ? 'rep' : 'reps'} logged.`,
      action: proofCounter >= proofTarget ? 'score' : 'drill',
      actionLabel: proofCounter >= proofTarget ? 'Score now' : 'Resume drill',
      state: 'proof',
    }
  }

  return null
}

function getSavedProofCounterValue(session: SavedSession) {
  const match = session.note.match(/Clean proof reps: (\d+)\/(\d+)\./)
  return match ? `${match[1]}/${match[2]}` : null
}

function getSavedPressureProofValue(session: SavedSession) {
  const match = session.note.match(/\[Pressure proof: ([^\]]+)\]/)
  return match?.[1]?.trim() || null
}

function getSavedStarterProofValue(session: SavedSession) {
  const match = session.note.match(/\[Starter proof: ([^\]]+)\]/)
  return match?.[1]?.trim() || null
}

function getSavedStarterCoachRead(session: SavedSession): SavedStarterCoachRead | null {
  const starterRead = session.starterRead ?? getSavedStarterReadFromNote(session.note)
  if (!starterRead) return null

  return {
    ...starterRead,
    starterProof: getSavedStarterProofValue(session),
  }
}

function getSavedStarterReadFromNote(note: string): SavedSessionStarterRead | null {
  const starterRep = getSavedStarterReadMarkerValue(note, 'Starter rep')
  const starterProofCue = getSavedStarterReadMarkerValue(note, 'Starter proof cue')
  const starterLeakWatch = getSavedStarterReadMarkerValue(note, 'Starter leak watch')
  const starterSmartNext = getSavedStarterReadMarkerValue(note, 'Starter smart next')

  if (!starterRep || !starterProofCue || !starterLeakWatch || !starterSmartNext) return null

  return { starterRep, starterProofCue, starterLeakWatch, starterSmartNext }
}

function getSavedStarterReadMarkerValue(note: string, label: string) {
  const match = note.match(new RegExp(`\\[${label}: ([^\\]]+)\\]`))
  return match?.[1]?.trim() || ''
}

function getPlayerProofNote(note: string) {
  return note
    .replace(/Clean proof reps: \d+\/\d+\./g, '')
    .replace(/\[Pressure proof: [^\]]+\]/g, '')
    .replace(/\[Starter proof: [^\]]+\]/g, '')
    .replace(/\[Starter rep: [^\]]+\]/g, '')
    .replace(/\[Starter proof cue: [^\]]+\]/g, '')
    .replace(/\[Starter leak watch: [^\]]+\]/g, '')
    .replace(/\[Starter smart next: [^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getRecentSessionDetail(session: SavedSession) {
  const pressureProof = getSavedPressureProofValue(session)
  const starterProof = getSavedStarterProofValue(session)
  const playerNote = getPlayerProofNote(session.note)
  const baseDetail = `${session.rating}/5 ${formatClock(session.elapsedSeconds)} ${feelingLabels[session.feeling] ?? 'Ready'} ${accessModes[session.accessMode]?.label ?? 'Level Up'} ${session.sharedWithCoach ? 'shared with coach' : 'private'}`

  return `${baseDetail}${starterProof ? ` starter proof: ${starterProof}` : ''}${pressureProof ? ` pressure proof: ${pressureProof}` : ''}${playerNote ? ` - ${playerNote}` : ''}`
}

function shortenCoachBriefValue(value: string) {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  return cleaned.length > 96 ? `${cleaned.slice(0, 93).trim()}...` : cleaned
}

function buildSavedCoachFollowUpHref(session: SavedSession) {
  const pressureProof = getSavedPressureProofValue(session)
  const starterProof = getSavedStarterProofValue(session)
  const starterRead = getSavedStarterCoachRead(session)
  const playerNote = getPlayerProofNote(session.note)
  const params = new URLSearchParams({
    compose: 'direct',
    recipient: 'Coach',
    subject: `Player ID follow-up: ${session.assignmentTitle || session.drillTitle}`,
    body: `Player ID read: ${session.focusTitle}. Train first: ${starterRead?.starterRep ?? session.drillTitle}. Proof target: ${starterRead?.starterProofCue ?? `${session.rating}/5`}. Score: ${session.rating}/5${starterProof ? `. Starter proof: ${starterProof}` : ''}${pressureProof ? `. Pressure proof: ${pressureProof}` : ''}${starterRead ? `. Leak watch: ${starterRead.starterLeakWatch}. Smart next: ${starterRead.starterSmartNext}` : ''}${playerNote ? ` - ${playerNote}` : ''}. Coach question: What should I run next?`,
  })
  if (session.studentLinkId) {
    params.set('entityType', 'coach_player_link')
    params.set('entityId', session.studentLinkId)
  }
  if (session.assignmentId) params.set('assignmentId', session.assignmentId)
  if (session.assignmentTitle) params.set('assignmentTitle', session.assignmentTitle)
  params.set('assignmentFocus', session.focusTitle)
  return `/messages?${params.toString()}`
}

function buildSavedProofRecap(
  session: SavedSession,
  selectedNextCue: SavedNextCue | null,
  selectedProofMoment: SavedProofMoment | null,
  selectedCoachAsk: SavedCoachAsk | null,
  coachBrief: SavedCoachBriefLine[],
) {
  const pressureProof = getSavedPressureProofValue(session)
  const starterProof = getSavedStarterProofValue(session)
  const starterRead = getSavedStarterCoachRead(session)
  const playerNote = getPlayerProofNote(session.note)

  return [
    `Level Up proof: ${session.focusTitle}.`,
    `Drill: ${session.drillTitle}.`,
    `Score: ${session.rating}/5; time: ${formatClock(session.elapsedSeconds)}; feeling: ${feelingLabels[session.feeling].toLowerCase()}.`,
    starterRead ? `Starter rep: ${starterRead.starterRep}` : '',
    starterRead ? `Starter proof cue: ${starterRead.starterProofCue}` : '',
    starterRead ? `Leak watch: ${starterRead.starterLeakWatch}` : '',
    starterRead ? `Smart next: ${starterRead.starterSmartNext}` : '',
    starterProof ? `Starter: ${starterProof}` : '',
    pressureProof ? `Pressure: ${pressureProof}` : '',
    ...coachBrief.map((line) => `${line.label}: ${line.value}`),
    selectedProofMoment ? `Moment: ${selectedProofMoment.recap}.` : '',
    playerNote ? `Note: ${playerNote}` : '',
    session.assignmentTitle ? `Assignment: ${session.assignmentTitle}.` : '',
    selectedNextCue ? `Next: ${selectedNextCue.recap}.` : starterRead ? `Next: ${starterRead.starterSmartNext}` : 'Next: repeat once or finish with a clean proof trail.',
    selectedCoachAsk ? `Coach ask: ${selectedCoachAsk.recap}` : 'Coach ask: What should I run next?',
  ].filter(Boolean).join(' ')
}

function buildSavedProofTextRecap(
  session: SavedSession,
  selectedNextCue: SavedNextCue | null,
  selectedProofMoment: SavedProofMoment | null,
  selectedCoachAsk: SavedCoachAsk | null,
  coachBrief: SavedCoachBriefLine[],
) {
  const cleanProof = getSavedProofCounterValue(session)
  const pressureProof = getSavedPressureProofValue(session)
  const starterProof = getSavedStarterProofValue(session)
  const starterRead = getSavedStarterCoachRead(session)
  const changed = coachBrief.find((line) => line.label === 'Changed')?.value
  const leaked = coachBrief.find((line) => line.label === 'Leaked')?.value
  const next = coachBrief.find((line) => line.label === 'Next')?.value
  return [
    `${session.focusTitle}: ${session.drillTitle}`,
    `${session.rating}/5`,
    cleanProof ? `${cleanProof} clean` : '',
    starterRead ? `Starter rep: ${starterRead.starterRep}` : starterProof ? `Starter: ${starterProof}` : '',
    starterRead ? `Cue: ${starterRead.starterProofCue}` : '',
    starterRead ? `Smart: ${starterRead.starterSmartNext}` : '',
    pressureProof ? `Pressure: ${pressureProof}` : '',
    selectedProofMoment?.label ?? '',
    changed ? `Changed: ${changed}` : '',
    leaked ? `Leaked: ${leaked}` : '',
    next ? `Next: ${next}` : selectedNextCue ? `Next: ${selectedNextCue.recap}` : 'Next: repeat once',
    selectedCoachAsk ? `Ask: ${selectedCoachAsk.recap}` : 'Ask: next rep?',
  ].filter(Boolean).join(' | ')
}

function buildSavedProofTextHref(recap: string) {
  return `sms:?&body=${encodeURIComponent(recap)}`
}

function appendQuickNote(currentNote: string, nextNote: string) {
  const cleanedCurrent = currentNote.trim()
  const cleanedNext = nextNote.trim()
  if (!cleanedNext || cleanedCurrent.includes(cleanedNext)) return cleanedCurrent

  const sentence = /[.!?]$/.test(cleanedNext) ? cleanedNext : `${cleanedNext}.`
  const combined = cleanedCurrent ? `${cleanedCurrent} ${sentence}` : sentence
  return combined.length > 220 ? combined.slice(0, 220).trim() : combined
}

function getQuickNoteChips(drill: DrillOption) {
  const profile = `${drill.title} ${drill.summary} ${drill.proof} ${drill.sourceCard?.tags.join(' ') ?? ''} ${drill.sourceCard?.category ?? ''}`.toLowerCase()

  if (profile.includes('serve') || profile.includes('target')) {
    return ['Target stayed clear.', 'Routine rushed.', 'Missed long under pressure.', 'Repeat same target.']
  }

  if (profile.includes('double') || profile.includes('partner')) {
    return ['Partner call was early.', 'Late switch call.', 'Net player stayed active.', 'Repeat poach read.']
  }

  if (drill.workType === 'mental' || profile.includes('reset') || profile.includes('breath')) {
    return ['Reset worked.', 'Breathing rushed.', 'Cue stayed simple.', 'Repeat under score.']
  }

  if (drill.workType === 'physical' || profile.includes('warm-up') || profile.includes('mobility')) {
    return ['Body felt ready.', 'Footwork got heavy.', 'Posture stayed clean.', 'Scale load down.']
  }

  return ['Split step was on time.', 'First move was late.', 'Recovery was clean.', 'Repeat with pressure.']
}

function getFinishSummaryStats(sessions: SavedSession[]) {
  const count = sessions.length
  const totalSeconds = sessions.reduce((total, session) => total + session.elapsedSeconds, 0)
  const bestSession = sessions.reduce<SavedSession | null>((best, session) => {
    if (!best) return session
    return session.rating > best.rating ? session : best
  }, null)

  return {
    count,
    average: count ? (sessions.reduce((total, session) => total + session.rating, 0) / count).toFixed(1) : '0.0',
    time: formatClock(totalSeconds),
    bestRating: bestSession?.rating ?? 0,
    bestDrill: bestSession?.drillTitle ?? 'One clean block',
  }
}

function getTodayCloseoutRead(sessions: SavedSession[]): TodayCloseoutRead | null {
  if (sessions.length < 2) return null

  const bestSession = sessions.reduce<SavedSession>((best, session) => {
    if (session.rating !== best.rating) return session.rating > best.rating ? session : best
    return session.elapsedSeconds >= best.elapsedSeconds ? session : best
  }, sessions[0])
  const pressureSession = sessions.find((session) => getSavedPressureProofValue(session))
  const pressureProof = pressureSession ? getSavedPressureProofValue(pressureSession) : null
  const starterSession = pressureSession ?? bestSession
  const tomorrowDrill = starterSession.drillTitle
  const tomorrowFocus = starterSession.focusTitle

  return {
    bestProof: `${bestSession.drillTitle} ${bestSession.rating}/5`,
    pressureProof: pressureProof ? shortenCoachBriefValue(pressureProof) : 'No pressure proof yet',
    tomorrow: pressureProof
      ? `Repeat ${tomorrowDrill} once before adding volume.`
      : `Start with ${tomorrowFocus}: ${tomorrowDrill}.`,
    starterFocusId: starterSession.focusId,
    starterFocusTitle: starterSession.focusTitle,
    starterWorkType: starterSession.workType,
    starterContext: starterSession.context,
    starterDrillTitle: starterSession.drillTitle,
    starterReason: pressureProof ? 'Pressure proof becomes the first rep.' : 'Best proof becomes the first rep.',
  }
}

function getDrillActionSteps(summary: string) {
  const cleaned = summary
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((item) => shortenDrillStep(item.replace(/[.!?]+$/, '').trim()))
    .filter(Boolean)
    .slice(0, 3)

  return cleaned.length ? cleaned : ['Start the drill', 'Track the target', 'Score the work']
}

function getLiveCourtsideCommand(
  drill: DrillOption,
  steps: string[],
  proofTarget: number,
  readiness: PlayerReadiness,
): LiveCourtsideCommand {
  const card = drill.sourceCard
  const profile = `${drill.title} ${drill.summary} ${drill.proof} ${card?.tags.join(' ') ?? ''} ${card?.category ?? ''}`.toLowerCase()
  const firstStep = steps[0] ?? shortenDrillStep(drill.summary)
  const qualityStandard = card ? getCardQualityStandard(card) : getDrillQualityStandard(profile)
  const commonMiss = card ? getCardCommonMiss(card) : getDrillCommonMiss(profile)
  const countTarget = Math.max(3, Math.min(proofTarget, readiness === 'tired' ? 5 : proofTarget))

  let now = firstStep
  if (profile.includes('serve')) now = 'Call target before the toss, then run the first-ball idea.'
  else if (profile.includes('recover')) now = 'Hit, recover to ready, then judge the shot.'
  else if (profile.includes('return')) now = 'Name the return job before the toss.'
  else if (profile.includes('doubles') || profile.includes('partner')) now = 'Say the plan early enough for your partner to move.'
  else if (profile.includes('mobility') || profile.includes('stretch') || profile.includes('reset')) now = 'Move slowly enough that breath and posture stay clean.'
  else if (profile.includes('conditioning') || profile.includes('fatigue') || profile.includes('stability')) now = 'Keep tennis posture before adding speed or volume.'

  return {
    now,
    count: `Tap +1 when: ${qualityStandard}`,
    stop:
      readiness === 'tired'
        ? `Score after ${countTarget} clean reps or the first form break.`
        : `Score at ${countTarget} clean reps, or stop when: ${commonMiss}`,
  }
}

function getDrillQualityStandard(profile: string) {
  if (profile.includes('serve')) return 'Target is named before the motion and the next ball stays clear.'
  if (profile.includes('recover')) return 'Recovery happens before watching the shot.'
  if (profile.includes('return')) return 'The return job is clear before the toss.'
  if (profile.includes('doubles') || profile.includes('partner')) return 'The call is early enough for the partner to act.'
  if (profile.includes('mobility') || profile.includes('stretch') || profile.includes('reset')) return 'Breath and posture stay controlled.'
  if (profile.includes('conditioning') || profile.includes('fatigue') || profile.includes('stability')) return 'Tennis posture holds while effort rises.'
  return 'The main cue shows up without needing a reminder.'
}

function getDrillCommonMiss(profile: string) {
  if (profile.includes('serve')) return 'The target call or first-ball idea disappears.'
  if (profile.includes('recover')) return 'Watching the shot before getting back to ready.'
  if (profile.includes('return')) return 'Reacting late because the return job was vague.'
  if (profile.includes('doubles') || profile.includes('partner')) return 'The plan comes too late for the partner to use.'
  if (profile.includes('mobility') || profile.includes('stretch') || profile.includes('reset')) return 'Range is forced instead of controlled.'
  if (profile.includes('conditioning') || profile.includes('fatigue') || profile.includes('stability')) return 'Effort rises after posture quality drops.'
  return 'Adding volume before the habit is clean.'
}

function getCardWorkBlock(card: LevelUpCard) {
  if (card.tags.includes('jump-rope')) return '4 x 30 seconds with 30 seconds reset.'
  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) return '3 rounds of 6 serves or shadows.'
  if (card.tags.includes('recovery-after-contact')) return '3 rounds of 8 reps, reset after every rep.'
  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) return 'Use it for 6 pressure points or misses.'
  if (card.tags.includes('wall-work') || card.tags.includes('wall')) return '3 x 2-minute wall blocks with recovery rule.'
  if (card.tags.includes('doubles') || card.tags.includes('doubles-communication')) return 'Play 2 service games with the call before each point.'
  if (card.category === 'strength-stability') return '2-3 clean sets. Stop before posture breaks.'
  if (card.category === 'conditioning') return 'Short intervals. Rest when tennis posture fades.'
  if (card.category === 'mobility-stretch' || card.category === 'recovery-reset') return '45 seconds each side, slow and controlled.'
  return `${card.durationMinutes} minutes of clean reps.`
}

function getCardQualityStandard(card: LevelUpCard) {
  if (card.tags.includes('recover-before-watching')) return 'You recover before judging whether the shot was good.'
  if (card.tags.includes('recovery-after-contact')) return 'Finish, recover, then read with balanced feet.'
  if (card.tags.includes('leg-durability')) return 'Breathing stays steady and shoulders stay quiet.'
  if (card.tags.includes('light-feet')) return 'Landings stay quiet and the first move is controlled.'
  if (card.tags.includes('serve-target')) return 'Target is called before the motion starts.'
  if (card.tags.includes('serve-plus-one')) return 'Serve target and next-ball idea match.'
  if (card.tags.includes('return-intent')) return 'Return job is chosen before the toss.'
  if (card.tags.includes('defense-to-neutral')) return 'Ball shape buys time and recovery happens immediately.'
  if (card.tags.includes('attack-balance')) return 'You attack from balance, not hope.'
  if (card.tags.includes('doubles-communication')) return 'Partner can hear the plan before the ball is live.'
  if (card.category === 'mental-routine') return 'The next point starts with a cue, not a replay.'
  if (card.category === 'mobility-stretch' || card.category === 'recovery-reset') return 'Range improves without forcing or changing posture.'
  return 'The cue shows up without needing a reminder.'
}

function getCardCommonMiss(card: LevelUpCard) {
  if (card.tags.includes('recover-before-watching')) return 'Watching the shot before moving back to ready.'
  if (card.tags.includes('leg-durability')) return 'Knees collapse, breath stops, or shoulders climb.'
  if (card.tags.includes('jump-rope') || card.tags.includes('light-feet')) return 'Chasing speed while landings get loud.'
  if (card.tags.includes('serve')) return 'Rushing into the motion before naming the target.'
  if (card.tags.includes('return')) return 'Reacting late because the return job was vague.'
  if (card.tags.includes('defense-to-neutral')) return 'Trying to win from defense instead of resetting neutral.'
  if (card.tags.includes('attack-balance')) return 'Closing fast but hitting off-balance.'
  if (card.tags.includes('doubles')) return 'Moving first and explaining the plan later.'
  if (card.category === 'strength-stability' || card.category === 'conditioning') return 'Adding effort after posture quality drops.'
  if (card.category === 'mobility-stretch' || card.category === 'recovery-reset') return 'Forcing range instead of breathing through control.'
  return 'Adding volume before the habit is clean.'
}

function getLiveProofRubric(card?: LevelUpCard) {
  const proof = card?.proof.toLowerCase() ?? ''

  if (proof.includes('serve') || card?.tags.some((tag) => tag.includes('serve'))) {
    return [
      { value: '0-1', label: 'No target or routine yet' },
      { value: '3', label: 'Routine showed up sometimes' },
      { value: '5', label: 'Target and routine stayed clear' },
    ]
  }
  if (proof.includes('recovery') || card?.tags.includes('recovery-after-contact')) {
    return [
      { value: '0-1', label: 'Watched before recovering' },
      { value: '3', label: 'Recovered on some reps' },
      { value: '5', label: 'Recovered before judging' },
    ]
  }
  if (proof.includes('fatigue') || card?.tags.includes('leg-durability') || card?.tags.includes('conditioning')) {
    return [
      { value: '0-1', label: 'Posture broke quickly' },
      { value: '3', label: 'Held form part of the block' },
      { value: '5', label: 'Quality held under fatigue' },
    ]
  }
  if (proof.includes('doubles') || card?.tags.some((tag) => tag.includes('doubles') || tag.includes('partner'))) {
    return [
      { value: '0-1', label: 'Plan was unclear' },
      { value: '3', label: 'Call helped sometimes' },
      { value: '5', label: 'Partner could act on it' },
    ]
  }

  return [
    { value: '0-1', label: 'Habit did not show up yet' },
    { value: '3', label: 'Showed up sometimes' },
    { value: '5', label: 'Automatic enough today' },
  ]
}

function shortenDrillStep(step: string) {
  if (step.length <= 64) return step
  const colonIndex = step.indexOf(':')
  if (colonIndex > 8 && colonIndex < 64) return step.slice(0, colonIndex).trim()
  const commaIndex = step.indexOf(',')
  if (commaIndex > 12 && commaIndex < 64) return step.slice(0, commaIndex).trim()
  return `${step.slice(0, 61).trim()}...`
}

function getActionStepLabel(index: number) {
  return ['Do', 'Track', 'Score'][index] ?? 'Next'
}

function getProgressSummary(sessions: SavedSession[], focuses: LiveFocus[]) {
  const average = sessions.length
    ? (sessions.reduce((total, session) => total + session.rating, 0) / sessions.length).toFixed(1)
    : '0.0'
  const focusCounts = new Map<string, number>()
  for (const session of sessions) {
    focusCounts.set(session.focusId, (focusCounts.get(session.focusId) ?? 0) + 1)
  }
  const top = [...focusCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  const low = focuses
    .filter((focus) => focus.id !== 'accountability')
    .map((focus) => [focus.id, focus.title.replace(' Development', ''), focusCounts.get(focus.id) ?? 0] as const)
    .sort((a, b) => a[2] - b[2])[0]

  return {
    average,
    topFocus: top ? focuses.find((focus) => focus.id === top[0])?.title.replace(' Development', '') : '',
    lowFocus: low?.[2] === 0 || sessions.length > 2 ? low?.[1] : '',
    sharedCount: sessions.filter((session) => session.sharedWithCoach).length,
    nextMove: low?.[1] ? `Level up ${low[1]}` : 'Calendar-ready later',
  }
}
