'use client'

import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, ArrowsLeftRight, CaretRight, CheckCircle, GridFour, Info, LockSimple, LockSimpleOpen, MagicWand, Minus, ShieldCheck, Target, UsersThree, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  summarizeCaptainPairRecord,
  summarizeCaptainPairScoreTendency,
  type CaptainPairLineupIntelligence,
  type CaptainPlayerLineupIntelligence,
} from '@/lib/captain-lineup-intelligence'
import styles from './captain-lineup-intelligence.module.css'

export type CaptainLineupIntelligenceStrategy = 'best' | 'safe' | 'upside'
export type CaptainLineupConfidence = 'High' | 'Medium' | 'Low' | 'Needs opponent'
export type CaptainOpponentScenarioId = 'likely' | 'aggressive' | 'conservative'

export type CaptainOpponentScenario = {
  id: CaptainOpponentScenarioId
  label: string
  detail: string
  overallProbability: number | null
  resultLabel: string
  holdingCourtCount: number
  totalCourtCount: number
  pressureCourtLabel: string
  pressureCourtProbability: number | null
  opponentCourts: Array<{
    id: string
    label: string
    playerNames: string[]
    ratingLabel: string
    movedFromLikely: boolean
  }>
}

export type CaptainLineupResilientPreview = {
  worstCaseProbability: number | null
  averageProbability: number | null
  changedCourts: number
  changeLabels: string[]
}

export type CaptainLineupPlayerEvidence = {
  id: string
  name: string
  positionSummary: string
  scoreSummary: string
  startCount: number
  scoredSetCount: number
}

export type CaptainLineupIntelligenceCourt = {
  id: string
  label: string
  playerIds: string[]
  playerNames: string[]
  playerEvidence: CaptainLineupPlayerEvidence[]
  pairEvidence?: CaptainPairLineupIntelligence
  probability: number | null
  positionSummary: string
  scoreSummary: string
  confidence: CaptainLineupConfidence
  confidenceDetail: string
}

export type CaptainLineupStrategyPreview = {
  strategy: CaptainLineupIntelligenceStrategy
  label: string
  overallProbability: number | null
  resultLabel: string
  changedCourts: number
  changeLabels: string[]
}

export type CaptainLineupSimulationCandidate = {
  id: string
  name: string
  ratingLabel: string
  availabilityLabel: string
  evidenceSummary: string
  courtProbability: number | null
  overallProbability: number | null
  courtDelta: number | null
  overallDelta: number | null
  factors: CaptainLineupSimulationFactor[]
}

export type CaptainLineupSimulationFactor = {
  id: string
  label: string
  value: string
  detail: string
  modeled: boolean
  tone: 'positive' | 'negative' | 'neutral' | 'info'
}

export type CaptainLineupSimulationPlayer = {
  id: string
  name: string
  playerIndex: number
  candidates: CaptainLineupSimulationCandidate[]
}

export type CaptainLineupSimulationCourt = {
  id: string
  label: string
  players: CaptainLineupSimulationPlayer[]
}

export type CaptainPairMatrixRecommendation = {
  id: string
  playerIds: string[]
  playerNames: string[]
  ratingLabel: string
  availabilityLabel: string
  courtProbability: number | null
  pairHistory: string
  scoreSummary: string
  isCurrent: boolean
  canApply: boolean
  blockedReason: string
  blockingLock: { kind: 'court' | 'player'; id: string } | null
}

export type CaptainPairMatrixCourt = {
  id: string
  label: string
  recommendations: CaptainPairMatrixRecommendation[]
}

type Props = {
  matchDateLabel: string
  opponentName: string
  opponentRosterCount: number
  rosterLoading: boolean
  rosterUploadHref: string
  courts: CaptainLineupIntelligenceCourt[]
  overallProbability: number | null
  insightsByPlayerId: Record<string, CaptainPlayerLineupIntelligence>
  opponentScenarios: CaptainOpponentScenario[]
  activeOpponentScenarioId: CaptainOpponentScenarioId
  resilientPreview: CaptainLineupResilientPreview | null
  strategyPreviews: CaptainLineupStrategyPreview[]
  simulations: CaptainLineupSimulationCourt[]
  pairMatrix: CaptainPairMatrixCourt[]
  lockedCourtIds: string[]
  lockedPlayerIds: string[]
  onAutoBuild: (strategy: CaptainLineupIntelligenceStrategy) => void
  onOpponentScenarioChange: (scenario: CaptainOpponentScenarioId) => void
  onBuildResilient: () => void
  onEditCourt: (courtId: string) => void
  onEnterRosterManually: () => void
  onToggleCourtLock: (courtId: string) => void
  onTogglePlayerLock: (playerId: string) => void
  onApplySimulation: (courtId: string, playerIndex: number, replacementPlayerId: string) => void
  onApplyPair: (courtId: string, playerIds: string[]) => void
}

type ComparisonBaseline = {
  overallProbability: number | null
  courts: Array<{ id: string; label: string; playerNames: string[]; probability: number | null }>
}

function percent(value: number | null) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : '—'
}

function pointDelta(value: number | null) {
  if (typeof value !== 'number') return '—'
  const points = Math.round(value * 100)
  return `${points > 0 ? '+' : ''}${points} pts`
}

function probabilityRange(value: number | null, confidence: CaptainLineupConfidence) {
  if (typeof value !== 'number') return '—'
  if (confidence === 'High') return percent(value)
  const spread = confidence === 'Medium' ? 0.06 : 0.1
  const low = Math.max(0, value - spread)
  const high = Math.min(1, value + spread)
  return `${Math.round(low * 100)}–${Math.round(high * 100)}%`
}

