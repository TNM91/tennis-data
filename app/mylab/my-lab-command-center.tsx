'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRightIcon as ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { CalendarBlankIcon as CalendarBlank } from '@phosphor-icons/react/dist/csr/CalendarBlank'
import { ChartLineUpIcon as ChartLineUp } from '@phosphor-icons/react/dist/csr/ChartLineUp'
import { CheckCircleIcon as CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { HouseIcon as House } from '@phosphor-icons/react/dist/csr/House'
import { MapPinIcon as MapPin } from '@phosphor-icons/react/dist/csr/MapPin'
import { RacquetIcon as Racquet } from '@phosphor-icons/react/dist/csr/Racquet'
import { TargetIcon as Target } from '@phosphor-icons/react/dist/csr/Target'
import { TennisBallIcon as TennisBall } from '@phosphor-icons/react/dist/csr/TennisBall'
import { UserCircleIcon as UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import { buildReflectionPatternRead, type PlayerReflection } from '@/lib/player-reflections'
import type { TenAceMemberRead } from '@/lib/player-tenace-read'
import { supabase } from '@/lib/supabase'
import styles from './my-lab-command-center.module.css'

type MatchupPreview = {
  opponentId: string
  opponentName: string
  opponentMeta: string
  read: string
  href: string
}

type NextCourtEvent = {
  title: string
  shortTitle?: string
  context?: string
  date: string
  daysUntil: number
  dateLabel: string
  detail: string
  href: string
  cta: string
  readiness: string
}

type FirstServeStep = {
  title: string
  description: string
  href: string
  action: string
  complete: boolean
}

type PostRepReturn = {
  cardTitle: string
  proofLabel: string
  timeLabel: string
  note: string
  nextAction: string
  nextHref: string
  nextCta: string
  syncLabel: string
  planLabel: string
  planWhy: string
  proofTarget: string
  trendLabel: string
}

type MyLabCommandCenterProps = {
  firstName: string
  playerId: string
  playerName: string
  repTitle: string
  repNote: string
  repDuration: number | null
  repHref: string
  repCta: string
  completedSessions: number
  sessionTarget: number
  progressHref: string
  currentRating: number | null
  ratingBaseline: number | null
  ratingDelta: number | null
  currentFocus: string
  ratingStory: string
  recentRecord: string
  lastResult: string
  winRate: number
  confidence: string
  memberRead: TenAceMemberRead | null
  matchup: MatchupPreview | null
  nextCourtEvent: NextCourtEvent | null
  firstServeSteps: FirstServeStep[]
  postRepReturn: PostRepReturn | null
}

type MobileReflection = {
  id: string
  score: number
  worked: string
  next: string
  savedAt: string
  proofLabel: string
  resultLabel: string
  syncStatus: 'account' | 'device'
}

function normalizeDeviceReflections(value: unknown): MobileReflection[] {
  const candidates = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : []
  return candidates.flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') return []
    const item = candidate as Partial<MobileReflection>
    const score = Math.max(1, Math.min(3, Number(item.score) || 1))
    const savedAt = typeof item.savedAt === 'string' && Number.isFinite(new Date(item.savedAt).getTime())
      ? new Date(item.savedAt).toISOString()
      : new Date(0).toISOString()
    const worked = typeof item.worked === 'string' ? item.worked.slice(0, 140) : ''
    const next = typeof item.next === 'string' ? item.next.slice(0, 140) : ''
    if (!worked && !next) return []
    return [{
      id: typeof item.id === 'string' && item.id ? item.id : `device-${savedAt}-${index}`,
      score,
      worked,
      next,
      savedAt,
      proofLabel: typeof item.proofLabel === 'string' ? item.proofLabel.slice(0, 180) : '',
      resultLabel: typeof item.resultLabel === 'string' ? item.resultLabel.slice(0, 180) : '',
      syncStatus: item.syncStatus === 'account' ? 'account' as const : 'device' as const,
    }]
  }).sort((left, right) => right.savedAt.localeCompare(left.savedAt))
}

function mapAccountReflection(reflection: PlayerReflection): MobileReflection {
  return {
    id: reflection.id,
    score: reflection.outcome,
    worked: reflection.worked,
    next: reflection.nextStep,
    savedAt: reflection.createdAt,
    proofLabel: reflection.proofLabel,
    resultLabel: reflection.resultLabel,
    syncStatus: 'account',
  }
}

function mergeReflectionHistory(account: MobileReflection[], device: MobileReflection[]) {
  const merged = new Map<string, MobileReflection>()
  device.forEach((reflection) => merged.set(reflection.id, reflection))
  account.forEach((reflection) => merged.set(reflection.id, reflection))
  return [...merged.values()].sort((left, right) => right.savedAt.localeCompare(left.savedAt)).slice(0, 20)
}

