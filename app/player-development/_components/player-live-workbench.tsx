'use client'

import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { LEVEL_UP_CARDS } from '@/lib/level-up/level-up-cards'
import type { LevelUpCard, LevelUpCompletion } from '@/lib/level-up/level-up-types'
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

const emptyDraft = {
  rating: null as number | null,
  feeling: 'ready' as PlayerFeeling,
  note: '',
  sharedWithCoach: true,
}

export default function PlayerLiveWorkbench({
  identitySlug,
  identityTitle,
  mantra,
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
  const [editingStep, setEditingStep] = useState<EditingStep>(hasCoachAssignment || hasQuickStart ? null : 'focus')
  const [draft, setDraft] = useState(emptyDraft)
  const [lastSavedSession, setLastSavedSession] = useState<SavedSession | null>(null)
  const [undoSession, setUndoSession] = useState<SavedSession | null>(null)
  const [finishSummary, setFinishSummary] = useState<SavedSession[] | null>(null)
  const [readiness, setReadiness] = useState<PlayerReadiness>('okay')
  const [scoringDrillId, setScoringDrillId] = useState('')
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle', message: '' })
  const [questCreditMessage, setQuestCreditMessage] = useState('')
  const [activeTimerSnapshot, setActiveTimerSnapshot] = useState<DrillTimerSnapshot | null>(null)
  const [timerResetSignal, setTimerResetSignal] = useState(0)
  const storageKey = `tenaceiq:level-up:${identitySlug}`
  const [sessions, setSessions] = useState<SavedSession[]>(() => readSavedSessions(storageKey))

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
  const contextOptions = contextOptionsByWorkType[workType]
  const recentSessions = sessions.slice(0, 4)
  const todaySessions = sessions.filter(isSessionFromToday).slice(0, 4)
  const drillDayStreak = getDrillDayStreak(sessions, activeDrill?.title ?? '')
  const activeTimerSeconds = activeTimerSnapshot?.drillId === activeDrill?.id ? activeTimerSnapshot.elapsedSeconds : 0
  const progress = getProgressSummary(sessions, playableFocuses)
  const activeAccess = accessModes[accessMode]
  const suggestedNextDrill = lastSavedSession ? getNextDrillAfterSession(lastSavedSession, visibleDrills) : null
  const smartNextAction = lastSavedSession ? getSmartNextAction(lastSavedSession, suggestedNextDrill, readiness) : null
  const finishStats = finishSummary ? getFinishSummaryStats(finishSummary) : null
  const savedIdentitySignals = lastSavedSession
    ? [
        { label: 'Identity', value: identityTitle.replace(/^The /, '') },
        { label: 'Player ID signal', value: `${lastSavedSession.rating}/5 ${lastSavedSession.focusTitle}` },
        { label: 'Next use', value: lastSavedSession.sharedWithCoach ? 'Coach-ready proof' : 'My Lab proof trail' },
      ]
    : []
  const savedDeliverySteps = lastSavedSession
    ? getSavedDeliverySteps(lastSavedSession, syncState, undoSession?.id === lastSavedSession.id)
    : []
  const hasActiveSaveReceipt = Boolean(lastSavedSession)

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
    if (!hasCoachAssignment && !hasQuickStart) return
    if (didMobileAutoScrollRef.current) return
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(max-width: 860px)').matches) return
    didMobileAutoScrollRef.current = true

    const id = window.setTimeout(() => {
      activityRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }, 180)

    return () => window.clearTimeout(id)
  }, [hasCoachAssignment, hasQuickStart])

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
    setActiveFocusId(focusId)
    setActiveDrillId('')
    setDraft(emptyDraft)
    setSyncState({ status: 'idle', message: '' })
    setQuestCreditMessage('')
    setFinishSummary(null)
    setScoringDrillId('')
    setEditingStep('work')
  }

  function chooseContext(nextContext: TrainingContext) {
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
    setAccessMode(nextMode)
    if (nextMode === 'coach_invited') {
      setDraft({ ...draft, sharedWithCoach: true })
      setContext('coach')
    }
    if (nextMode === 'player_plus') {
      setDraft({ ...draft, sharedWithCoach: false })
      if (context === 'coach') setContext('alone')
    }
    if (nextMode === 'free_preview') {
      setDraft({ ...draft, sharedWithCoach: false })
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
      note: nextDraft.note.trim(),
      elapsedSeconds: savedElapsedSeconds,
      sharedWithCoach: nextDraft.sharedWithCoach,
      completedAt: new Date().toISOString(),
      assignmentId: assignmentId || undefined,
      studentLinkId: studentLinkId || undefined,
      assignmentTitle: assignmentTitle || undefined,
    }
    const nextSessions = [nextSession, ...sessions].slice(0, 40)
    setSessions(nextSessions)
    window.localStorage.setItem(storageKey, JSON.stringify(nextSessions))
    if (customQuestId && savedSourceCard) setQuestCreditMessage('Quest XP queued.')
    setLastSavedSession(nextSession)
    setUndoSession(nextSession)
    setFinishSummary(null)
    setDraft(emptyDraft)
    setScoringDrillId('')
    window.sessionStorage.removeItem(timerStorageKey(activeDrill.id))
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

  function chooseDrillOption(drillId: string) {
    if (drillId === activeDrill.id) return
    if (activeTimerSnapshot?.drillId === activeDrill.id && activeTimerSnapshot.running) {
      const shouldSwitch = window.confirm('Switch drills? The current timer will reset to 0:00.')
      if (!shouldSwitch) return
    }
    setActiveDrillId(drillId)
    setScoringDrillId('')
    window.requestAnimationFrame(() => {
      activityRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }

  function repeatActivity() {
    unlockProofSave()
    setLastSavedSession(null)
    setDraft(emptyDraft)
    setScoringDrillId('')
    setQuestCreditMessage('')
    setFinishSummary(null)
    activityRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  function pickNewFocus() {
    unlockProofSave()
    setLastSavedSession(null)
    setDraft(emptyDraft)
    setActiveDrillId('')
    setScoringDrillId('')
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
    setFinishSummary(null)
    chooseDrillOption(suggestedNextDrill.id)
  }

  function finishToday() {
    unlockProofSave()
    setFinishSummary(sessions.filter(isSessionFromToday).slice(0, 6))
    setLastSavedSession(null)
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
    setUndoSession(null)
    setFinishSummary(null)
    setQuestCreditMessage('')
    setLastSavedSession((current) => current?.id === sessionId ? null : current)
    setSyncState({ status: 'local', message: 'Last log undone before sync.' })
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
      </div>

      <nav className={styles.liveSessionDock} aria-label="Level Up bottom session dock">
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

      <div id="level-up-flow" className={styles.liveTrainingFlow}>
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
            <button type="button" className="button-primary" disabled={draft.rating === null || hasActiveSaveReceipt} onClick={saveSession}>
              {hasActiveSaveReceipt ? 'Saved' : syncState.status === 'syncing' ? 'Saving...' : draft.rating === null ? 'Pick rating' : `Save ${draft.rating}/5`}
            </button>
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
              </div>
              <div className={styles.liveNextActionButtons}>
                <button type="button" className="button-primary" onClick={repeatActivity}>
                  Repeat
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
              <p>{session.rating}/5 {formatClock(session.elapsedSeconds)} {feelingLabels[session.feeling] ?? 'Ready'} {accessModes[session.accessMode]?.label ?? 'Level Up'} {session.sharedWithCoach ? 'shared with coach' : 'private'}{session.note ? ` - ${session.note}` : ''}</p>
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const progress = targetSeconds > 0 ? Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100)) : 0
  const targetLabel = targetSeconds > 0 ? formatClock(targetSeconds) : 'Open'
  const timerState = running ? 'running' : elapsedSeconds > 0 ? 'paused' : 'idle'
  const showStickyDock = running || elapsedSeconds > 0

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

function getSmartNextAction(session: SavedSession, suggestedNextDrill: DrillOption | null, readiness: PlayerReadiness) {
  if (readiness === 'tired') {
    return {
      title: 'Bank it or scale down',
      copy: suggestedNextDrill
        ? `You logged the work while tired. Keep the next rep light or use ${suggestedNextDrill.title} only if form stays clean.`
        : 'You logged the work while tired. Finish today or repeat at a lower speed with clean posture.',
    }
  }

  if (session.rating >= 5) {
    return {
      title: suggestedNextDrill ? `Level up into ${suggestedNextDrill.title}` : 'Level up the same drill',
      copy: suggestedNextDrill
        ? 'You scored this clean. Take the next paired drill while the movement pattern is warm.'
        : 'You scored this clean. Repeat it once with a pressure layer or finish for today.',
    }
  }

  if (session.rating <= 3) {
    return {
      title: 'Repeat or scale down',
      copy: 'Keep the same drill and make the next rep cleaner before adding speed or pressure.',
    }
  }

  return {
    title: suggestedNextDrill ? `Move to ${suggestedNextDrill.title}` : 'Bank it and finish strong',
    copy: suggestedNextDrill
      ? 'Good work logged. Move to the paired drill or repeat this one if you want a cleaner score.'
      : 'Good work logged. Repeat once or finish today with a clean proof trail.',
  }
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

function getDrillActionSteps(summary: string) {
  const cleaned = summary
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((item) => shortenDrillStep(item.replace(/[.!?]+$/, '').trim()))
    .filter(Boolean)
    .slice(0, 3)

  return cleaned.length ? cleaned : ['Start the drill', 'Track the target', 'Score the work']
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
