'use client'

import { useMemo, useState } from 'react'
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

type DrillOption = {
  id: string
  title: string
  summary: string
  workType: WorkType
  context: TrainingContext
  duration: string
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
  note: string
  sharedWithCoach: boolean
  completedAt: string
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

const emptyDraft = {
  rating: null as number | null,
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
  const playableFocuses = useMemo(
    () => focuses.filter((focus) => focus.id !== 'accountability'),
    [focuses],
  )
  const defaultFocusId = playableFocuses.find((focus) => focus.id.includes('serve'))?.id ?? playableFocuses[0]?.id ?? 'focus'
  const [activeFocusId, setActiveFocusId] = useState(defaultFocusId)
  const [context, setContext] = useState<TrainingContext>('alone')
  const [workType, setWorkType] = useState<WorkType>('court')
  const [activeDrillId, setActiveDrillId] = useState('')
  const [draft, setDraft] = useState(emptyDraft)
  const storageKey = `tenaceiq:train-today:${identitySlug}`
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

  function chooseFocus(focusId: string) {
    setActiveFocusId(focusId)
    setActiveDrillId('')
    setDraft(emptyDraft)
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
      note: draft.note.trim(),
      sharedWithCoach: draft.sharedWithCoach,
      completedAt: new Date().toISOString(),
    }
    const nextSessions = [nextSession, ...sessions].slice(0, 40)
    setSessions(nextSessions)
    window.localStorage.setItem(storageKey, JSON.stringify(nextSessions))
    setDraft(emptyDraft)
  }

  if (!activeFocus || !activeDrill) return null

  return (
    <section className={styles.liveWorkbench} aria-labelledby="live-workbench-title">
      <div className={styles.liveWorkbenchHero}>
        <div>
          <span>Train today</span>
          <h2 id="live-workbench-title">What do you want to level up right now?</h2>
          <p>{identityTitle.replace(/^The /, '')}: {mantra}</p>
        </div>
        <div className={styles.liveHeroActions}>
          <a className="button-primary" href="#train-today-flow">Start training</a>
          <a className="button-secondary" href="/mylab#coach-assignments">Coach challenges</a>
        </div>
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

      <div id="train-today-flow" className={styles.liveTrainingFlow}>
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
            <div className={styles.liveActionGuide}>
              <strong>Time</strong>
              <p>{activeDrill.duration}</p>
            </div>
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
                checked={draft.sharedWithCoach}
                onChange={(event) => setDraft({ ...draft, sharedWithCoach: event.target.checked })}
              />
              <span>Share this recap with my coach when linked</span>
            </label>
            <button type="button" className="button-primary" disabled={draft.rating === null} onClick={saveSession}>
              Save training log
            </button>
            <small>{draft.rating === null ? 'Pick a 0-5 rating before saving.' : 'This will become coach-visible when connected.'}</small>
          </aside>
        </div>
      </div>

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
          <strong>Calendar-ready later</strong>
          <p>Coach scheduling can connect lesson reminders to the same focus and phone calendar flow.</p>
        </article>
      </div>

      {recentSessions.length ? (
        <div className={styles.liveRecentList}>
          <span>Recent work</span>
          {recentSessions.map((session) => (
            <article key={session.id}>
              <strong>{session.focusTitle}: {session.drillTitle}</strong>
              <p>{session.rating}/5 {session.sharedWithCoach ? 'shared with coach' : 'private'}{session.note ? ` - ${session.note}` : ''}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
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
    drill(`${focusId}-alone-court`, soloTool[0], soloTool[1], 'court', 'alone', '12-20 minutes', `Rate ${tracker.toLowerCase()} 0-5 and record reps or targets made.`, '#solo-training'),
    drill(`${focusId}-partner-court`, partnerTool[0], partnerTool[1], 'court', 'partner', '15-25 minutes', `Rate ${tracker.toLowerCase()} 0-5 and note the constraint score.`, '#partner-training'),
    drill(`${focusId}-singles-court`, `${coachTitle} pressure set`, `Start every point with the ${focus?.cue.toLowerCase() ?? 'focus cue'} and score the drill to 7. Reset after every miss.`, 'court', 'singles', '15 minutes', `Rate whether the habit showed up under score pressure.`, '#match-card'),
    drill(`${focusId}-doubles-court`, partnerTool[0], `${partnerTool[1]} Add a partner call before the serve or return and review one communication cue after each game.`, 'court', 'doubles', '15-25 minutes', 'Rate partner clarity, first move, and recovery after the ball.', '#partner-training'),
    drill(`${focusId}-coach-court`, `Coach challenge: ${coachTitle}`, `Complete the coach-assigned version of this focus, then send the rating and note back through My Lab.`, 'court', 'coach', 'Coach assigned', 'Rate completion honestly and write the one cue your coach should know.', '/mylab#coach-assignments'),
    drill(`${focusId}-alone-physical`, physicalTool[0], physicalTool[1], 'physical', 'alone', '8-15 minutes', `Rate body readiness and ${tracker.toLowerCase()} after the block.`, '#performance-upgrade'),
    drill(`${focusId}-coach-physical`, `Coach challenge: ${physicalTool[0]}`, `${physicalTool[1]} Send the readiness score back if this was assigned.`, 'physical', 'coach', '8-15 minutes', 'Rate readiness 0-5 and note any limitation before the next lesson.', '/mylab#coach-assignments'),
    drill(`${focusId}-mental`, mentalTool[0], mentalTool[1], 'mental', 'alone', '5 minutes', 'Rate routine clarity 0-5 and write the next cue only if it helps.', '#off-court-work'),
    drill(`${focusId}-coach-mental`, 'Coach challenge reflection', `Use the coach assignment prompt, write one proof, one leak, and one request for the next lesson.`, 'mental', 'coach', '3-5 minutes', 'Rate plan clarity and share the recap when linked.', '/mylab#coach-assignments'),
  ]
}

function drill(
  id: string,
  title: string,
  summary: string,
  workType: WorkType,
  context: TrainingContext,
  duration: string,
  proof: string,
  href: string,
): DrillOption {
  return { id, title, summary, workType, context, duration, proof, href }
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
  }
}