export default function MyLabCommandCenter({
  firstName,
  playerId,
  playerName,
  repTitle,
  repNote,
  repDuration,
  repHref,
  repCta,
  completedSessions,
  sessionTarget,
  progressHref,
  currentRating,
  ratingBaseline,
  ratingDelta,
  currentFocus,
  ratingStory,
  recentRecord,
  lastResult,
  winRate,
  confidence,
  memberRead,
  matchup,
  nextCourtEvent,
  firstServeSteps,
  postRepReturn,
}: MyLabCommandCenterProps) {
  const greeting = firstName ? `Ready, ${firstName}.` : 'Your next move starts here.'
  const safeCompletedSessions = Math.max(0, Math.min(sessionTarget, completedSessions))
  const completedFirstServeSteps = firstServeSteps.filter((step) => step.complete).length
  const nextFirstServeStep = firstServeSteps.findIndex((step) => !step.complete)
  const ratingLabel = typeof currentRating === 'number' ? currentRating.toFixed(2) : 'New'
  const ratingDeltaLabel = typeof ratingDelta === 'number'
    ? `${ratingDelta >= 0 ? '+' : ''}${ratingDelta.toFixed(2)} recently`
    : 'No trend yet'
  const focusLabel = currentFocus.trim() || 'Choose one tennis focus'
  const trendLabel = typeof ratingDelta !== 'number'
    ? 'Building signal'
    : ratingDelta > 0.02
      ? 'Trending up'
      : ratingDelta < -0.02
        ? 'Needs a response'
        : 'Holding steady'
  const directionRead = typeof ratingDelta !== 'number'
    ? 'Add connected results to establish your first direction.'
    : ratingDelta > 0.02
      ? 'Your connected results are moving your level forward.'
      : ratingDelta < -0.02
        ? 'The trend is asking for one focused response, not a full rebuild.'
        : 'Your level is stable enough to test one specific improvement.'
  const formRead = winRate >= 60
    ? 'Recent results are converting into wins.'
    : winRate >= 45
      ? 'Recent results are balanced; the next edge can move the line.'
      : 'Recent results point to a useful area to stabilize.'
  const confidenceRead = confidence.toLowerCase().includes('high')
    ? 'The current read has a strong connected evidence base.'
    : confidence.toLowerCase().includes('medium')
      ? 'The signal is useful and will sharpen with the next result.'
      : 'Treat this as an early read and add one honest result.'
  const reflectionStorageKey = `tiq-mylab-reflection:${playerId || 'local-player'}`
  const [reflectionOpen, setReflectionOpen] = useState(false)
  const [reflectionScore, setReflectionScore] = useState(0)
  const [reflectionWorked, setReflectionWorked] = useState('')
  const [reflectionNext, setReflectionNext] = useState('')
  const [reflectionHistory, setReflectionHistory] = useState<MobileReflection[]>([])
  const [activeReflectionId, setActiveReflectionId] = useState('')
  const [reflectionSync, setReflectionSync] = useState<'idle' | 'saving' | 'account' | 'device'>('idle')
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const savedReflection = reflectionHistory[0] ?? null

  useEffect(() => {
    let cancelled = false
    const hydrationTimer = window.setTimeout(async () => {
      let deviceReflections: MobileReflection[] = []
      try {
        deviceReflections = normalizeDeviceReflections(JSON.parse(window.localStorage.getItem(reflectionStorageKey) || 'null'))
      } catch {
        // A damaged device-only draft should never block My Lab.
      }
      if (cancelled) return
      setReflectionHistory(deviceReflections)
      const deviceLatest = deviceReflections[0]
      if (deviceLatest) {
        setActiveReflectionId(deviceLatest.id)
        setReflectionScore(deviceLatest.score)
        setReflectionWorked(deviceLatest.worked)
        setReflectionNext(deviceLatest.next)
        setReflectionSync(deviceLatest.syncStatus)
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token || cancelled) return

      try {
        const response = await fetch('/api/player/reflections', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) return
        const payload = await response.json() as { reflections?: PlayerReflection[] }
        const accountReflections = (payload.reflections ?? []).map(mapAccountReflection)
        const merged = mergeReflectionHistory(accountReflections, deviceReflections)
        if (cancelled) return
        setReflectionHistory(merged)
        window.localStorage.setItem(reflectionStorageKey, JSON.stringify(merged))
        const latest = merged[0]
        if (latest) {
          setActiveReflectionId(latest.id)
          setReflectionScore(latest.score)
          setReflectionWorked(latest.worked)
          setReflectionNext(latest.next)
          setReflectionSync(latest.syncStatus)
        }
      } catch {
        // Device history remains available when account sync is offline.
      }
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(hydrationTimer)
    }
  }, [reflectionStorageKey])

  const saveReflection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!reflectionScore || (!reflectionWorked.trim() && !reflectionNext.trim())) return

    const nextReflection: MobileReflection = {
      id: activeReflectionId || `reflection-${crypto.randomUUID()}`,
      score: reflectionScore,
      worked: reflectionWorked.trim().slice(0, 140),
      next: reflectionNext.trim().slice(0, 140),
      savedAt: new Date().toISOString(),
      proofLabel: postRepReturn?.proofLabel || `${safeCompletedSessions}/${sessionTarget} proof sessions`,
      resultLabel: lastResult,
      syncStatus: 'device',
    }
    const deviceHistory = mergeReflectionHistory([], [nextReflection, ...reflectionHistory])
    window.localStorage.setItem(reflectionStorageKey, JSON.stringify(deviceHistory))
    setReflectionHistory(deviceHistory)
    setActiveReflectionId(nextReflection.id)
    setReflectionSync('saving')
    setReflectionOpen(false)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) {
      setReflectionSync('device')
      return
    }

    try {
      const response = await fetch('/api/player/reflections', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reflection: {
            id: nextReflection.id,
            playerId,
            outcome: nextReflection.score,
            worked: nextReflection.worked,
            nextStep: nextReflection.next,
            proofLabel: nextReflection.proofLabel,
            resultLabel: nextReflection.resultLabel,
            createdAt: nextReflection.savedAt,
          },
        }),
      })
      if (!response.ok) throw new Error('Reflection sync failed')
      const payload = await response.json() as { reflection?: PlayerReflection }
      if (!payload.reflection) throw new Error('Reflection sync returned no record')
      const accountReflection = mapAccountReflection(payload.reflection)
      const syncedHistory = mergeReflectionHistory([accountReflection], deviceHistory)
      window.localStorage.setItem(reflectionStorageKey, JSON.stringify(syncedHistory))
      setReflectionHistory(syncedHistory)
      setReflectionSync('account')
    } catch {
      setReflectionSync('device')
    }
  }
  const startNewReflection = () => {
    setActiveReflectionId('')
    setReflectionScore(0)
    setReflectionWorked('')
    setReflectionNext('')
    setReflectionOpen(true)
  }
  const eventDaysAway = nextCourtEvent
    ? nextCourtEvent.daysUntil
    : null
  const openLocalWorkspace = (href: string) => {
    if (!href.startsWith('#') && !href.startsWith('/mylab#')) return
    const targetId = href.split('#')[1] || 'player-workshop'
    const target = document.getElementById(targetId)
    let section = target
    while (section) {
      if (section instanceof HTMLDetailsElement) section.open = true
      section = section.parentElement
    }
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const openMobileWorkspace = () => openLocalWorkspace(mobileRepHref)
  const mobileRepHref = repHref === '/mylab#goal-progress'
    ? '#goal-editor'
    : repHref.startsWith('/mylab#') ? repHref.slice('/mylab'.length) : repHref
  const reflectionPattern = buildReflectionPatternRead(reflectionHistory.map((reflection) => ({
    outcome: reflection.score,
    worked: reflection.worked,
    nextStep: reflection.next,
  })))
  const outcomeRead = reflectionPattern
    ? reflectionPattern.averageOutcome >= 2.5
      ? 'Your work is holding up more often than not.'
      : reflectionPattern.averageOutcome >= 1.75
        ? 'The signal is mixed, with a useful edge to stabilize.'
        : 'Your recent loops are asking for a simpler response.'
    : ''
  const dailyPulseItems = [
    {
      label: 'Court time',
      value: repDuration ? `${repDuration} min` : 'Set rep',
      note: repDuration ? 'Today\'s rep' : 'Choose a focus',
      href: repHref,
    },
    {
      label: 'This week',
      value: `${safeCompletedSessions}/${sessionTarget}`,
      note: `${safeCompletedSessions} session${safeCompletedSessions === 1 ? '' : 's'} complete`,
      href: progressHref,
    },
    {
      label: 'Matchup',
      value: matchup ? 'Ready' : 'Build',
      note: matchup?.opponentName || 'Find an opponent',
      href: matchup?.href || '/matchup',
    },
  ]

  return (
    <section className={styles.commandCenter} aria-labelledby="my-lab-command-title">
      <div className={styles.mobileHome}>
        <header className={styles.mobileHeader}>
          <div className={styles.mobileBrand}>
            <TiqFeatureIcon name="myLab" size="md" variant="surface" />
            <span>
              <strong>My Lab</strong>
              <small>Player</small>
            </span>
          </div>
          <Link className={styles.mobilePlayer} href={playerId ? `/players/${encodeURIComponent(playerId)}` : '/profile'}>
            <span>{firstName || 'Player'}</span>
            <UserCircle size={28} weight="duotone" aria-hidden="true" />
          </Link>
        </header>

        <p className={styles.mobileDate} suppressHydrationWarning>{new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</p>

        <article id="next-action" className={styles.mobileNextAction}>
          <div className={styles.mobileNextActionCopy}>
            <p>Next up for you</p>
            <h2>{repTitle}{repDuration ? ` · ${repDuration} min` : ''}</h2>
            <span>{repNote}</span>
          </div>
          <Link className={styles.mobilePrimaryAction} href={mobileRepHref} onClick={openMobileWorkspace}>
            <span>{repCta}</span>
            <ArrowRight size={24} weight="bold" aria-hidden="true" />
          </Link>
        </article>

        <article className={styles.mobileMatchCard}>
          <div className={styles.mobileMatchHeading}>
            <div>
              <p>{nextCourtEvent ? 'Next match' : 'Next matchup'}</p>
              <h2>{nextCourtEvent?.shortTitle || nextCourtEvent?.title || (matchup ? `vs ${matchup.opponentName}` : 'Build your first read')}</h2>
            </div>
            {eventDaysAway !== null ? <span suppressHydrationWarning>{eventDaysAway === 0 ? 'Today' : eventDaysAway === 1 ? 'Tomorrow' : `In ${eventDaysAway} days`}</span> : null}
          </div>
          {nextCourtEvent ? (
            <div className={styles.mobileMatchMeta}>
              {nextCourtEvent.context ? <span>{nextCourtEvent.context}</span> : null}
              <span><CalendarBlank size={18} weight="duotone" aria-hidden="true" />{nextCourtEvent.dateLabel}</span>
              <span><MapPin size={18} weight="duotone" aria-hidden="true" />{nextCourtEvent.detail}</span>
            </div>
          ) : null}
          {!nextCourtEvent && matchup ? (
            <div className={styles.mobileMatchRead}>
              <TennisBall size={25} weight="duotone" aria-hidden="true" />
              <span><small>Suggested matchup · {matchup.opponentName}</small><strong>{matchup.read}</strong></span>
            </div>
          ) : null}
          <Link className={styles.mobileMatchAction} href={nextCourtEvent?.href || matchup?.href || '/matchup'} onClick={() => openLocalWorkspace(nextCourtEvent?.href || matchup?.href || '/matchup')}>
            <span>{nextCourtEvent?.cta || 'Open matchup'}</span>
            <ArrowRight size={21} weight="bold" aria-hidden="true" />
          </Link>
        </article>

        <a id="mobile-scoreboard" className={styles.mobileScoreboard} href="#player-insights" onClick={() => setAnalyticsOpen(true)}>
          <div className={styles.mobileScoreTopline}>
            <span>Your tennis IQ</span>
            <strong>{trendLabel}</strong>
          </div>
          <div className={styles.mobileScoreMain}>
            <strong>{ratingLabel}</strong>
            <div>
              <span>{ratingDeltaLabel}</span>
              <small>{typeof ratingBaseline === 'number' ? `From ${ratingBaseline.toFixed(2)}` : 'Add results to build your line'}</small>
            </div>
            <ChartLineUp size={58} weight="duotone" aria-hidden="true" />
          </div>
          <div className={styles.mobileScoreStats}>
            <span><small>Recent record</small><strong>{recentRecord}</strong></span>
            <span><small>Win rate</small><strong>{winRate}%</strong></span>
            <span><small>Confidence</small><strong>{confidence}</strong></span>
          </div>
        </a>

        <a className={styles.mobilePriorityInsight} href="#player-insights" onClick={() => setAnalyticsOpen(true)} aria-controls="player-insights">
          <span><ChartLineUp size={22} weight="duotone" aria-hidden="true" /></span>
          <div>
            <small>{memberRead ? 'TenAce read · Player' : 'Your clearest signal'}</small>
            <strong>{memberRead?.headline || focusLabel}</strong>
            <p>{memberRead ? memberRead.evidence.join(' · ') : ratingStory || directionRead}</p>
            <em>{memberRead ? 'See the evidence' : 'See why'}</em>
          </div>
          <ArrowRight size={18} weight="bold" aria-hidden="true" />
        </a>

        <nav className={styles.mobileFlywheel} aria-label="Your improvement cycle">
          <a className={styles.mobileFlywheelActive} href="#mobile-scoreboard"><ChartLineUp size={19} weight="duotone" aria-hidden="true" /><strong>Where I am</strong></a>
          <ArrowRight size={15} aria-hidden="true" />
          <a href="#player-insights" onClick={() => setAnalyticsOpen(true)}><Target size={19} weight="duotone" aria-hidden="true" /><strong>Why it changed</strong></a>
          <ArrowRight size={15} aria-hidden="true" />
          <a href="#next-action"><Racquet size={19} weight="duotone" aria-hidden="true" /><strong>Next move</strong></a>
          <ArrowRight size={15} aria-hidden="true" />
          <a href="#latest-reflection" onClick={() => setReflectionOpen(true)}><TennisBall size={19} weight="duotone" aria-hidden="true" /><strong>How it went</strong></a>
        </nav>

        <details id="player-insights" className={styles.mobileInsights} open={analyticsOpen} onToggle={(event) => setAnalyticsOpen(event.currentTarget.open)}>
          <summary className={styles.mobileInsightsHeading}>
            <div>
              <p>All analytics</p>
              <h2 id="player-insights-title">Why your number moved</h2>
            </div>
            <ArrowRight className={analyticsOpen ? styles.mobileAnalyticsArrowOpen : ''} size={24} weight="bold" aria-hidden="true" />
          </summary>
          <div className={styles.mobileInsightsBody}>
            <div className={styles.mobileStory}>
              <div>
                <span>What was</span>
                <strong>{typeof ratingBaseline === 'number' ? ratingBaseline.toFixed(2) : 'New'}</strong>
              </div>
              <ArrowRight size={22} weight="bold" aria-hidden="true" />
              <div>
                <span>What is</span>
                <strong>{ratingLabel}</strong>
              </div>
              <p>{ratingStory || focusLabel}</p>
            </div>
            {memberRead ? (
              <article className={styles.mobileMemberRead}>
                <header>
                  <span>Your TenAce read</span>
                  <em>Included with Player</em>
                </header>
                <h3>{memberRead.headline}</h3>
                <p>{memberRead.summary}</p>
                <div className={styles.mobileMemberEvidence} aria-label="Evidence behind your TenAce read">
                  {memberRead.evidence.map((item) => <span key={item}>{item}</span>)}
                </div>
                <div className={styles.mobileMemberNextTest}>
                  <small>Next test</small>
                  <strong>{memberRead.nextTest}</strong>
                </div>
                <div className={styles.mobileMemberReflection}>
                  <small>Compare after</small>
                  <p>{memberRead.reflectionPrompt}</p>
                </div>
                <a href="#next-action">Use this read <ArrowRight size={16} weight="bold" aria-hidden="true" /></a>
              </article>
            ) : null}
            <div className={styles.mobileInsightList}>
              <article>
                <span><ChartLineUp size={20} weight="duotone" aria-hidden="true" /></span>
                <div><small>Direction</small><strong>{trendLabel} · {ratingDeltaLabel}</strong><p>{directionRead}</p></div>
              </article>
              <article>
                <span><TennisBall size={20} weight="duotone" aria-hidden="true" /></span>
                <div><small>Recent form</small><strong>{recentRecord} · {winRate}% win rate</strong><p>{formRead}</p></div>
              </article>
              <article>
                <span><Target size={20} weight="duotone" aria-hidden="true" /></span>
                <div><small>Signal quality</small><strong>{confidence} confidence</strong><p>{confidenceRead}</p></div>
              </article>
            </div>
            {!memberRead ? (
              <div className={styles.mobileInsightDecision}>
                <span>What this points to</span>
                <strong>{focusLabel}</strong>
                <p>{ratingStory || repNote}</p>
                <a href="#next-action">Use this read <ArrowRight size={18} weight="bold" aria-hidden="true" /></a>
              </div>
            ) : null}
          </div>
        </details>

        <section id="latest-reflection" className={styles.mobileReflection} aria-labelledby="latest-reflection-title">
          <button type="button" className={styles.mobileReflectionSummary} onClick={() => setReflectionOpen((current) => !current)} aria-expanded={reflectionOpen}>
            {savedReflection ? <CheckCircle size={27} weight="duotone" aria-hidden="true" /> : <Target size={27} weight="duotone" aria-hidden="true" />}
            <span>
              <small>{savedReflection ? 'Latest reflection' : 'Your latest work'}</small>
              <strong id="latest-reflection-title">{savedReflection?.worked || postRepReturn?.cardTitle || 'Add your first reflection'}</strong>
              <em>{savedReflection
                ? reflectionSync === 'saving'
                  ? 'Syncing…'
                  : savedReflection.syncStatus === 'account' || reflectionSync === 'account'
                    ? 'Saved to your account'
                    : 'Saved on this phone'
                : postRepReturn?.proofLabel || `${safeCompletedSessions}/${sessionTarget} sessions this week`}</em>
            </span>
            <ArrowRight className={reflectionOpen ? styles.mobileReflectionArrowOpen : ''} size={20} weight="bold" aria-hidden="true" />
          </button>
          <p>{savedReflection?.next ? `Next: ${savedReflection.next}` : postRepReturn?.note || 'After practice or a match, save what worked and one adjustment for next time.'}</p>
          {reflectionOpen ? (
            <form className={styles.mobileReflectionForm} onSubmit={saveReflection}>
              <fieldset>
                <legend>How did it go?</legend>
                <div className={styles.mobileReflectionScores}>
                  {[
                    { score: 1, label: 'Off' },
                    { score: 2, label: 'Mixed' },
                    { score: 3, label: 'Held up' },
                  ].map((item) => (
                    <button key={item.score} type="button" aria-pressed={reflectionScore === item.score} onClick={() => setReflectionScore(item.score)}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label>
                <span>What worked?</span>
                <input value={reflectionWorked} onChange={(event) => setReflectionWorked(event.target.value)} maxLength={140} placeholder="One pattern or cue that held up" />
              </label>
              <label>
                <span>What changes next?</span>
                <input value={reflectionNext} onChange={(event) => setReflectionNext(event.target.value)} maxLength={140} placeholder="One adjustment for the next rep" />
              </label>
              <button className={styles.mobileReflectionSave} type="submit" disabled={!reflectionScore || (!reflectionWorked.trim() && !reflectionNext.trim())}>
                Save reflection
              </button>
              {savedReflection ? <button className={styles.mobileReflectionNew} type="button" onClick={startNewReflection}>Start a new reflection</button> : null}
              <small>Signed-in reflections follow you across devices. Offline work stays safe on this phone.</small>
            </form>
          ) : null}
        </section>

        {reflectionHistory.length > 0 || safeCompletedSessions > 0 || postRepReturn ? (
        <section id="cycle-memory" className={styles.mobileCycleMemory} aria-labelledby="cycle-memory-title">
          <div className={styles.mobileCycleHeading}>
            <div>
              <p>Your cycle memory</p>
              <h2 id="cycle-memory-title">What led to what</h2>
            </div>
            <span>Latest loop</span>
          </div>
          <div className={styles.mobileCycleList}>
            <article>
              <span><CheckCircle size={21} weight="duotone" aria-hidden="true" /></span>
              <div><small>01 · Proof</small><strong>{postRepReturn?.proofLabel || `${safeCompletedSessions}/${sessionTarget} proof sessions`}</strong><p>{postRepReturn?.cardTitle || 'Complete one rep to establish the first proof.'}</p></div>
            </article>
            <article>
              <span><TennisBall size={21} weight="duotone" aria-hidden="true" /></span>
              <div><small>02 · Result</small><strong>{lastResult}</strong><p>{recentRecord} recent · {winRate}% win rate</p></div>
            </article>
            <article>
              <span><Target size={21} weight="duotone" aria-hidden="true" /></span>
              <div><small>03 · Lesson</small><strong>{savedReflection?.worked || postRepReturn?.note || 'Add your read'}</strong><p>{savedReflection?.next ? 'Your next adjustment is captured.' : 'Reflect once the work is fresh.'}</p></div>
            </article>
            <article className={styles.mobileCycleNext}>
              <span><Racquet size={21} weight="duotone" aria-hidden="true" /></span>
              <div><small>04 · Next move</small><strong>{repTitle}</strong><p>{savedReflection?.next || repNote}</p></div>
              <Link href="#next-action" aria-label="Open your next move"><ArrowRight size={19} weight="bold" aria-hidden="true" /></Link>
            </article>
          </div>
          {reflectionHistory.length > 1 ? (
            <div className={styles.mobilePastLoops}>
              <div className={styles.mobilePastLoopsHeading}>
                <strong>Past loops</strong>
                <span>{reflectionHistory.length - 1} saved</span>
              </div>
              {reflectionHistory.slice(1, 4).map((reflection) => (
                <button
                  key={reflection.id}
                  type="button"
                  onClick={() => {
                    setActiveReflectionId(reflection.id)
                    setReflectionScore(reflection.score)
                    setReflectionWorked(reflection.worked)
                    setReflectionNext(reflection.next)
                    setReflectionSync(reflection.syncStatus)
                    setReflectionOpen(true)
                    document.querySelector('#latest-reflection')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  <span>
                    <small suppressHydrationWarning>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(reflection.savedAt))}</small>
                    <strong>{reflection.worked || reflection.next}</strong>
                    <em>{reflection.resultLabel || 'Player reflection'}</em>
                  </span>
                  <ArrowRight size={17} weight="bold" aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.mobileCycleEmpty}>{reflectionHistory.length === 1
              ? 'One more reflection unlocks your first pattern read.'
              : 'Your saved loops will build a personal pattern library here.'}</p>
          )}
        </section>
        ) : null}

        {reflectionPattern ? (
          <section className={styles.mobilePatternRead} aria-labelledby="pattern-read-title">
            <div className={styles.mobilePatternHeading}>
              <div>
                <p>Across your loops</p>
                <h2 id="pattern-read-title">Your pattern read</h2>
              </div>
              <span>Last {reflectionPattern.sampleSize}</span>
            </div>
            <div className={styles.mobilePatternScore}>
              <strong>{reflectionPattern.heldUpRate}%</strong>
              <span><small>Held up</small><em>{reflectionPattern.direction}</em></span>
              <ChartLineUp size={35} weight="duotone" aria-hidden="true" />
            </div>
            <p>{outcomeRead}</p>
            <div className={styles.mobilePatternSignals}>
              <article>
                <span><CheckCircle size={20} weight="duotone" aria-hidden="true" /></span>
                <div><small>What keeps working</small><strong>{reflectionPattern.workingTheme?.label || 'No repeat yet'}</strong><p>{reflectionPattern.workingTheme ? `${reflectionPattern.workingTheme.count} reflections point here.` : 'Keep naming the cue that held up.'}</p></div>
              </article>
              <article>
                <span><Target size={20} weight="duotone" aria-hidden="true" /></span>
                <div><small>Adjustment resurfacing</small><strong>{reflectionPattern.adjustmentTheme?.label || 'No repeat yet'}</strong><p>{reflectionPattern.adjustmentTheme ? `${reflectionPattern.adjustmentTheme.count} next moves share this theme.` : 'A recurring adjustment will surface here.'}</p></div>
              </article>
            </div>
          </section>
        ) : null}

        <nav className={styles.mobileNav} aria-label="My Lab shortcuts">
          <Link className={styles.mobileNavActive} href="#next-action"><House size={23} weight="duotone" aria-hidden="true" /><span>Today</span></Link>
          <Link href={mobileRepHref} onClick={openMobileWorkspace}><Racquet size={23} weight="duotone" aria-hidden="true" /><span>{mobileRepHref === '#goal-editor' ? 'Set focus' : 'Train'}</span></Link>
          <Link href={matchup?.href || '/matchup'}><TennisBall size={23} weight="duotone" aria-hidden="true" /><span>Matchup</span></Link>
          <Link href="/profile"><UserCircle size={23} weight="duotone" aria-hidden="true" /><span>Profile</span></Link>
        </nav>
      </div>

      <div className={styles.legacyExperience}>
      <header className={styles.intro}>
        <div>
          <div className={styles.labSignature}>
            <TiqFeatureIcon name="myLab" size="md" variant="surface" />
            <span>
              <strong>My Lab</strong>
              <small>Player tools</small>
            </span>
          </div>
          <h1 id="my-lab-command-title">{greeting}</h1>
          <p className={styles.introCopy}>One useful tennis move, then the proof that it worked.</p>
        </div>
        {playerId && playerName ? (
          <Link className={styles.playerLink} href={`/players/${encodeURIComponent(playerId)}`}>
            <span>Active player</span>
            <strong>{playerName}</strong>
          </Link>
        ) : (
          <Link className={styles.playerLink} href="/profile">
            <span>Active player</span>
            <strong>Find yourself</strong>
          </Link>
        )}
      </header>

      {firstServeSteps.length ? (
        <section className={styles.firstServe} aria-labelledby="first-serve-title">
          <div className={styles.firstServeHeading}>
            <div>
              <p className={styles.cardEyebrow}>First serve</p>
              <h2 id="first-serve-title">Build your player loop.</h2>
              <p>Connect your tennis, choose the work, then record one useful rep.</p>
            </div>
            <span className={styles.firstServeProgress}>{completedFirstServeSteps} of {firstServeSteps.length} ready</span>
          </div>
          <div className={styles.firstServeGrid} data-has-current={nextFirstServeStep >= 0 ? 'true' : 'false'}>
            {firstServeSteps.map((step, index) => {
              const isCurrent = index === nextFirstServeStep

              return (
                <Link
                  key={step.title}
                  className={`${styles.firstServeStep} ${step.complete ? styles.firstServeStepComplete : ''} ${isCurrent ? styles.firstServeStepCurrent : ''} ${nextFirstServeStep >= 0 && !isCurrent ? styles.firstServeStepSecondary : ''}`}
                  href={step.href}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span className={styles.firstServeNumber} aria-hidden="true">
                    {step.complete ? '✓' : index + 1}
                  </span>
                  <span className={styles.firstServeCopy}>
                    <strong>{step.title}</strong>
                    <small>{step.description}</small>
                  </span>
                  <span className={styles.firstServeAction}>{step.complete ? 'Review' : step.action} <span aria-hidden="true">→</span></span>
                </Link>
              )
            })}
          </div>
        </section>
      ) : null}

      {postRepReturn ? (
        <section className={styles.postRepReturn} aria-labelledby="post-rep-return-title">
          <div className={styles.postRepProof}>
            <span className={styles.postRepIcon} aria-hidden="true">✓</span>
            <div>
              <div className={styles.postRepTopline}>
                <p className={styles.cardEyebrow}>Rep saved · {postRepReturn.timeLabel}</p>
                <span className={styles.postRepSync}>{postRepReturn.syncLabel}</span>
              </div>
              <h2 id="post-rep-return-title">{postRepReturn.cardTitle} is in the books.</h2>
              <div className={styles.postRepProofLine}>
                <strong>{postRepReturn.proofLabel}</strong>
                <span>{postRepReturn.note || 'Your proof is ready for the next cleaner rep.'}</span>
              </div>
            </div>
          </div>

          <div className={styles.postRepProgress}>
            <div>
              <p className={styles.supportEyebrow}>This week</p>
              <strong>{safeCompletedSessions} of {sessionTarget}</strong>
            </div>
            <span className={styles.postRepTrack} aria-label={`${safeCompletedSessions} of ${sessionTarget} weekly reps complete`}>
              <span style={{ width: `${sessionTarget ? Math.round((safeCompletedSessions / sessionTarget) * 100) : 0}%` }} />
            </span>
            <Link href={progressHref}>See progress</Link>
          </div>

          <div className={styles.postRepNext}>
            <p className={styles.supportEyebrow}>Weekly plan · {postRepReturn.planLabel}</p>
            <strong>{postRepReturn.nextAction}</strong>
            <p className={styles.postRepWhy}>{postRepReturn.planWhy}</p>
            <div className={styles.postRepPlanMeta}>
              <span><small>Proof</small>{postRepReturn.proofTarget}</span>
              <span><small>Trend</small>{postRepReturn.trendLabel}</span>
            </div>
            <Link href={postRepReturn.nextHref}>
              {postRepReturn.nextCta} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      ) : null}

      {!postRepReturn ? (
        <section className={styles.dailyPulse} aria-label="My Lab daily pulse">
          {dailyPulseItems.map((item) => (
            <Link key={item.label} className={styles.dailyPulseItem} href={item.href}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.note}</small>
            </Link>
          ))}
        </section>
      ) : null}

      {nextCourtEvent ? (
        <Link className={styles.nextCourtEvent} href={nextCourtEvent.href} onClick={() => openLocalWorkspace(nextCourtEvent.href)} aria-label={`${nextCourtEvent.cta}: ${nextCourtEvent.title}`}>
          <div className={styles.nextCourtEventCopy}>
            <p className={styles.cardEyebrow}>Next on court</p>
            <h2>{nextCourtEvent.title}</h2>
            <p>{nextCourtEvent.detail}</p>
          </div>
          <div className={styles.nextCourtEventMeta}>
            <strong>{nextCourtEvent.dateLabel}</strong>
            <small>{nextCourtEvent.readiness}</small>
            <span>{nextCourtEvent.cta} <i aria-hidden="true">→</i></span>
          </div>
        </Link>
      ) : null}

      <div className={`${styles.primaryGrid} ${postRepReturn ? styles.primaryGridAfterRep : ''}`}>
        {!postRepReturn ? <article className={styles.repCard}>
          <Image
            className={styles.courtImage}
            src="/tiq/courts/tiq-court-master.png"
            alt=""
            fill
            sizes="(max-width: 760px) 100vw, 760px"
            priority
          />
          <Image
            className={styles.ballImage}
            src="/tiq/tokens/tennis-ball-reference.png"
            alt=""
            width={220}
            height={220}
            priority
          />
          <div className={styles.repContent}>
            <div className={styles.repTopline}>
              <p className={styles.cardEyebrow}>Today&apos;s rep</p>
              {repDuration ? (
                <span className={styles.duration}>
                  <TiqFeatureIcon name="schedule" size="sm" variant="ghost" />
                  {repDuration} min
                </span>
              ) : null}
            </div>
            <h2>{repTitle}</h2>
            <p className={styles.repNote}>{repNote}</p>
            <Link className={styles.primaryAction} href={repHref}>
              <span>{repCta}</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </article> : null}

        <div className={`${styles.supportStack} ${postRepReturn ? styles.supportStackAfterRep : ''}`}>
          {!postRepReturn ? <article className={styles.momentumCard}>
            <div className={styles.cardHeadingRow}>
              <div>
                <p className={styles.supportEyebrow}>Weekly momentum</p>
                <h2>{safeCompletedSessions} of {sessionTarget} sessions</h2>
              </div>
              <Link href={progressHref}>See progress</Link>
            </div>
            <div className={styles.sessionRail} aria-label={`${safeCompletedSessions} of ${sessionTarget} weekly sessions complete`}>
              {Array.from({ length: sessionTarget }, (_, index) => (
                <span
                  key={index}
                  className={index < safeCompletedSessions ? styles.sessionComplete : styles.sessionOpen}
                  aria-hidden="true"
                >
                  {index < safeCompletedSessions ? '✓' : index + 1}
                </span>
              ))}
            </div>
          </article> : null}

          <article className={styles.matchCard}>
            <div className={styles.matchIcon}>
              <TiqFeatureIcon name="matchupAnalysis" size="md" variant="ghost" />
            </div>
            <div className={styles.matchCopy}>
              <p className={styles.supportEyebrow}>Next matchup</p>
              {matchup ? (
                <>
                  <Link className={styles.entityLink} href={`/players/${encodeURIComponent(matchup.opponentId)}`}>
                    {matchup.opponentName}
                  </Link>
                  <p>{matchup.opponentMeta}</p>
                  <span className={styles.matchRead}>{matchup.read}</span>
                </>
              ) : (
                <>
                  <strong className={styles.emptyMatchTitle}>Build your first read</strong>
                  <p>Connect a player record to surface a useful next test.</p>
                </>
              )}
            </div>
            <Link className={styles.matchAction} href={matchup?.href || '/matchup'}>
              View matchup <span aria-hidden="true">→</span>
            </Link>
          </article>
        </div>
      </div>
      </div>
    </section>
  )
}