function courtTone(probability: number | null) {
  if (probability === null) return { role: 'Needs data', className: styles.roleSwing, rail: styles.unknown }
  if (probability >= 0.58) return { role: 'Favored', className: styles.roleFavored, rail: styles.favored }
  if (probability >= 0.45) return { role: 'Swing', className: styles.roleSwing, rail: styles.swing }
  return { role: 'Risk', className: styles.roleRisk, rail: styles.risk }
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || 'Player'
}

function samePlayers(left: string[], right: string[]) {
  return [...left].sort().join('|') === [...right].sort().join('|')
}

function strategyActionLabel(strategy: CaptainLineupIntelligenceStrategy) {
  if (strategy === 'safe') return 'Build safer lineup'
  if (strategy === 'upside') return 'Build upside lineup'
  return 'Build my best lineup'
}

function confidenceClass(confidence: CaptainLineupConfidence) {
  if (confidence === 'High') return styles.confidenceHigh
  if (confidence === 'Medium') return styles.confidenceMedium
  if (confidence === 'Low') return styles.confidenceLow
  return styles.confidenceNeedsOpponent
}

function factorToneClass(tone: CaptainLineupSimulationFactor['tone']) {
  if (tone === 'positive') return styles.factorPositive
  if (tone === 'negative') return styles.factorNegative
  if (tone === 'info') return styles.factorInfo
  return styles.factorNeutral
}

function factorToneIcon(tone: CaptainLineupSimulationFactor['tone']) {
  if (tone === 'positive') return <ArrowUpRight size={16} weight="bold" aria-hidden="true" />
  if (tone === 'negative') return <ArrowDownRight size={16} weight="bold" aria-hidden="true" />
  if (tone === 'info') return <Info size={16} weight="bold" aria-hidden="true" />
  return <Minus size={16} weight="bold" aria-hidden="true" />
}

