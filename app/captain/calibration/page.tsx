'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import LockedPlanPage from '@/app/components/locked-plan-page'
import SiteShell from '@/app/components/site-shell'
import { buildProductAccessState } from '@/lib/access-model'
import { readCaptainResumeState } from '@/lib/captain-memory'
import type { CaptainLineupCalibration } from '@/lib/captain-lineup-calibration'
import styles from './page.module.css'

type CalibrationSummary = {
  matches: number
  matchAccuracy: number | null
  courtAccuracy: number | null
  averageBrierScore: number | null
  averageLineupAdherence: number | null
  exactScores: number
}

type CalibrationHistoryItem = {
  id: string
  teamName: string
  opponentTeam: string
  leagueName: string | null
  flight: string | null
  matchDate: string
  updatedAt: string
  calibration: CaptainLineupCalibration
}

type CalibrationResponse = {
  ok?: boolean
  message?: string
  summary?: CalibrationSummary
  calibrations?: CalibrationHistoryItem[]
}

function percent(value: number | null) {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function brierLabel(value: number | null) {
  if (value === null) return 'Building'
  if (value <= 0.15) return 'Sharp'
  if (value <= 0.25) return 'Useful'
  return 'Learning'
}

function initialTeam() {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('team') || readCaptainResumeState()?.team || ''
}

export default function CaptainCalibrationPage() {
  return <SiteShell active="/captain"><CaptainCalibrationContent /></SiteShell>
}

function CaptainCalibrationContent() {
  const router = useRouter()
  const { role, entitlements, authResolved, session } = useAuth()
  const access = useMemo(() => buildProductAccessState(role, entitlements), [entitlements, role])
  const [teamName] = useState(initialTeam)
  const [summary, setSummary] = useState<CalibrationSummary | null>(null)
  const [history, setHistory] = useState<CalibrationHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authResolved || role !== 'public') return
    router.replace(`/login?plan=captain&next=${encodeURIComponent('/captain/calibration')}`)
  }, [authResolved, role, router])

  useEffect(() => {
    if (!authResolved || role === 'public' || !access.canUseCaptainWorkflow || !session?.access_token) return
    let active = true
    const params = new URLSearchParams()
    if (teamName) params.set('team', teamName)
    fetch(`/api/captain/lineup-calibrations${params.size ? `?${params}` : ''}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async (response) => ({ response, payload: await response.json() as CalibrationResponse }))
      .then(({ response, payload }) => {
        if (!active) return
        if (!response.ok || !payload.ok) throw new Error(payload.message || 'Prediction history could not be loaded.')
        setSummary(payload.summary || null)
        setHistory(payload.calibrations || [])
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Prediction history could not be loaded.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [access.canUseCaptainWorkflow, authResolved, role, session?.access_token, teamName])

  if (!authResolved || role === 'public') return <main className={styles.page}><p className={styles.loading}>Opening your Captain report…</p></main>
  if (!access.canUseCaptainWorkflow) {
    return <LockedPlanPage withinShell planId="captain" headline="Prediction calibration is a Captain tool." body="Save lineup predictions, connect verified results, and learn which match signals hold up." />
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="calibration-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Captain prediction lab</p>
          <h1 id="calibration-title">Is the lineup model earning your trust?</h1>
          <p>Every verified scorecard is compared with the last saved pre-match lineup. TiQ measures the call, the courts, and what actually reached the court.</p>
        </div>
        <Link className={styles.builderLink} href={teamName ? `/captain/lineup-builder?team=${encodeURIComponent(teamName)}` : '/captain/lineup-builder'}>Build next lineup</Link>
      </section>

      {loading ? <p className={styles.loading}>Matching predictions to verified results…</p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      {!loading && !error && summary ? (
        <>
          <section className={styles.scoreboard} aria-label="Prediction calibration summary">
            <article><span>Match calls</span><strong>{percent(summary.matchAccuracy)}</strong><small>{summary.matches} verified match{summary.matches === 1 ? '' : 'es'}</small></article>
            <article><span>Court calls</span><strong>{percent(summary.courtAccuracy)}</strong><small>Direction correct</small></article>
            <article><span>Lineup used</span><strong>{percent(summary.averageLineupAdherence)}</strong><small>Recommended players who played</small></article>
            <article><span>Probability read</span><strong>{brierLabel(summary.averageBrierScore)}</strong><small>{summary.averageBrierScore === null ? 'Needs scored courts' : `Brier ${summary.averageBrierScore.toFixed(3)} · lower is better`}</small></article>
          </section>

          <section className={styles.guardrail} data-ready={summary.matches >= 3}>
            <div><span>{summary.matches >= 3 ? 'Calibration active' : 'Evidence building'}</span><strong>{summary.matches >= 3 ? 'Patterns can now inform the next model review.' : `${Math.max(0, 3 - summary.matches)} more verified match${3 - summary.matches === 1 ? '' : 'es'} before changing weights.`}</strong></div>
            <p>TiQ records every result immediately, but waits for repeated evidence before changing how ratings, court history, pair chemistry, or opponent placement are weighted.</p>
          </section>

          <section className={styles.history} aria-labelledby="recent-calibrations-title">
            <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Prediction tape</p><h2 id="recent-calibrations-title">What TiQ called—and learned</h2></div><span>{summary.exactScores} exact score{summary.exactScores === 1 ? '' : 's'}</span></div>
            {history.length ? history.map((item) => {
              const calibration = item.calibration
              return (
                <article className={styles.matchCard} key={item.id}>
                  <header>
                    <div><span>{formatDate(item.matchDate)} · vs {item.opponentTeam}</span><h3>{calibration.headline}</h3><p>{calibration.summary}</p></div>
                    <strong data-correct={calibration.teamPredictionCorrect === true}>{calibration.teamPredictionCorrect === true ? 'Called it' : calibration.teamPredictionCorrect === false ? 'Learned' : 'Added evidence'}</strong>
                  </header>
                  <div className={styles.predictionScore}>
                    <div><small>Projected</small><strong>{calibration.projectedScoreFor ?? '—'}–{calibration.projectedScoreAgainst ?? '—'}</strong><span>{percent(calibration.projectedTeamWinPct)} match odds</span></div>
                    <i aria-hidden="true">→</i>
                    <div><small>Final</small><strong>{calibration.actualScoreFor}–{calibration.actualScoreAgainst}</strong><span>{calibration.actualOutcome === 'won' ? 'Team win' : calibration.actualOutcome === 'lost' ? 'Team loss' : 'Split result'}</span></div>
                  </div>
                  <div className={styles.courtStrip} aria-label="Court prediction results">
                    {calibration.courts.map((court) => <span key={court.label} data-result={court.predictionCorrect === null ? 'open' : court.predictionCorrect ? 'correct' : 'miss'} title={`${court.label}: ${court.predictionCorrect === null ? 'not scored' : court.predictionCorrect ? 'prediction matched' : 'prediction missed'}`} />)}
                  </div>
                  <div className={styles.matchMetrics}><span><strong>{percent(calibration.courtPredictionAccuracy)}</strong><small>Court accuracy</small></span><span><strong>{percent(calibration.lineupAdherence)}</strong><small>Lineup used</small></span><span><strong>{percent(calibration.opponentPlacementAccuracy)}</strong><small>Opponent placement</small></span></div>
                  <details className={styles.learning}>
                    <summary>What TiQ learned <span>{calibration.signals.filter((signal) => signal.direction === 'learn').length || 'Review'}</span></summary>
                    <div>{calibration.signals.map((signal) => <p key={signal.id} data-direction={signal.direction}><strong>{signal.label}</strong><span>{signal.detail}</span></p>)}</div>
                  </details>
                </article>
              )
            }) : (
              <div className={styles.empty}><strong>Your first calibration is one scorecard away.</strong><p>Save a lineup before the match, then record the verified result. TiQ will connect them automatically.</p><Link href="/captain/lineup-builder">Build a lineup</Link></div>
            )}
          </section>
        </>
      ) : null}
    </main>
  )
}
