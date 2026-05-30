'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
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
type AccessMode = 'coach_invited' | 'player_plus' | 'free_preview'

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

type SyncState = {
  status: 'idle' | 'syncing' | 'synced' | 'local' | 'error'
  message: string
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
  court: 'Court drills',
  physical: 'Physical',
  mental: 'Mind / habit',
}

const contextLabels: Record<TrainingContext, string> = {
  alone: 'Training alone',
  partner: 'With a partner',
  singles: 'Singles points',
  doubles: 'Doubles',
  coach: 'Coach challenge',
}

const feelingLabels: Record<PlayerFeeling, string> = {
  ready: 'Ready',
  tight: 'Tight',
  tired: 'Tired',
  nervous: 'Nervous',
}

const accessModes: Record<AccessMode, { label: string; title: string; copy: string; action: string }> = {
  coach_invited: {
    label: 'Coach invite',
    title: 'Included through your coach',
    copy: 'Use assigned challenges, rate the work, and share quick recaps back to the coach who invited you.',
    action: 'Coach can review shared work',
  },
  player_plus: {
    label: 'Player+',
    title: 'Full self-guided Level Up',
    copy: 'Use Level Up without a coach invite, save history across devices, and unlock trends, recommendations, and My Lab progress.',
    action: 'Player owns the full plan',
  },
  free_preview: {
    label: 'Free preview',
    title: 'Try the on-court flow',
    copy: 'Explore a limited local session. Coach syncing and full history unlock through a coach invite or Player+.',
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
  const assignmentId = searchParams.get('assignmentId')?.trim() ?? ''
  const studentLinkId = searchParams.get('studentLinkId')?.trim() ?? ''
  const assignmentTitle = searchParams.get('assignmentTitle')?.trim() || searchParams.get('title')?.trim() || ''
  const assignmentFocus = searchParams.get('assignmentFocus')?.trim() || searchParams.get('focus')?.trim() || ''
  const assignmentWorkType = normalizeAssignmentWorkType(searchParams.get('workType'))
  const hasCoachAssignment = Boolean(assignmentId || studentLinkId || searchParams.get('coach') === '1')
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
  const initialWorkType = hasCoachAssignment ? assignmentWorkType ?? 'court' : 'court'
  const [activeFocusId, setActiveFocusId] = useState(initialFocusId)
  const [context, setContext] = useState<TrainingContext>(hasCoachAssignment ? 'coach' : 'alone')
  const [workType, setWorkType] = useState<WorkType>(initialWorkType)
  const [accessMode, setAccessMode] = useState<AccessMode>('coach_invited')
  const [activeDrillId, setActiveDrillId] = useState(hasCoachAssignment ? `${initialFocusId}-coach-${initialWorkType}` : '')
  const [draft, setDraft] = useState(emptyDraft)
  const [lastSavedSession, setLastSavedSession] = useState<SavedSession | null>(null)
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle', message: '' })
  const storageKey = `tenaceiq:level-up:${identitySlug}`
  const [sessions, setSessions] = useState<SavedSession[]>(() => readSavedSessions(storageKey))

  const activeFocus = playableFocuses.find((focus) => focus.id === activeFocusId) ?? playableFocuses[0]
  const drillOptions = useMemo(
    () => buildDrillOptions(activeFocus, { solo, partner, offCourt, performance }),
    [activeFocus, solo, partner, offCourt, performance],
  )
  const filteredDrills = drillOptions.filter((drill) => drill.workType === workType && drill.context === context)
  const visibleDrills = filteredDrills.length
    ? filteredDrills
    : drillOptions.filter((drill) => drill.workType === workType).length
      ? drillOptions.filter((drill) => drill.workType === workType)
      : drillOptions
  const activeDrill = visibleDrills.find((drill) => drill.id === activeDrillId) ?? visibleDrills[0]
  const recentSessions = sessions.slice(0, 4)
  const progress = getProgressSummary(sessions, playableFocuses)
  const activeAccess = accessModes[accessMode]

  useEffect(() => {
    if (!hasCoachAssignment) return

    const nextFocusId = assignmentFocusMatch?.id ?? defaultFocusId
    const nextWorkType = assignmentWorkType ?? 'court'
    setAccessMode('coach_invited')
    setContext('coach')
    setWorkType(nextWorkType)
    setDraft((current) => ({ ...current, sharedWithCoach: true }))
    setSyncState({ status: 'idle', message: 'Coach challenge loaded. Rate and save after the work.' })
    setActiveFocusId(nextFocusId)
    setActiveDrillId(`${nextFocusId}-coach-${nextWorkType}`)
  }, [assignmentFocusMatch, assignmentWorkType, defaultFocusId, hasCoachAssignment])

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

  function chooseFocus(focusId: string) {
    setActiveFocusId(focusId)
    setActiveDrillId('')
    setDraft(emptyDraft)
    setSyncState({ status: 'idle', message: '' })
  }

  function chooseContext(nextContext: TrainingContext) {
    setContext(nextContext)
    if (nextContext === 'coach') setWorkType('court')
    if (nextContext === 'doubles') setWorkType('court')
    setActiveDrillId('')
  }

  function chooseWorkType(nextWorkType: WorkType) {
    setWorkType(nextWorkType)
    setActiveDrillId('')
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
  }

  function saveSession() {
    if (!activeFocus || !activeDrill || draft.rating === null) return

    const nextSession: SavedSession = {
      id: `${Date.now()}-${activeFocus.id}-${activeDrill.id}`,
      focusId: activeFocus.id,
      focusTitle: activeFocus.title.replace(' Development', ''),
      workType,
      context,
      drillTitle: activeDrill.title,
      rating: draft.rating,
      feeling: draft.feeling,
      accessMode,
      note: draft.note.trim(),
      elapsedSeconds: getTimerSeconds(activeDrill.id),
      sharedWithCoach: draft.sharedWithCoach,
      completedAt: new Date().toISOString(),
      assignmentId: assignmentId || undefined,
      studentLinkId: studentLinkId || undefined,
      assignmentTitle: assignmentTitle || undefined,
    }
    const nextSessions = [nextSession, ...sessions].slice(0, 40)
    setSessions(nextSessions)
    window.localStorage.setItem(storageKey, JSON.stringify(nextSessions))
    setLastSavedSession(nextSession)
    setDraft(emptyDraft)
    setSyncState({ status: 'syncing', message: 'Saved on this device. Syncing now...' })
    void syncLevelUpSession(nextSession)
  }

  async function syncLevelUpSession(session: SavedSession) {
    if (session.accessMode === 'free_preview') {
      setSyncState({ status: 'local', message: 'Free preview saved locally. Coach invite or Player+ turns on cloud history.' })
      return
    }

    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      setSyncState({ status: 'local', message: 'Saved locally. Sign in from a coach invite or Player+ to sync it.' })
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
            ? 'Synced. Coach assignment marked complete for review.'
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

  return (
    <section className={styles.liveWorkbench} aria-labelledby="live-workbench-title">
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
      </div>

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
          <span>Player+ unlock</span>
          <strong>Saved history, trends, and recommendations.</strong>
          <p>Player+ turns quick logs into My Lab progress, match evidence, and next-focus intelligence.</p>
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
        <span>Pick focus</span>
        <span>Choose setup</span>
        <span>Start timer</span>
        <span>Rate and save</span>
      </div>

      <div id="level-up-flow" className={styles.liveTrainingFlow}>
        <div className={styles.liveStepPanel}>
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
          </div>
        </div>

        <div className={styles.liveStepPanel}>
          <span>2. Setup</span>
          <strong>How are you training?</strong>
          <div className={styles.liveContextGrid} aria-label="Choose training setup">
            {(Object.keys(contextLabels) as TrainingContext[]).map((key) => (
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
        </div>

        <div className={styles.liveWorkbenchBody}>
          <div className={styles.liveLaneColumn}>
            <div className={styles.liveCurrentGoal}>
              <span>Current plan</span>
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

          <article className={styles.liveActionCard}>
            <span>{workTypeLabels[activeDrill.workType]} / {contextLabels[activeDrill.context]}</span>
            <h3>{activeDrill.title}</h3>
            <p>{activeDrill.summary}</p>
            <div className={styles.liveMicroPlan}>
              <span>Target</span>
              <strong>{activeFocus.tracker[0] ?? 'Proof rating'}</strong>
              <p>Win the drill by showing the habit, not just by liking the outcome.</p>
            </div>
            <div className={styles.liveActionGuide}>
              <strong>Time</strong>
              <p>{activeDrill.duration}</p>
            </div>
            <DrillTimer drillId={activeDrill.id} targetSeconds={activeDrill.timerSeconds} key={activeDrill.id} />
            <div className={styles.liveActionGuide}>
              <strong>Proof</strong>
              <p>{activeDrill.proof}</p>
            </div>
            <div className={styles.liveDrillChoices}>
              {visibleDrills.map((drill) => (
                <button
                  type="button"
                  key={drill.id}
                  data-active={drill.id === activeDrill.id ? 'true' : 'false'}
                  onClick={() => setActiveDrillId(drill.id)}
                >
                  {drill.title}
                </button>
              ))}
            </div>
            <div className={styles.liveActionLinks}>
              <a className="button-primary" href={activeDrill.href}>Open guide section</a>
              <a className="button-secondary" href="/mylab#coach-assignments">Send to coach</a>
            </div>
          </article>

          <aside className={styles.liveTracker} aria-label="Quick tracking">
            <span>3. Submit</span>
            <strong>Rate it, add one tiny note, save.</strong>
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
              placeholder="Tiny note: what helped, what broke, what to repeat."
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
            <button type="button" className="button-primary" disabled={draft.rating === null} onClick={saveSession}>
              {syncState.status === 'syncing' ? 'Saving...' : 'Save training log'}
            </button>
            <small>{draft.rating === null ? 'Pick a 0-5 rating before saving.' : 'It saves locally first, then syncs when your access path is connected.'}</small>
          </aside>
        </div>
      </div>

      {lastSavedSession ? (
        <div className={styles.liveSavedBanner} role="status">
          <div>
            <span>Saved</span>
            <strong>{lastSavedSession.focusTitle}: {lastSavedSession.drillTitle}</strong>
            <p>
              {lastSavedSession.rating}/5, {formatClock(lastSavedSession.elapsedSeconds)}, feeling {feelingLabels[lastSavedSession.feeling].toLowerCase()}.
              {' '}
              {syncState.message || (lastSavedSession.accessMode === 'coach_invited' && lastSavedSession.sharedWithCoach
                ? 'Ready to sync to your coach when linked.'
                : lastSavedSession.accessMode === 'player_plus'
                  ? 'Ready for Player+ history and trends.'
                  : 'Kept as a local preview for now.')}
            </p>
          </div>
          <div className={styles.liveSavedActions}>
            <a className="button-primary" href={lastSavedSession.accessMode === 'player_plus' ? '/pricing' : '/mylab#coach-assignments'}>
              {lastSavedSession.accessMode === 'player_plus' ? 'Unlock Player+' : 'Open My Lab'}
            </a>
            <button type="button" className="button-secondary" onClick={() => setLastSavedSession(null)}>
              Keep training
            </button>
          </div>
        </div>
      ) : null}

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

      <div className={styles.liveUnlockPanel} aria-label="Player Plus unlock path">
        <div>
          <span>Player+ unlock</span>
          <strong>Turn on-court logs into a shared development plan.</strong>
          <p>
            Coach-invited players get assigned Level Up work through the coach tier. Players without an invite use Player+
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

function DrillTimer({ drillId, targetSeconds }: { drillId: string; targetSeconds: number }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() => getTimerSeconds(drillId))
  const [running, setRunning] = useState(false)
  const progress = targetSeconds > 0 ? Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100)) : 0
  const targetLabel = targetSeconds > 0 ? formatClock(targetSeconds) : 'Open'

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

  function resetTimer() {
    setRunning(false)
    setElapsedSeconds(0)
    window.sessionStorage.removeItem(timerStorageKey(drillId))
  }

  return (
    <div className={styles.liveTimerPanel}>
      <div>
        <span>Timer</span>
        <strong>{formatClock(elapsedSeconds)}</strong>
        <p>Goal: {targetLabel}. Use this for fitness blocks, timed reps, or focused serve baskets.</p>
      </div>
      <div className={styles.liveTimerTrack} aria-hidden="true">
        <i style={{ width: `${progress}%` }} />
      </div>
      <div className={styles.liveTimerActions}>
        <button type="button" className="button-primary" onClick={() => setRunning((value) => !value)}>
          {running ? 'Pause' : 'Start'}
        </button>
        <button type="button" className="button-secondary" onClick={resetTimer}>
          Reset
        </button>
      </div>
    </div>
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
): DrillOption {
  return { id, title, summary, workType, context, duration, timerSeconds, proof, href }
}

function pickRow(rows: TrainingRow[], focusId: string, fallback: string): TrainingRow {
  const keyword = focusId === 'strokes' ? 'attack' : focusId
  return rows.find(([title, text]) => `${title} ${text}`.toLowerCase().includes(keyword)) ?? rows[0] ?? [fallback, 'Do one focused block and rate the proof 0-5.']
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