export default function CaptainLineupIntelligence({
  matchDateLabel,
  opponentName,
  opponentRosterCount,
  rosterLoading,
  rosterUploadHref,
  courts,
  overallProbability,
  insightsByPlayerId,
  opponentScenarios,
  activeOpponentScenarioId,
  resilientPreview,
  strategyPreviews,
  simulations,
  pairMatrix,
  lockedCourtIds,
  lockedPlayerIds,
  onAutoBuild,
  onOpponentScenarioChange,
  onBuildResilient,
  onEditCourt,
  onEnterRosterManually,
  onToggleCourtLock,
  onTogglePlayerLock,
  onApplySimulation,
  onApplyPair,
}: Props) {
  const [strategy, setStrategy] = useState<CaptainLineupIntelligenceStrategy>('best')
  const [selectedCourtId, setSelectedCourtId] = useState('')
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [helpPreference, setHelpPreference] = useState<boolean | null>(null)
  const [comparisonBaseline, setComparisonBaseline] = useState<ComparisonBaseline | null>(null)
  const [lastBuiltStrategy, setLastBuiltStrategy] = useState<CaptainLineupIntelligenceStrategy | null>(null)
  const [whyOpen, setWhyOpen] = useState(false)
  const [simulationCourtId, setSimulationCourtId] = useState('')
  const [simulationPlayerIndex, setSimulationPlayerIndex] = useState(0)
  const [simulationCandidateId, setSimulationCandidateId] = useState('')
  const [resilientApplied, setResilientApplied] = useState(false)
  const [pairMatrixOpen, setPairMatrixOpen] = useState(false)
  const [pairMatrixCourtId, setPairMatrixCourtId] = useState('')
  const [pairAppliedLabel, setPairAppliedLabel] = useState('')
  const sheetRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const simulatorSheetRef = useRef<HTMLElement>(null)
  const simulatorCloseButtonRef = useRef<HTMLButtonElement>(null)
  const selectedCourt = courts.find((court) => court.id === selectedCourtId) ?? null
  const selectedEvidence = selectedCourt?.playerEvidence.find((player) => player.id === selectedPlayerId)
    ?? selectedCourt?.playerEvidence[0]
  const selectedInsight = selectedEvidence ? insightsByPlayerId[selectedEvidence.id] : undefined
  const projectedWins = courts.filter((court) => typeof court.probability === 'number' && (court.probability ?? 0) >= 0.5).length
  const projectedLosses = courts.filter((court) => typeof court.probability === 'number').length - projectedWins
  const rosterState = rosterLoading ? 'loading' : opponentRosterCount ? 'loaded' : 'missing'
  const helpOpen = helpPreference ?? rosterState === 'missing'
  const activePreview = strategyPreviews.find((preview) => preview.strategy === strategy) ?? null
  const activeOpponentScenario = opponentScenarios.find((scenario) => scenario.id === activeOpponentScenarioId)
    ?? opponentScenarios[0]
  const simulationCourt = simulations.find((court) => court.id === simulationCourtId) ?? null
  const simulationPlayer = simulationCourt?.players.find((player) => player.playerIndex === simulationPlayerIndex)
    ?? simulationCourt?.players[0]
  const simulationCandidate = simulationPlayer?.candidates.find((candidate) => candidate.id === simulationCandidateId)
    ?? simulationPlayer?.candidates[0]
  const historyStarts = courts.reduce((total, court) => total + court.playerEvidence.reduce((sum, player) => sum + player.startCount, 0), 0)
  const overallConfidence: CaptainLineupConfidence = overallProbability === null || !opponentRosterCount
    ? 'Needs opponent'
    : historyStarts >= courts.length * 6
      ? 'High'
      : historyStarts >= courts.length * 2
        ? 'Medium'
        : 'Low'
  const resultLabel = courts.some((court) => typeof court.probability === 'number')
    ? `${projectedWins}–${projectedLosses} ${projectedWins > projectedLosses ? 'win' : 'path'}`
    : 'Add opponent courts'
  const visiblePositions = selectedInsight?.positions.slice(0, 4) ?? []
  const lockedCourtSet = new Set(lockedCourtIds)
  const lockedPlayerSet = new Set(lockedPlayerIds)
  const simulationCourtLocked = simulationCourt ? lockedCourtSet.has(simulationCourt.id) : false
  const simulationPlayerLocked = simulationPlayer ? lockedPlayerSet.has(simulationPlayer.id) : false
  const resilientActive = resilientApplied && resilientPreview?.changedCourts === 0
  const activePairMatrixCourt = pairMatrix.find((court) => court.id === pairMatrixCourtId) ?? pairMatrix[0]

  useEffect(() => {
    if (!selectedCourtId) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus())
    function handlePlayerLensKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedCourtId('')
        return
      }
      if (event.key !== 'Tab' || !sheetRef.current) return
      const focusable = Array.from(sheetRef.current.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((element) => !element.hasAttribute('disabled'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handlePlayerLensKeydown)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', handlePlayerLensKeydown)
      previouslyFocused?.focus()
    }
  }, [selectedCourtId])

  useEffect(() => {
    if (!simulationCourtId) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = window.requestAnimationFrame(() => simulatorCloseButtonRef.current?.focus())
    function handleSimulatorKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSimulationCourtId('')
        return
      }
      if (event.key !== 'Tab' || !simulatorSheetRef.current) return
      const focusable = Array.from(simulatorSheetRef.current.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((element) => !element.hasAttribute('disabled'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleSimulatorKeydown)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', handleSimulatorKeydown)
      previouslyFocused?.focus()
    }
  }, [simulationCourtId])

  function openCourt(court: CaptainLineupIntelligenceCourt) {
    if (!court.playerIds.length) {
      onEditCourt(court.id)
      return
    }
    setSelectedPlayerId(court.playerIds[0])
    setSelectedCourtId(court.id)
  }

  function openSimulator(courtId: string) {
    const nextCourt = simulations.find((court) => court.id === courtId)
    const nextPlayer = nextCourt?.players[0]
    setSimulationPlayerIndex(nextPlayer?.playerIndex ?? 0)
    setSimulationCandidateId(nextPlayer?.candidates[0]?.id ?? '')
    setSimulationCourtId(courtId)
  }

  function chooseSimulationPlayer(player: CaptainLineupSimulationPlayer) {
    setSimulationPlayerIndex(player.playerIndex)
    setSimulationCandidateId(player.candidates[0]?.id ?? '')
  }

  function applySimulation() {
    if (!simulationCourt || !simulationPlayer || !simulationCandidate) return
    onApplySimulation(simulationCourt.id, simulationPlayer.playerIndex, simulationCandidate.id)
    setSimulationCourtId('')
  }

  function applyStrategy() {
    setComparisonBaseline({
      overallProbability,
      courts: courts.map((court) => ({ id: court.id, label: court.label, playerNames: court.playerNames, probability: court.probability })),
    })
    setLastBuiltStrategy(strategy)
    setWhyOpen(true)
    onAutoBuild(strategy)
  }

  function applyResilientStrategy() {
    setComparisonBaseline({
      overallProbability,
      courts: courts.map((court) => ({ id: court.id, label: court.label, playerNames: court.playerNames, probability: court.probability })),
    })
    setLastBuiltStrategy(null)
    setWhyOpen(false)
    setResilientApplied(true)
    onBuildResilient()
  }

  function whyCourt(court: CaptainLineupIntelligenceCourt) {
    if (lockedCourtSet.has(court.id)) return 'Preserved exactly because you locked this court.'
    const lockedNames = court.playerEvidence.filter((player) => lockedPlayerSet.has(player.id)).map((player) => firstName(player.name))
    if (lockedNames.length) return `Built around locked ${lockedNames.join(' + ')}.`
    if (court.probability !== null && court.probability >= 0.58) return 'Protects one of your clearest projected team points.'
    if (court.probability !== null && court.probability < 0.45) return 'Contains risk here so more roster strength can move to winnable courts.'
    if (court.playerEvidence.some((player) => player.startCount >= 3)) return 'Uses players with meaningful history in this part of the scorecard.'
    return 'Best available rating, availability, and pair-fit read with the connected data.'
  }

  return (
    <section className={styles.shell} aria-label="Captain lineup win path">
      <div className={styles.matchHeader}>
        <div>
          <p className={styles.eyebrow}>Win-path lineup</p>
          <h2 className={styles.matchTitle}>{matchDateLabel || 'Match date'} · vs {opponentName || 'Choose opponent'}</h2>
          <div className={styles[rosterState]} role="status" aria-live="polite">
            {rosterState === 'loaded' ? <CheckCircle size={19} weight="fill" aria-hidden="true" /> : null}
            {rosterState === 'loading' ? 'Loading opponent roster…' : rosterState === 'loaded' ? `Opponent roster loaded · ${opponentRosterCount} player${opponentRosterCount === 1 ? '' : 's'}` : 'Opponent roster missing'}
          </div>
        </div>
        <button type="button" className={styles.help} onClick={() => setHelpPreference(true)}>Roster missing?</button>
      </div>

      <details id="captain-lineup-roster-help" className={styles.helpPanel} open={helpOpen} onToggle={(event) => setHelpPreference(event.currentTarget.open)}>
        <summary className={styles.help}>Load a USTA TennisLink roster</summary>
        <ol>
          <li>Sign in to USTA TennisLink and open the opponent&apos;s league team.</li>
          <li>Open <strong>Team Summary</strong>, then choose <strong>Send To Excel</strong>.</li>
          <li>Upload the saved TeamSummary .xls file here. TiQ will return you to this matchup.</li>
        </ol>
        <div className={styles.helpActions}>
          <Link href={rosterUploadHref} className={styles.primaryLink}>Upload Team Summary</Link>
          <button type="button" className={styles.secondaryButton} onClick={onEnterRosterManually}>Enter names instead</button>
        </div>
      </details>

      <div className={styles.result}>
        <div className={styles.resultHeader}>
          <div>
            <p className={styles.eyebrow}>Projected result</p>
            <h3 className={styles.resultTitle}>Best path: {resultLabel} {overallProbability !== null ? <span className={styles.resultChance}>· {percent(overallProbability)}</span> : null}</h3>
          </div>
          <span className={`${styles.confidence} ${confidenceClass(overallConfidence)}`}>{overallConfidence} confidence</span>
        </div>
        <div className={styles.courtRail} style={{ '--court-count': Math.max(1, courts.length) } as CSSProperties} aria-label="Court outlook">
          {courts.map((court) => <span key={court.id} className={`${styles.railSegment} ${courtTone(court.probability).rail}`} title={`${court.label}: ${courtTone(court.probability).role}`} />)}
        </div>
        <div className={styles.railLegend}><span>Green · favored</span><span>Gold · swing</span><span>Red · risk</span><span>{historyStarts} lineup-history starts</span></div>
      </div>

      {activeOpponentScenario ? (
        <section className={styles.scenarioPanel} aria-label="Opponent lineup scenarios">
          <div className={styles.scenarioHeader}>
            <div>
              <p className={styles.eyebrow}>Opponent scenarios</p>
              <h3 className={styles.sectionTitle}>Does your lineup hold up?</h3>
            </div>
            <ShieldCheck size={23} weight="duotone" aria-hidden="true" />
          </div>
          <div className={styles.scenarioTabs} role="tablist" aria-label="Opponent approach">
            {opponentScenarios.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                role="tab"
                aria-selected={scenario.id === activeOpponentScenarioId}
                className={`${styles.scenarioTab} ${scenario.id === activeOpponentScenarioId ? styles.scenarioTabActive : ''}`}
                onClick={() => onOpponentScenarioChange(scenario.id)}
              >
                {scenario.label}
              </button>
            ))}
          </div>
          <div className={styles.scenarioReadout} role="tabpanel" aria-live="polite">
            <div className={styles.scenarioScore}>
              <span><strong>{activeOpponentScenario.holdingCourtCount}/{activeOpponentScenario.totalCourtCount}</strong><small>courts at 50%+</small></span>
              <span><strong>{probabilityRange(activeOpponentScenario.overallProbability, overallConfidence)}</strong><small>{activeOpponentScenario.resultLabel}{overallConfidence === 'High' ? '' : ' · estimated range'}</small></span>
            </div>
            <p>{activeOpponentScenario.detail}</p>
            <div className={styles.pressurePoint}>
              <Target size={18} weight="duotone" aria-hidden="true" />
              <span><small>Pressure point</small><strong>{activeOpponentScenario.pressureCourtLabel} · {percent(activeOpponentScenario.pressureCourtProbability)}</strong></span>
            </div>
            <small className={styles.scenarioHelp}>Court odds below and Auto Builder now use this opponent scenario.</small>
            <details className={styles.opponentReveal}>
              <summary className={styles.opponentRevealSummary}>
                <span><UsersThree size={18} weight="duotone" aria-hidden="true" /><strong>See their projected courts</strong></span>
                <small>{activeOpponentScenario.opponentCourts.some((court) => court.movedFromLikely) ? 'Changes highlighted' : activeOpponentScenario.id === 'likely' ? 'Scenario baseline' : 'Same legal courts'}</small>
              </summary>
              <div className={styles.opponentRevealBody}>
                {activeOpponentScenario.id !== 'likely' && !activeOpponentScenario.opponentCourts.some((court) => court.movedFromLikely) ? <p>No legal court moves from Likely in this format. Ratings can still change if a stronger eligible roster is available.</p> : null}
                <ul>
                  {activeOpponentScenario.opponentCourts.map((court) => (
                    <li key={court.id}>
                      <span><strong>{court.label}</strong><small>{court.ratingLabel}</small></span>
                      <span><strong>{court.playerNames.length ? court.playerNames.join(' + ') : 'Opponent spots open'}</strong>{court.movedFromLikely ? <small className={styles.movedBadge}>Moved</small> : null}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
            {resilientPreview ? (
              <div className={styles.resilientBuild}>
                <div className={styles.resilientCopy}>
                  <span><strong>Best all-scenario floor · {percent(resilientPreview.worstCaseProbability)}</strong><small>Average outlook {percent(resilientPreview.averageProbability)}</small></span>
                  <small>{resilientPreview.changedCourts ? `${resilientPreview.changedCourts} court${resilientPreview.changedCourts === 1 ? '' : 's'} would change${resilientPreview.changeLabels.length ? ` · ${resilientPreview.changeLabels.join(', ')}` : ''}` : 'Your current courts already match the resilient build.'}</small>
                </div>
                <button type="button" className={`${styles.resilientButton} ${resilientActive ? styles.resilientButtonActive : ''}`} disabled={resilientActive} onClick={applyResilientStrategy}>{resilientActive ? <CheckCircle size={18} weight="fill" aria-hidden="true" /> : <ShieldCheck size={18} weight="fill" aria-hidden="true" />} {resilientActive ? 'Resilient lineup active' : 'Build for all 3'}</button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className={styles.lineup}>
        <div className={styles.lineupHeader}><h3 className={styles.sectionTitle}>Your lineup</h3><span className={styles.lineupHint}>Inspect, lock, or edit a court</span></div>
        {courts.map((court) => {
          const tone = courtTone(court.probability)
          const courtLocked = lockedCourtSet.has(court.id)
          return (
            <article key={court.id} className={styles.courtCard}>
              <button type="button" className={styles.courtRow} onClick={() => openCourt(court)}>
                <span className={styles.courtTop}><span className={styles.courtLabel}>{court.label}</span><span className={`${styles.role} ${tone.className}`}>{tone.role}</span></span>
                <span className={styles.courtBottom}>
                  <span>
                    <span className={styles.playerName}>{court.playerNames.length ? court.playerNames.join(' + ') : 'Choose player'}</span>
                    <span className={styles.evidence}>
                      {court.playerEvidence.length > 1 ? court.playerEvidence.map((player) => <span key={player.id}><strong>{firstName(player.name)}</strong> · {player.positionSummary}</span>) : <span>{court.positionSummary}</span>}
                      {court.pairEvidence ? <span className={styles.pairSignal}><UsersThree size={14} weight="bold" aria-hidden="true" /><strong>Pair</strong> · {summarizeCaptainPairRecord(court.pairEvidence)}</span> : null}
                      <span>{court.scoreSummary}</span>
                    </span>
                  </span>
                  <span className={styles.probabilityBlock}>
                    <span className={styles.probability}>{percent(court.probability)} <CaretRight className={styles.disclosure} size={20} weight="bold" aria-hidden="true" /></span>
                    <span className={styles.confidenceDetail}>{court.confidence} · {court.confidenceDetail}</span>
                  </span>
                </span>
              </button>
              <div className={styles.lockRow} aria-label={`${court.label} locks`}>
                <button type="button" className={`${styles.lockButton} ${courtLocked ? styles.lockActive : ''}`} aria-pressed={courtLocked} onClick={() => onToggleCourtLock(court.id)}>
                  {courtLocked ? <LockSimple size={15} weight="fill" aria-hidden="true" /> : <LockSimpleOpen size={15} aria-hidden="true" />}{courtLocked ? 'Court locked' : 'Lock court'}
                </button>
                {court.playerEvidence.map((player) => {
                  const playerLocked = lockedPlayerSet.has(player.id)
                  return <button key={player.id} type="button" className={`${styles.lockButton} ${playerLocked ? styles.lockActive : ''}`} aria-pressed={playerLocked} onClick={() => onTogglePlayerLock(player.id)}>{playerLocked ? <LockSimple size={15} weight="fill" aria-hidden="true" /> : <LockSimpleOpen size={15} aria-hidden="true" />}{firstName(player.name)}</button>
                })}
                {simulations.find((simulation) => simulation.id === court.id)?.players.some((player) => player.candidates.length) ? (
                  <button type="button" className={styles.simulateButton} onClick={() => openSimulator(court.id)}>
                    <ArrowsLeftRight size={16} weight="bold" aria-hidden="true" /> Try a swap
                  </button>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>

      {pairMatrix.length ? (
        <section className={styles.pairMatrix} aria-label="Roster pair matrix">
          <button type="button" className={styles.pairMatrixToggle} aria-expanded={pairMatrixOpen} onClick={() => {
            setPairMatrixOpen((current) => !current)
            if (!pairMatrixCourtId) setPairMatrixCourtId(pairMatrix[0]?.id ?? '')
          }}>
            <span className={styles.pairMatrixIcon}><GridFour size={19} weight="bold" aria-hidden="true" /></span>
            <span><strong>Pair matrix</strong><small>Compare every available pair</small></span>
            <CaretRight size={19} weight="bold" className={pairMatrixOpen ? styles.rotated : ''} aria-hidden="true" />
          </button>
          {pairMatrixOpen && activePairMatrixCourt ? (
            <div className={styles.pairMatrixBody}>
              <div className={styles.pairCourtTabs} role="tablist" aria-label="Pair matrix court">
                {pairMatrix.map((court) => <button key={court.id} type="button" role="tab" aria-selected={court.id === activePairMatrixCourt.id} className={`${styles.pairCourtTab} ${court.id === activePairMatrixCourt.id ? styles.pairCourtTabActive : ''}`} onClick={() => { setPairMatrixCourtId(court.id); setPairAppliedLabel('') }}>{court.label.replace(' Doubles', '')}</button>)}
              </div>
              <p className={styles.pairMatrixGuide}><strong>Projected odds rank the list.</strong> Shared history gives you context and is not weighted yet.</p>
              <div className={styles.pairRanking}>
                {activePairMatrixCourt.recommendations.map((pair, index) => (
                  <article key={pair.id} className={`${styles.pairOption} ${pair.isCurrent ? styles.pairOptionCurrent : ''}`}>
                    <div className={styles.pairOptionTop}>
                      <span className={styles.pairRank}>#{index + 1}</span>
                      <span className={styles.pairOptionNames}><strong>{pair.playerNames.join(' + ')}</strong><small>{pair.ratingLabel} · {pair.availabilityLabel}</small></span>
                      <span className={styles.pairOdds}>{percent(pair.courtProbability)}<small>court</small></span>
                    </div>
                    <div className={styles.pairOptionEvidence}><span>{pair.pairHistory}</span><small>{pair.scoreSummary}</small></div>
                    {pair.isCurrent ? <span className={styles.currentPair}><CheckCircle size={15} weight="fill" aria-hidden="true" /> Current pair</span> : <button type="button" className={styles.placePairButton} disabled={!pair.canApply && !pair.blockingLock} onClick={() => {
                      if (pair.canApply) {
                        onApplyPair(activePairMatrixCourt.id, pair.playerIds)
                        setPairAppliedLabel(`${pair.playerNames.join(' + ')} placed on ${activePairMatrixCourt.label}`)
                      } else if (pair.blockingLock?.kind === 'court') onToggleCourtLock(pair.blockingLock.id)
                      else if (pair.blockingLock?.kind === 'player') onTogglePlayerLock(pair.blockingLock.id)
                    }}>{pair.canApply ? `Place on ${activePairMatrixCourt.label.replace(' Doubles', '')}` : pair.blockedReason}</button>}
                  </article>
                ))}
              </div>
              {pairAppliedLabel ? <div className={styles.pairApplied} role="status"><CheckCircle size={16} weight="fill" aria-hidden="true" /> {pairAppliedLabel}</div> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className={styles.stickyActions}>
        <span className={styles.strategyLabel}>Lineup strategy</span>
        <div className={styles.strategyTabs} role="group" aria-label="Auto-builder strategy">
          {([['best', 'Best odds'], ['safe', 'Safer floor'], ['upside', 'More upside']] as const).map(([value, label]) => <button key={value} type="button" className={`${styles.strategyButton} ${strategy === value ? styles.strategyActive : ''}`} aria-pressed={strategy === value} onClick={() => setStrategy(value)}>{label}</button>)}
        </div>
        {activePreview ? (
          <div className={styles.strategyPreview} aria-live="polite">
            <span><strong>Current {percent(overallProbability)}</strong> → {activePreview.label} <strong>{percent(activePreview.overallProbability)}</strong></span>
            <span>{activePreview.resultLabel} · {activePreview.changedCourts ? `${activePreview.changedCourts} court${activePreview.changedCourts === 1 ? '' : 's'} would change` : 'Current courts already match'}</span>
            {activePreview.changeLabels.length ? <span className={styles.previewCourts}>{activePreview.changeLabels.join(' · ')}</span> : null}
          </div>
        ) : null}
        <div className={styles.actionRow}>
          <button type="button" className={styles.primaryButton} onClick={applyStrategy}><MagicWand size={19} weight="bold" aria-hidden="true" /> {strategyActionLabel(strategy)}</button>
          <button type="button" className={styles.secondaryButton} onClick={() => courts[0] && onEditCourt(courts[0].id)}>Edit manually</button>
        </div>
        <p className={styles.actionHelp}>Availability, court history, pair fit and opponent strength—always around your locks.</p>
      </div>

      {lastBuiltStrategy && comparisonBaseline ? (
        <section className={styles.explanation} aria-label="Why this lineup">
          <button type="button" className={styles.explanationToggle} aria-expanded={whyOpen} onClick={() => setWhyOpen((current) => !current)}>
            <span><strong>Why this lineup?</strong><small>{strategyPreviews.find((preview) => preview.strategy === lastBuiltStrategy)?.label ?? 'Auto-builder'} applied</small></span>
            <CaretRight size={19} weight="bold" className={whyOpen ? styles.rotated : ''} aria-hidden="true" />
          </button>
          {whyOpen ? (
            <div className={styles.explanationBody}>
              <div className={styles.beforeAfter}><span>Before <strong>{percent(comparisonBaseline.overallProbability)}</strong></span><span>After <strong>{percent(overallProbability)}</strong></span></div>
              <ul>
                {courts.map((court) => {
                  const before = comparisonBaseline.courts.find((item) => item.id === court.id)
                  const changed = before ? !samePlayers(before.playerNames, court.playerNames) : true
                  return <li key={court.id}><strong>{court.label} · {changed ? 'Changed' : 'Kept'}</strong><span>{whyCourt(court)}</span></li>
                })}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {simulationCourt && simulationPlayer ? (
        <>
          <button type="button" className={styles.backdrop} aria-label="Close matchup simulator" onClick={() => setSimulationCourtId('')} />
          <aside ref={simulatorSheetRef} className={`${styles.sheet} ${styles.simulatorSheet}`} role="dialog" aria-modal="true" aria-labelledby="captain-lineup-simulator-title">
            <div className={styles.sheetHeader}>
              <div>
                <p className={styles.eyebrow}>Quick matchup simulator</p>
                <h3 id="captain-lineup-simulator-title" className={styles.sheetTitle}>What if? · {simulationCourt.label}</h3>
                <span className={styles.sample}>Preview one swap before changing your lineup.</span>
              </div>
              <button ref={simulatorCloseButtonRef} type="button" className={styles.sheetClose} aria-label="Close matchup simulator" onClick={() => setSimulationCourtId('')}><X size={20} weight="bold" aria-hidden="true" /></button>
            </div>

            <section className={styles.simulatorSection} aria-label="Player to replace">
              <span className={styles.strategyLabel}>Swap out</span>
              <div className={styles.partnerTabs} role="tablist" aria-label={`${simulationCourt.label} players`}>
                {simulationCourt.players.map((player) => (
                  <button key={player.id} type="button" role="tab" aria-selected={player.playerIndex === simulationPlayer.playerIndex} className={`${styles.partnerTab} ${player.playerIndex === simulationPlayer.playerIndex ? styles.partnerTabActive : ''}`} onClick={() => chooseSimulationPlayer(player)}>
                    {firstName(player.name)}{lockedPlayerSet.has(player.id) ? ' · locked' : ''}
                  </button>
                ))}
              </div>
            </section>

            {simulationCourtLocked || simulationPlayerLocked ? (
              <div className={styles.simulatorLockNotice} role="note">
                <span><LockSimple size={17} weight="fill" aria-hidden="true" /><strong>Explore freely. Unlock to apply.</strong></span>
                <small>{simulationCourtLocked ? `${simulationCourt.label} is protected.` : `${simulationPlayer.name} is confirmed or protected.`}</small>
                <div className={styles.simulatorUnlocks}>
                  {simulationCourtLocked ? <button type="button" className={styles.secondaryButton} onClick={() => onToggleCourtLock(simulationCourt.id)}>Unlock court</button> : null}
                  {simulationPlayerLocked ? <button type="button" className={styles.secondaryButton} onClick={() => onTogglePlayerLock(simulationPlayer.id)}>Unlock {firstName(simulationPlayer.name)}</button> : null}
                </div>
              </div>
            ) : null}

            <section className={styles.simulatorSection} aria-label="Replacement options">
              <div className={styles.simulatorSectionHeader}>
                <span className={styles.strategyLabel}>Try instead</span>
                <span className={styles.sample}>{simulationPlayer.candidates.length} eligible</span>
              </div>
              {simulationPlayer.candidates.length ? (
                <div className={styles.candidateList}>
                  {simulationPlayer.candidates.map((candidate) => {
                    const selected = candidate.id === simulationCandidate?.id
                    const currentCourtProbability = candidate.courtProbability !== null && candidate.courtDelta !== null ? candidate.courtProbability - candidate.courtDelta : null
                    const currentOverallProbability = candidate.overallProbability !== null && candidate.overallDelta !== null ? candidate.overallProbability - candidate.overallDelta : null
                    return (
                      <button key={candidate.id} type="button" className={`${styles.candidateCard} ${selected ? styles.candidateSelected : ''}`} aria-pressed={selected} onClick={() => setSimulationCandidateId(candidate.id)}>
                        <span className={styles.candidateHeader}>
                          <span><strong>{candidate.name}</strong><small>{candidate.ratingLabel} · {candidate.availabilityLabel}</small></span>
                          <span className={candidate.overallDelta !== null && candidate.overallDelta > 0 ? styles.deltaPositive : candidate.overallDelta !== null && candidate.overallDelta < 0 ? styles.deltaNegative : styles.deltaNeutral}>{pointDelta(candidate.overallDelta)}</span>
                        </span>
                        <span className={styles.simulationMetrics}>
                          <span>Court <strong>{percent(currentCourtProbability)} → {percent(candidate.courtProbability)}</strong><small>{pointDelta(candidate.courtDelta)}</small></span>
                          <span>Match <strong>{percent(currentOverallProbability)} → {percent(candidate.overallProbability)}</strong><small>{pointDelta(candidate.overallDelta)}</small></span>
                        </span>
                        <span className={styles.candidateEvidence}>{candidate.evidenceSummary}</span>
                      </button>
                    )
                  })}
                </div>
              ) : <span className={styles.empty}>No other eligible players are available for this court.</span>}
            </section>

            <div className={styles.simulatorSummary} aria-live="polite">
              {simulationCandidate ? (
                <><strong>{firstName(simulationPlayer.name)} → {firstName(simulationCandidate.name)}</strong><span>{simulationCandidate.overallProbability === null ? 'Load the opponent courts to calculate match odds.' : `Projected match change: ${pointDelta(simulationCandidate.overallDelta)}.`}</span></>
              ) : <span>Choose an eligible replacement to compare.</span>}
            </div>
            {simulationCandidate ? (
              <details className={styles.factorPanel}>
                <summary className={styles.factorSummary}>
                  <span><Info size={18} weight="bold" aria-hidden="true" /><strong>Why the odds moved</strong></span>
                  <small>Rating drives today&apos;s projection</small>
                </summary>
                <div className={styles.factorBody}>
                  <p><strong>Modeled</strong> changes the percentage now. <strong>Supporting</strong> helps you judge the swap but is not yet weighted.</p>
                  <ul>
                    {simulationCandidate.factors.map((factor) => (
                      <li key={factor.id} className={styles.factorRow}>
                        <span className={`${styles.factorIcon} ${factorToneClass(factor.tone)}`}>{factorToneIcon(factor.tone)}</span>
                        <span className={styles.factorCopy}><span><strong>{factor.label}</strong><small>{factor.modeled ? 'Modeled' : 'Supporting'}</small></span><span>{factor.value}</span><small>{factor.detail}</small></span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            ) : null}
            <div className={styles.sheetActions}>
              <button type="button" className={styles.primaryButton} disabled={!simulationCandidate || simulationCourtLocked || simulationPlayerLocked} onClick={applySimulation}><ArrowsLeftRight size={18} weight="bold" aria-hidden="true" /> Apply this swap</button>
              <button type="button" className={styles.secondaryButton} onClick={() => setSimulationCourtId('')}>Keep current lineup</button>
            </div>
          </aside>
        </>
      ) : null}

      {selectedCourt && selectedEvidence ? (
        <>
          <button type="button" className={styles.backdrop} aria-label="Close player insights" onClick={() => setSelectedCourtId('')} />
          <aside ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="captain-player-insight-title">
            <div className={styles.sheetHeader}>
              <div><p className={styles.eyebrow}>{selectedCourt.label} player lens</p><h3 id="captain-player-insight-title" className={styles.sheetTitle}>{selectedEvidence.name}</h3><span className={styles.sample}>{selectedInsight?.startCount ? `${selectedInsight.startCount} recorded start${selectedInsight.startCount === 1 ? '' : 's'}` : 'Court history not available yet'}</span></div>
              <button ref={closeButtonRef} type="button" className={styles.sheetClose} aria-label="Close player insights" onClick={() => setSelectedCourtId('')}><X size={20} weight="bold" aria-hidden="true" /></button>
            </div>
            {selectedCourt.pairEvidence ? (
              <section className={styles.pairPanel} aria-label="Partnership history">
                <div className={styles.pairPanelHeader}>
                  <span><UsersThree size={18} weight="bold" aria-hidden="true" /><strong>Partnership history</strong></span>
                  <small>Supporting evidence</small>
                </div>
                <div className={styles.pairStats}>
                  <span><strong>{selectedCourt.pairEvidence.startCount}</strong><small>starts together</small></span>
                  <span><strong>{selectedCourt.pairEvidence.winCount}–{selectedCourt.pairEvidence.lossCount}</strong><small>decided record</small></span>
                  <span><strong>{selectedCourt.pairEvidence.winPercentage === null ? '—' : `${selectedCourt.pairEvidence.winPercentage}%`}</strong><small>win rate</small></span>
                </div>
                <div className={styles.pairRead}>
                  <strong>{summarizeCaptainPairRecord(selectedCourt.pairEvidence)}</strong>
                  <span>{summarizeCaptainPairScoreTendency(selectedCourt.pairEvidence)}</span>
                </div>
                <p>Shared starts help you judge chemistry. They do not change today&apos;s rating-driven percentage yet.</p>
              </section>
            ) : null}
            {selectedCourt.playerEvidence.length > 1 ? <div className={styles.partnerTabs} role="tablist" aria-label={`${selectedCourt.label} partners`}>{selectedCourt.playerEvidence.map((player) => <button key={player.id} type="button" role="tab" aria-selected={player.id === selectedEvidence.id} className={`${styles.partnerTab} ${player.id === selectedEvidence.id ? styles.partnerTabActive : ''}`} onClick={() => setSelectedPlayerId(player.id)}>{firstName(player.name)}</button>)}</div> : null}
            <div className={styles.sheetGrid}>
              <section className={styles.chartSection} aria-label="Court position tendency">
                <div><h4 className={styles.sectionTitle}>Court position tendency</h4><span className={styles.sample}>{selectedInsight?.startCount ? `Based on ${selectedInsight.startCount} start${selectedInsight.startCount === 1 ? '' : 's'}` : 'More history needed'}</span></div>
                {visiblePositions.length ? visiblePositions.map((position) => <div key={position.label} className={styles.barRow}><span>{position.label}</span><span className={styles.barTrack}><span className={styles.barFill} style={{ width: `${position.percentage}%` }} /></span><strong>{position.percentage}%</strong></div>) : <span className={styles.empty}>No recorded court positions yet.</span>}
              </section>
              <section className={styles.chartSection} aria-label="Recent win score distribution">
                <div><h4 className={styles.sectionTitle}>Win score distribution</h4><span className={styles.sample}>{selectedInsight?.scoredWinCount ? `Based on ${selectedInsight.scoredWinCount} scored win${selectedInsight.scoredWinCount === 1 ? '' : 's'} · ${selectedInsight.scoredSetCount} set${selectedInsight.scoredSetCount === 1 ? '' : 's'}` : 'More scored wins needed'}</span></div>
                {selectedInsight?.scoredSetCount ? selectedInsight.scoreOutcomes.map((outcome) => <div key={outcome.label} className={styles.barRow}><span>{outcome.label}</span><span className={styles.barTrack}><span className={styles.barFill} style={{ width: `${outcome.percentage}%` }} /></span><strong>{outcome.percentage}%</strong></div>) : <span className={styles.empty}>No scored wins are connected to this player yet.</span>}
              </section>
            </div>
            <p className={styles.insight}><strong>Matchup read:</strong> {selectedCourt.probability !== null && selectedCourt.probability >= 0.58 ? 'This court protects one of your clearest paths to a team point.' : 'Compare this player on another court before locking the matchup.'}</p>
            <div className={styles.sheetActions}><button type="button" className={styles.keepButton} onClick={() => setSelectedCourtId('')}>Keep at {selectedCourt.label}</button><button type="button" className={styles.secondaryButton} onClick={() => { setSelectedCourtId(''); onEditCourt(selectedCourt.id) }}>Compare or edit court</button></div>
          </aside>
        </>
      ) : null}
    </section>
  )
}
